from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Protocol

@dataclass(slots=True)
class ServoTelemetry:
    """One servo's reported voltage, temperature, and position readings."""

    servo_id: int
    vin_mv: int | None
    temp_c: int | None
    position: int | None


class ServoBridge(Protocol):
    """Operations required from the configured serial servo controller."""

    def set_positions(self, duration_ms: int, id_and_pos: Iterable[tuple[int, int]]) -> None: ...

    def stop(self, servo_ids: Iterable[int]) -> None: ...

    def read_id(self, servo_id: int = 254) -> int | None: ...

    def read_position(self, servo_id: int) -> int | None: ...

    def read_vin_mv(self, servo_id: int) -> int | None: ...

    def read_temp_c(self, servo_id: int) -> int | None: ...

    def read_battery_mv(self) -> int | None: ...

    def ping(self, servo_id: int) -> bool: ...


class BusServoController:
    """Facade that limits scans and stop commands to managed servos."""

    def __init__(self, bridge: ServoBridge, managed_servo_ids: Iterable[int]):
        self.bridge = bridge
        self.managed_servo_ids = [int(i) for i in managed_servo_ids]

    def move_positions(self, id_to_position: dict[int, int], duration_ms: int) -> None:
        payload = sorted((int(servo_id), int(position)) for servo_id, position in id_to_position.items())
        self.bridge.set_positions(duration_ms, payload)

    def stop(self, servo_ids: Iterable[int] | None = None) -> None:
        ids = self.managed_servo_ids if servo_ids is None else [int(i) for i in servo_ids]
        self.bridge.stop(ids)

    def read_telemetry(self, servo_id: int) -> ServoTelemetry:
        sid = int(servo_id)
        return ServoTelemetry(
            servo_id=sid,
            vin_mv=self.bridge.read_vin_mv(sid),
            temp_c=self.bridge.read_temp_c(sid),
            position=self.bridge.read_position(sid),
        )

    def scan_online(self) -> list[int]:
        online_ids: list[int] = []
        for servo_id in self.managed_servo_ids:
            if self.bridge.ping(servo_id):
                online_ids.append(servo_id)
        return online_ids
