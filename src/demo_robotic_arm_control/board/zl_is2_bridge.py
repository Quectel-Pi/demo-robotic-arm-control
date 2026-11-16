from __future__ import annotations

import re
import threading
import time
from dataclasses import dataclass
from typing import Iterable

import serial


@dataclass(slots=True)
class ZLIS2BridgeConfig:
    serial_port: str = '/dev/ttyS1'
    baudrate: int = 115200
    timeout_sec: float = 0.05
    read_timeout_sec: float = 0.6


class ZLIS2Bridge:
    """Serialize ZL-IS2 ASCII commands and parse its delimited feedback frames."""

    _ID_RE = re.compile(r'^[#@](?P<sid>\d{3})P!$')
    _POS_RE = re.compile(r'^[#@](?P<sid>\d{3})P(?:-P)?(?P<pwm>\d{4})!$')
    _TV_RE = re.compile(r'^#(?P<sid>\d{3})T(?P<temp>\d+(?:\.\d+)?)V(?P<vin>\d+(?:\.\d+)?)!$')

    def __init__(self, config: ZLIS2BridgeConfig):
        self.config = config
        self._lock = threading.Lock()
        self._rx_buffer = bytearray()
        self._port = serial.Serial(
            port=config.serial_port,
            baudrate=config.baudrate,
            timeout=config.timeout_sec,
            write_timeout=config.timeout_sec,
        )

    def __enter__(self) -> 'ZLIS2Bridge':
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()

    def close(self) -> None:
        if self._port.is_open:
            self._port.close()

    def set_positions(self, duration_ms: int, id_and_pos: Iterable[tuple[int, int]]) -> None:
        packed = sorted((int(servo_id), int(position)) for servo_id, position in id_and_pos)
        if not packed:
            return

        t_ms = max(0, min(9999, int(duration_ms)))
        self.set_pwm_targets(
            (servo_id, self._pos_to_pwm(position), t_ms)
            for servo_id, position in packed
        )

    def set_pwm_targets(self, id_pwm_duration: Iterable[tuple[int, int, int]]) -> None:
        packed = sorted(
            (int(servo_id), int(pwm), int(duration_ms))
            for servo_id, pwm, duration_ms in id_pwm_duration
        )
        if not packed:
            return

        servo_ids = [servo_id for servo_id, _pwm, _duration_ms in packed]
        if len(servo_ids) != len(set(servo_ids)):
            raise ValueError('PWM frame contains duplicate servo IDs')

        frames = []
        for servo_id, pwm, duration_ms in packed:
            if not 0 <= servo_id <= 254:
                raise ValueError(f'invalid servo ID: {servo_id}')
            if not 500 <= pwm <= 2500:
                raise ValueError(f'invalid servo PWM: {pwm}')
            if not 0 <= duration_ms <= 9999:
                raise ValueError(f'invalid movement duration: {duration_ms}')
            frames.append(f'#{servo_id:03d}P{pwm:04d}T{duration_ms:04d}!')

        command = frames[0] if len(frames) == 1 else '{' + ''.join(frames) + '}'
        self._fire_and_forget(command)

    def stop(self, servo_ids: Iterable[int]) -> None:
        ids = [int(i) for i in servo_ids]
        if not ids:
            self._fire_and_forget('$DST!')
            return
        for servo_id in ids:
            self._fire_and_forget(f'#{servo_id:03d}PDST!')

    def read_id(self, servo_id: int = 254) -> int | None:
        target = 255 if int(servo_id) in (254, 255) else int(servo_id)
        command = f'#{target:03d}PID!'
        frame = self._query_frame(command, self._parse_id_frame)
        if frame is None:
            return None
        return frame

    def read_position(self, servo_id: int) -> int | None:
        sid = int(servo_id)
        frame = self._query_frame(f'#{sid:03d}PRAD!', self._parse_position_frame)
        if frame is None:
            return None
        frame_id, pwm = frame
        if frame_id != sid:
            return None
        return self._pwm_to_pos(pwm)

    def read_vin_mv(self, servo_id: int) -> int | None:
        sid = int(servo_id)
        frame = self._query_frame(f'#{sid:03d}PRTV!', self._parse_temp_vin_frame)
        if frame is None:
            return None
        frame_id, _temp_c, vin_mv = frame
        if frame_id != sid:
            return None
        return vin_mv

    def read_temp_c(self, servo_id: int) -> int | None:
        sid = int(servo_id)
        frame = self._query_frame(f'#{sid:03d}PRTV!', self._parse_temp_vin_frame)
        if frame is None:
            return None
        frame_id, temp_c, _vin_mv = frame
        if frame_id != sid:
            return None
        return temp_c

    def read_battery_mv(self) -> int | None:
        # This controller does not expose a board-wide battery reading.
        return None

    def ping(self, servo_id: int) -> bool:
        return self.read_id(int(servo_id)) == int(servo_id)

    def _fire_and_forget(self, command: str) -> None:
        with self._lock:
            self._drain_input()
            if not self._write(command):
                raise serial.SerialException(f'failed to write to {self.config.serial_port}')

    def _query_frame(self, command: str, parser):
        deadline = time.monotonic() + float(self.config.read_timeout_sec)
        with self._lock:
            # The bus is half-duplex: discard stale input and keep each request
            # paired with its response before another thread can use the port.
            self._drain_input()
            if not self._write(command):
                return None
            while time.monotonic() < deadline:
                frame = self._read_one_frame(deadline)
                if frame is None:
                    return None
                parsed = parser(frame)
                if parsed is not None:
                    return parsed
        return None

    def _write(self, command: str) -> bool:
        payload = command.encode('ascii', errors='ignore')
        try:
            self._port.write(payload)
            self._port.flush()
        except serial.SerialException:
            return False
        return True

    def _drain_input(self) -> None:
        self._rx_buffer.clear()
        try:
            self._port.reset_input_buffer()
        except serial.SerialException:
            return

    def _read_one_frame(self, deadline: float) -> str | None:
        while time.monotonic() < deadline:
            cached = self._pop_frame_from_buffer()
            if cached is not None:
                return cached

            try:
                chunk = self._port.read(64)
            except serial.SerialException:
                return self._pop_frame_from_buffer()
            if chunk is None:
                return self._pop_frame_from_buffer()
            if chunk:
                self._rx_buffer.extend(chunk)
                parsed = self._pop_frame_from_buffer()
                if parsed is not None:
                    return parsed
        return self._pop_frame_from_buffer()

    def _pop_frame_from_buffer(self) -> str | None:
        # Ignore leading noise and extract one response ending at the protocol's
        # '!' delimiter; any remaining bytes stay buffered for the next read.
        while self._rx_buffer:
            starts = [
                self._rx_buffer.find(b'#'),
                self._rx_buffer.find(b'@'),
                self._rx_buffer.find(b'$'),
                self._rx_buffer.find(b'<'),
            ]
            starts = [index for index in starts if index >= 0]
            if not starts:
                self._rx_buffer.clear()
                return None

            start = min(starts)
            if start > 0:
                del self._rx_buffer[:start]

            end = self._rx_buffer.find(b'!')
            if end < 0:
                return None

            raw = bytes(self._rx_buffer[: end + 1])
            del self._rx_buffer[: end + 1]
            frame = raw.decode('ascii', errors='ignore').strip()
            if frame:
                return frame
        return None

    def _parse_id_frame(self, frame: str) -> int | None:
        matched = self._ID_RE.match(frame)
        if not matched:
            return None
        return int(matched.group('sid'))

    def _parse_position_frame(self, frame: str) -> tuple[int, int] | None:
        matched = self._POS_RE.match(frame)
        if not matched:
            return None
        return int(matched.group('sid')), int(matched.group('pwm'))

    def _parse_temp_vin_frame(self, frame: str) -> tuple[int, int, int] | None:
        matched = self._TV_RE.match(frame)
        if not matched:
            return None

        sid = int(matched.group('sid'))
        temp_c = int(round(float(matched.group('temp'))))
        vin_v = self._parse_voltage_token(matched.group('vin'))
        if vin_v is None:
            return None
        return sid, temp_c, int(round(vin_v * 1000.0))

    @staticmethod
    def _parse_voltage_token(token: str) -> float | None:
        if not token:
            return None
        if '.' in token:
            try:
                volts = float(token)
            except ValueError:
                return None
            return volts if 1.0 <= volts <= 20.0 else None

        try:
            raw = int(token)
        except ValueError:
            return None

        # Some firmware revisions omit the decimal point, so try volts and
        # common fixed-point encodings before rejecting an implausible value.
        candidates = [float(raw), raw / 10.0, raw / 100.0]
        for value in candidates:
            if 1.0 <= value <= 20.0:
                return value
        return None

    @staticmethod
    def _pos_to_pwm(position: int) -> int:
        # ZL-IS2 maps positions 0..1000 to pulses from 500..2500 microseconds.
        clamped = max(0, min(1000, int(position)))
        return 500 + clamped * 2

    @staticmethod
    def _pwm_to_pos(pwm: int) -> int:
        # Keep the inverse mapping consistent with _pos_to_pwm above.
        clamped = max(500, min(2500, int(pwm)))
        return int(round((clamped - 500) / 2.0))
