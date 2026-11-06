from __future__ import annotations

import argparse
import ipaddress
import json
import logging
import math
import threading
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .runtime import build_stack, load_config, open_bridge
from .web_calibration import calibrated_config
from ..motion import MotionScheduler


PROJECT_ROOT = Path(__file__).resolve().parents[3]
WEB_ROOT = PROJECT_ROOT / "web"
ACTION_GROUP_CATALOG_FILE = PROJECT_ROOT / "action_group_catalog.json"
RECORDED_ACTION_FILE = PROJECT_ROOT / "recorded_action_groups.json"
GRIPPER_CLOSED_PWM = 1700
ACTION_POSITION_READ_ATTEMPTS = 3
ACTION_POSITION_READ_RETRY_SEC = 0.1
# Move the elbow/wrist to the approach angles before moving the shoulder.
CATALOG_APPROACH_SERVO_IDS = {
    0: (2, 3),  # Return from G0021: unfold before moving the shoulder to neutral.
    2: (2, 3),  # Front-grab approach after G0001: unfold before lowering J2.
    3: (2, 3),  # Front grab directly from G0001: pre-position J3/J4 before lowering J2.
    9: (2, 3),  # Left grab, unfold the elbow/wrist before lowering J2.
    14: (2, 3),  # Right grab, after G0013.
    19: (2, 3),  # Front place, after G0018.
    23: (2, 3),  # Left place, after G0022.
    28: (2, 3),  # Right place, after G0027.
    36: (2, 3),  # Combined transfer, after G0035; avoid sweeping into the table.
}
LOGGER = logging.getLogger(__name__)


class ArmWebControl:
    """Serial owner and safety boundary for the browser control panel."""

    def __init__(self, config_path: str | Path, mock: bool = False, *, baseline_path: str | Path | None = None):
        self.config_path = Path(config_path)
        source_config = load_config(self.config_path)
        # Mock callers stay isolated from the installed arm unless explicitly
        # given a baseline. Live startup only loads data; it sends no movement.
        reference_path = Path(baseline_path) if baseline_path is not None else (None if mock else self.config_path.with_name("web_calibration.json"))
        self.config, self.calibration = calibrated_config(source_config, reference_path)
        self.backend, self.bridge_config, self.model, self.policy = build_stack(self.config)
        if self.backend != "zl_is2":
            raise RuntimeError("The Jibot1 web console requires the configured serial controller")

        self.servo_ids = self.model.servo_ids()
        self.joints = {int(item["id"]): item for item in self.config["joints"]}
        self.joint_name_to_id = {str(item["name"]): int(item["id"]) for item in self.config["joints"]}
        self.mock = bool(mock)
        self.bridge = None if self.mock else open_bridge(self.backend, self.bridge_config)
        self.bus_lock = threading.Lock()
        self.poll_lock = threading.Lock()
        self.move_lock = threading.Lock()
        self.cache_lock = threading.Lock()
        self.action_lock = threading.Lock()
        self.action_file = RECORDED_ACTION_FILE
        self.stop_event = threading.Event()
        self.active_id: int | None = None
        self.active_action_id: str | None = None
        self.last_poll = 0.0
        self.state_cache: dict[int, dict[str, Any]] = {}
        self.action_progress: dict[str, Any] | None = None

        for servo_id in self.servo_ids:
            joint = self.joints[servo_id]
            initial_position = self.model.angles_to_positions({joint["name"]: 0.0})[servo_id] if self.mock else None
            self.state_cache[servo_id] = self._servo_state(servo_id, initial_position)

    def _read_action_groups_unlocked(self) -> list[dict[str, Any]]:
        if not self.action_file.exists():
            return []
        try:
            data = json.loads(self.action_file.read_text(encoding="utf-8"))
            groups = data["groups"]
            if not isinstance(groups, list) or any(not isinstance(group, dict) for group in groups):
                raise ValueError("groups must be a list of objects")
            return groups
        except (OSError, json.JSONDecodeError, KeyError, TypeError, ValueError) as error:
            raise RuntimeError(f"Cannot read recorded action groups: {error}") from error

    def action_groups(self) -> list[dict[str, Any]]:
        with self.action_lock:
            return self._read_action_groups_unlocked()

    def catalog_action_library(self) -> dict[str, Any]:
        try:
            data = json.loads(ACTION_GROUP_CATALOG_FILE.read_text(encoding="utf-8"))
            servo_ids = [int(servo_id) for servo_id in data["servo_ids"]]
            actions = data["actions"]
            groups = data["groups"]
            if servo_ids != self.servo_ids:
                raise ValueError("Action group catalog servo IDs/order do not match the active arm configuration")
            if not isinstance(actions, list) or not isinstance(groups, list):
                raise ValueError("Action group catalog actions and groups must be lists")
            for group in groups:
                approach_ids = CATALOG_APPROACH_SERVO_IDS.get(int(group["id"]))
                if approach_ids:
                    group["approach_servo_ids"] = list(approach_ids)
        except (OSError, json.JSONDecodeError, KeyError, TypeError, ValueError) as error:
            raise RuntimeError(f"Cannot read action group catalog: {error}") from error

        pwm_limits = {
            str(servo_id): {
                "min_pwm": 500 + 2 * int(self.joints[servo_id]["min_pos"]),
                "max_pwm": 500 + 2 * int(self.joints[servo_id]["max_pos"]),
            }
            for servo_id in self.servo_ids
        }
        return {
            **data,
            "calibration": self.calibration,
            "safety": {
                "gripper_closed_pwm": GRIPPER_CLOSED_PWM,
                "pwm_limits": pwm_limits,
                "source_actions_verified": False,
            },
        }

    def _catalog_action_as_recording(self, group_id: int) -> dict[str, Any]:
        library = self.catalog_action_library()
        raw_group = next(
            (item for item in library["groups"] if int(item.get("id", -1)) == group_id),
            None,
        )
        if raw_group is None:
            raise ValueError(f"Unknown action group G{group_id:04d}")

        raw_pwm = raw_group.get("pwm")
        raw_times = raw_group.get("time_ms")
        if not isinstance(raw_pwm, list) or len(raw_pwm) != len(self.servo_ids):
            raise ValueError(f"Invalid PWM data for action group G{group_id:04d}")
        if not isinstance(raw_times, list) or len(raw_times) != len(self.servo_ids):
            raise ValueError(f"Invalid timing data for action group G{group_id:04d}")

        positions: dict[int, int] = {}
        for servo_id, raw_value in zip(self.servo_ids, raw_pwm):
            source_pwm = int(raw_value)
            offset = self.calibration["joints"][self.servo_ids.index(servo_id)]["offset_pwm"]
            pwm = source_pwm + offset
            position, remainder = divmod(pwm - 500, 2)
            joint = self.joints[servo_id]
            if remainder or not int(joint["min_pos"]) <= position <= int(joint["max_pos"]):
                raise ValueError(
                    f"G{group_id:04d} ID {servo_id} PWM {pwm} is outside the configured soft limits"
                )
            if servo_id == 5 and pwm > GRIPPER_CLOSED_PWM:
                raise ValueError(
                    f"G{group_id:04d} gripper PWM {pwm} exceeds the confirmed closed-contact limit "
                    f"({GRIPPER_CLOSED_PWM})"
                )
            # Add the reference offset before converting to relative angles.
            # Converting unshifted PWM through the calibrated model would
            # cancel the offset when playback converts those angles back.
            positions[servo_id] = position

        durations = [int(value) for value in raw_times]
        if any(duration < 0 or duration > 10000 for duration in durations):
            raise ValueError(f"Invalid timing data for action group G{group_id:04d}")
        duration_ms = max(durations)
        angles = [
            self.model.positions_to_angles({servo_id: positions[servo_id]})[
                str(self.joints[servo_id]["name"])
            ]
            for servo_id in self.servo_ids
        ]
        action = next(
            (
                item
                for item in library["actions"]
                if int(item["start_group"]) <= group_id <= int(item["end_group"])
            ),
            None,
        )
        action_label = str(action["label"]) if action else "Imported action group"
        frames = [{"angles_deg": angles, "duration_ms": duration_ms}]
        if raw_group.get("approach_servo_ids"):
            frames.insert(0, {
                "angles_deg": angles,
                "duration_ms": duration_ms,
                "servo_ids": raw_group["approach_servo_ids"],
            })
        return {
            "id": f"catalog-{group_id:04d}",
            "name": f"{action_label} · G{group_id:04d}",
            "frames": frames,
        }

    def _write_action_groups_unlocked(self, groups: list[dict[str, Any]]) -> None:
        self.action_file.parent.mkdir(parents=True, exist_ok=True)
        temporary_file = self.action_file.with_suffix(self.action_file.suffix + ".tmp")
        temporary_file.write_text(
            json.dumps({"version": 1, "groups": groups}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        os.replace(temporary_file, self.action_file)

    def create_action_group(self, payload: dict[str, Any]) -> dict[str, Any]:
        name = str(payload.get("name", "")).strip()
        if not name or len(name) > 60:
            raise ValueError("Action group name must contain 1..60 characters")
        raw_frames = payload.get("frames")
        if not isinstance(raw_frames, list) or not 1 <= len(raw_frames) <= 200:
            raise ValueError("An action group must contain 1..200 poses")

        frames: list[dict[str, Any]] = []
        for index, raw_frame in enumerate(raw_frames, start=1):
            if not isinstance(raw_frame, dict):
                raise ValueError(f"Pose {index} must be an object")
            raw_angles = raw_frame.get("angles_deg")
            if not isinstance(raw_angles, list) or len(raw_angles) != len(self.servo_ids):
                raise ValueError(f"Pose {index} must contain one angle for each of the six joints")
            angles: list[float] = []
            for servo_id, raw_angle in zip(self.servo_ids, raw_angles):
                try:
                    angle = float(raw_angle)
                except (TypeError, ValueError) as error:
                    raise ValueError(f"Pose {index} contains an invalid angle") from error
                joint = self.joints[servo_id]
                if not math.isfinite(angle) or not float(joint["min_deg"]) <= angle <= float(joint["max_deg"]):
                    raise ValueError(
                        f"Pose {index} joint {servo_id + 1} is outside "
                        f"{joint['min_deg']}..{joint['max_deg']} degrees"
                    )
                angles.append(round(angle, 2))
            try:
                duration_ms = int(raw_frame.get("duration_ms", 1000))
            except (TypeError, ValueError) as error:
                raise ValueError(f"Pose {index} has an invalid duration") from error
            if not 300 <= duration_ms <= 10000:
                raise ValueError(f"Pose {index} duration must be between 300 and 10000 ms")
            frames.append({"angles_deg": angles, "duration_ms": duration_ms})

        group = {
            "id": uuid.uuid4().hex,
            "name": name,
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "angle_reference": "baseline-relative",
            "angle_mapping": self.calibration["angle_mapping"],
            "frames": frames,
        }
        with self.action_lock:
            groups = self._read_action_groups_unlocked()
            groups.append(group)
            self._write_action_groups_unlocked(groups)
        return group

    def delete_action_group(self, group_id: str) -> bool:
        with self.action_lock:
            groups = self._read_action_groups_unlocked()
            updated_groups = [group for group in groups if str(group.get("id")) != group_id]
            if len(updated_groups) == len(groups):
                return False
            self._write_action_groups_unlocked(updated_groups)
            return True

    def _assert_action_pose_safe(self, angles: dict[str, float]) -> dict[int, int]:
        positions = self.model.angles_to_positions(angles)
        pwm_by_id: dict[int, int] = {}
        for servo_id in self.servo_ids:
            joint = self.joints[servo_id]
            position = int(positions[servo_id])
            if not int(joint["min_pos"]) <= position <= int(joint["max_pos"]):
                raise ValueError(f"Action target for joint {servo_id + 1} is outside configured position limits")
            pwm_by_id[servo_id] = 500 + 2 * position
            if servo_id == 5 and pwm_by_id[servo_id] > GRIPPER_CLOSED_PWM:
                raise ValueError("Gripper target exceeds the confirmed close limit")
        return {servo_id: int(positions[servo_id]) for servo_id in self.servo_ids}

    def _assert_action_transition_safe(
        self,
        current_angles: dict[str, float],
        target_angles: dict[str, float],
    ) -> dict[int, int]:
        max_delta = max(
            abs(target_angles[name] - current_angles[name]) for name in current_angles
        )
        sample_count = max(1, int(math.ceil(max_delta / 2.0)))
        final_positions: dict[int, int] = {}
        for sample_index in range(1, sample_count + 1):
            ratio = sample_index / sample_count
            sample_angles = {
                name: current_angles[name] + (target_angles[name] - current_angles[name]) * ratio
                for name in current_angles
            }
            final_positions = self._assert_action_pose_safe(sample_angles)
        return final_positions

    def _read_action_positions(self, servo_ids: list[int]) -> dict[int, int | None]:
        """Retry missing feedback after a pose without resending movement commands."""
        positions: dict[int, int | None] = {servo_id: None for servo_id in servo_ids}
        pending = list(servo_ids)
        for attempt in range(1, ACTION_POSITION_READ_ATTEMPTS + 1):
            with self.bus_lock:
                for servo_id in pending:
                    positions[servo_id] = self.bridge.read_position(servo_id)
            pending = [servo_id for servo_id in pending if positions[servo_id] is None]
            if not pending:
                break
            LOGGER.warning(
                "Action %s: missing position feedback for servo IDs %s (attempt %d/%d)",
                self.active_action_id,
                pending,
                attempt,
                ACTION_POSITION_READ_ATTEMPTS,
            )
            if self.stop_event.is_set() or attempt == ACTION_POSITION_READ_ATTEMPTS:
                break
            if self.stop_event.wait(ACTION_POSITION_READ_RETRY_SEC):
                break
        return positions

    def _publish_action_progress(self, phase: str, **details: Any) -> None:
        with self.cache_lock:
            if self.action_progress is None:
                self.action_progress = {}
            self.action_progress.update(details)
            self.action_progress["phase"] = (
                "stopped" if phase in ("moving", "reading") and self.stop_event.is_set() else phase
            )

    def motion_snapshot(self) -> dict[str, Any]:
        """Publish cached execution progress without polling or locking the serial bus."""
        with self.cache_lock:
            progress = dict(self.action_progress) if self.action_progress else None
            servos = [dict(self.state_cache[servo_id]) for servo_id in self.servo_ids]
        if progress is not None:
            started_at = progress.pop("_started_at", None)
            progress["elapsed_ms"] = (
                max(0.0, min(float(progress.get("duration_ms", 0)), (time.monotonic() - started_at) * 1000))
                if started_at is not None else 0.0
            )
        return {
            "progress": progress,
            "servos": servos,
            "active_action_id": self.active_action_id,
            "busy": self.active_id is not None or self.active_action_id is not None,
        }

    def play_action_group(self, group_id: str, *, refresh_before: bool = True) -> dict[str, Any]:
        """Validate, stage, execute, and verify one saved or catalog action group."""
        if group_id.startswith("catalog-"):
            try:
                catalog_group_id = int(group_id[len("catalog-"):])
            except ValueError as error:
                raise ValueError("Invalid imported action group ID") from error
            group = self._catalog_action_as_recording(catalog_group_id)
        else:
            with self.action_lock:
                group = next(
                    (item for item in self._read_action_groups_unlocked() if str(item.get("id")) == group_id),
                    None,
                )
        if group is None:
            raise ValueError("Action group not found")
        raw_frames = group.get("frames")
        if not isinstance(raw_frames, list) or not 1 <= len(raw_frames) <= 200:
            raise ValueError("Action group must contain 1..200 recorded poses")

        if not self.move_lock.acquire(blocking=False):
            raise RuntimeError("Another motion is in progress")
        try:
            self.stop_event.clear()
            with self.cache_lock:
                self.action_progress = {
                    "execution_id": uuid.uuid4().hex,
                    "group_id": group_id,
                    "phase": "preparing",
                    "stage_index": 0,
                    "stage_count": 0,
                    "servo_ids": [],
                    "duration_ms": 0,
                }
            if refresh_before:
                self.refresh(force=True)
            with self.cache_lock:
                initial_states = {servo_id: dict(self.state_cache[servo_id]) for servo_id in self.servo_ids}
            if any(not state["online"] or state["angle_deg"] is None for state in initial_states.values()):
                raise RuntimeError("All six joints must be online before playback")

            current_angles = {
                str(self.joints[servo_id]["name"]): float(initial_states[servo_id]["angle_deg"])
                for servo_id in self.servo_ids
            }
            planned_steps: list[dict[str, Any]] = []
            scheduler = MotionScheduler(self.policy)
            for frame_index, raw_frame in enumerate(raw_frames, start=1):
                if not isinstance(raw_frame, dict):
                    raise ValueError(f"Pose {frame_index} is invalid")
                raw_angles = raw_frame.get("angles_deg")
                if not isinstance(raw_angles, list) or len(raw_angles) != len(self.servo_ids):
                    raise ValueError(f"Pose {frame_index} must contain one angle for each of the six joints")
                frame_servo_ids = raw_frame.get("servo_ids", self.servo_ids)
                if (
                    not isinstance(frame_servo_ids, list)
                    or not frame_servo_ids
                    or any(type(servo_id) is not int or servo_id not in self.servo_ids for servo_id in frame_servo_ids)
                    or len(set(frame_servo_ids)) != len(frame_servo_ids)
                ):
                    raise ValueError(f"Pose {frame_index} has invalid servo IDs")
                target_angles: dict[str, float] = {}
                for servo_id, raw_angle in zip(self.servo_ids, raw_angles):
                    try:
                        angle = float(raw_angle)
                    except (TypeError, ValueError) as error:
                        raise ValueError(f"Pose {frame_index} contains an invalid angle") from error
                    joint = self.joints[servo_id]
                    if not math.isfinite(angle) or not float(joint["min_deg"]) <= angle <= float(joint["max_deg"]):
                        raise ValueError(f"Pose {frame_index} joint {servo_id + 1} is outside configured limits")
                    # A preparation frame moves only its selected axes. Other
                    # joints hold their current pose, rather than the final one.
                    name = str(joint["name"])
                    target_angles[name] = angle if servo_id in frame_servo_ids else current_angles[name]
                try:
                    requested_duration = int(raw_frame.get("duration_ms", 1000))
                except (TypeError, ValueError) as error:
                    raise ValueError(f"Pose {frame_index} has an invalid duration") from error
                if not 300 <= requested_duration <= 10000:
                    raise ValueError(f"Pose {frame_index} duration must be between 300 and 10000 ms")

                max_delta = max(
                    abs(target_angles[name] - current_angles[name]) for name in current_angles
                )
                if max_delta <= 1e-6:
                    continue
                speed_deg_s = max_delta / (requested_duration / 1000.0)
                motion_frames = scheduler.build_frames(
                    current_angles=current_angles,
                    target_angles=target_angles,
                    joint_name_to_id=self.joint_name_to_id,
                    speed_deg_s=speed_deg_s,
                    pause_ms=0,
                )
                for motion_frame in motion_frames:
                    stage_angles = {
                        name: float(angle) for name, angle in motion_frame.angles.items()
                    }
                    changed_ids = [
                        servo_id
                        for servo_id in self.servo_ids
                        if abs(
                            stage_angles[str(self.joints[servo_id]["name"])]
                            - current_angles[str(self.joints[servo_id]["name"])]
                        ) > 1e-6
                    ]
                    if not changed_ids:
                        continue
                    positions = self._assert_action_transition_safe(current_angles, stage_angles)
                    duration_ms = max(int(motion_frame.duration_ms), int(self.policy.min_duration_ms))
                    if any(servo_id in self.policy.heavy_axis_ids for servo_id in changed_ids):
                        duration_ms = max(duration_ms, int(self.policy.heavy_axis_min_duration_ms))
                    planned_steps.append({
                        "angles": stage_angles,
                        "positions": positions,
                        "servo_ids": changed_ids,
                        "duration_ms": min(duration_ms, 10000),
                    })
                    current_angles = stage_angles

            self.active_action_id = group_id
            self._publish_action_progress("preparing", stage_count=len(planned_steps))
            contact_ids: list[int] = []
            for stage_index, step in enumerate(planned_steps, start=1):
                if self.stop_event.is_set():
                    self._publish_action_progress("stopped")
                    return {"status": "stopped", "group_id": group_id}
                target_positions = step["positions"]
                moved_ids = step["servo_ids"]
                duration_ms = step["duration_ms"]

                with self.cache_lock:
                    start_angles = {
                        str(servo_id): self.state_cache[servo_id]["angle_deg"]
                        for servo_id in self.servo_ids
                    }
                command_angles = self.model.positions_to_angles(target_positions)
                if not self.mock:
                    with self.bus_lock:
                        if self.stop_event.is_set():
                            self._publish_action_progress("stopped")
                            return {"status": "stopped", "group_id": group_id}
                        self.bridge.set_positions(
                            duration_ms,
                            [(servo_id, target_positions[servo_id]) for servo_id in moved_ids],
                        )
                        started_at = time.monotonic()
                else:
                    started_at = time.monotonic()
                self._publish_action_progress(
                    "moving",
                    stage_index=stage_index,
                    servo_ids=list(moved_ids),
                    start_angles_deg=start_angles,
                    target_angles_deg={
                        str(servo_id): command_angles[str(self.joints[servo_id]["name"])]
                        for servo_id in moved_ids
                    },
                    duration_ms=min(duration_ms, 300) if self.mock else duration_ms,
                    _started_at=started_at,
                )

                if self.mock:
                    was_stopped = self.stop_event.wait(min(duration_ms, 300) / 1000.0)
                    if was_stopped:
                        self._publish_action_progress("stopped")
                        return {"status": "stopped", "group_id": group_id}
                    for servo_id in moved_ids:
                        self._write_cache(servo_id, target_positions[servo_id], "ready")
                    self._publish_action_progress("stage_complete")
                    continue

                if self.stop_event.wait(duration_ms / 1000.0 + 0.05):
                    self._publish_action_progress("stopped")
                    return {"status": "stopped", "group_id": group_id}
                self._publish_action_progress("reading")
                actual_positions = self._read_action_positions(moved_ids)
                if self.stop_event.is_set():
                    self._publish_action_progress("stopped")
                    return {"status": "stopped", "group_id": group_id}
                for servo_id, actual_position in actual_positions.items():
                    if actual_position is None:
                        with self.bus_lock:
                            self.bridge.stop(moved_ids)
                        self._write_cache(servo_id, None, "error", "Position read failed after action pose")
                        raise RuntimeError(f"Position read failed for joint {servo_id + 1}; stop sent")
                    joint = self.joints[servo_id]
                    actual_angle = self.model.positions_to_angles({servo_id: int(actual_position)})[joint["name"]]
                    target_angle = float(step["angles"][str(joint["name"])])
                    error_deg = abs(target_angle - float(actual_angle))
                    status = "ready"
                    if error_deg > float(self.policy.position_error_stop_deg):
                        status = "contact" if servo_id == 5 else "position_error"
                    self._write_cache(servo_id, int(actual_position), status)
                    if status == "contact":
                        contact_ids.append(servo_id)
                    elif status == "position_error":
                        with self.bus_lock:
                            self.bridge.stop(moved_ids)
                        self._publish_action_progress("position_error")
                        return {
                            "status": status,
                            "group_id": group_id,
                            "servo_id": servo_id,
                            "error_deg": round(error_deg, 2),
                        }
                self._publish_action_progress("stage_complete")
            self._publish_action_progress("complete")
            return {
                "status": "complete",
                "group_id": group_id,
                "pose_count": len(raw_frames),
                "contact_ids": contact_ids,
            }
        except Exception as error:
            self._publish_action_progress("error", error=str(error))
            if self.active_action_id == group_id and not self.mock:
                try:
                    self.stop_event.set()
                    with self.bus_lock:
                        self.bridge.stop(self.servo_ids)
                except Exception:
                    pass
            raise
        finally:
            self.active_action_id = None
            # The next normal state request must read the final/stopped pose.
            self.last_poll = 0.0
            self.move_lock.release()

    def _servo_state(self, servo_id: int, position: int | None, status: str = "ready", error: str = "") -> dict[str, Any]:
        joint = self.joints[servo_id]
        angle = None
        pwm = None
        if position is not None:
            pwm = 500 + 2 * int(position)
            angle = self.model.positions_to_angles({servo_id: int(position)})[joint["name"]]
        return {
            "id": servo_id,
            "name": joint["name"],
            "min_deg": float(joint["min_deg"]),
            "max_deg": float(joint["max_deg"]),
            "min_pos": int(joint["min_pos"]),
            "max_pos": int(joint["max_pos"]),
            "center_pos": int(joint["center_pos"]),
            "center_deg": float(joint["center_deg"]),
            "position_scale": float(joint["position_scale"]),
            "direction": int(joint["direction"]),
            "position": int(position) if position is not None else None,
            "pwm": pwm,
            "angle_deg": round(float(angle), 2) if angle is not None else None,
            "online": position is not None,
            "status": status,
            "error": error,
        }

    def _write_cache(self, servo_id: int, position: int | None, status: str = "ready", error: str = "") -> None:
        with self.cache_lock:
            self.state_cache[servo_id] = self._servo_state(servo_id, position, status, error)

    def refresh(self, force: bool = False) -> None:
        """Refresh cached telemetry at most every five seconds across all clients."""
        if self.mock or self.active_id is not None or self.active_action_id is not None:
            return
        now = time.monotonic()
        if not force and now - self.last_poll < 5.0:
            return
        if not self.poll_lock.acquire(blocking=False):
            return
        try:
            if self.active_id is not None or self.active_action_id is not None:
                return
            with self.bus_lock:
                for servo_id in self.servo_ids:
                    try:
                        position = self.bridge.read_position(servo_id)
                    except Exception:
                        position = None
                    self._write_cache(servo_id, position, "ready" if position is not None else "offline")
            self.last_poll = time.monotonic()
        finally:
            self.poll_lock.release()

    def snapshot(self, force: bool = False) -> dict[str, Any]:
        """Return a thread-safe state snapshot for the browser API."""
        self.refresh(force=force)
        with self.cache_lock:
            servos = [dict(self.state_cache[servo_id]) for servo_id in self.servo_ids]
        online_count = sum(1 for servo in servos if servo["online"])
        return {
            "backend": "mock" if self.mock else self.backend,
            "baudrate": int(self.bridge_config.baudrate),
            "connected": online_count == len(self.servo_ids),
            "online_count": online_count,
            "active_id": self.active_id,
            "active_action_id": self.active_action_id,
            "busy": self.active_id is not None or self.active_action_id is not None,
            "servos": servos,
            "calibration": self.calibration,
        }

    def move(self, servo_id: int, angle_deg: float, requested_duration_ms: int = 1000) -> dict[str, Any]:
        """Move one managed servo and verify its reported final position."""
        if servo_id not in self.joints:
            raise ValueError(f"Unknown servo ID {servo_id}")
        if not math.isfinite(angle_deg):
            raise ValueError("angle_deg must be a finite number")
        if not self.move_lock.acquire(blocking=False):
            raise RuntimeError("Another motion is in progress")

        joint = self.joints[servo_id]
        if not float(joint["min_deg"]) <= angle_deg <= float(joint["max_deg"]):
            self.move_lock.release()
            raise ValueError(f"Target angle is outside {joint['min_deg']}..{joint['max_deg']} degrees")

        target_position = self.model.angles_to_positions({joint["name"]: angle_deg})[servo_id]
        try:
            duration = max(int(requested_duration_ms), int(self.policy.min_duration_ms))
            if servo_id in self.policy.heavy_axis_ids:
                duration = max(duration, int(self.policy.heavy_axis_min_duration_ms))
            duration = min(duration, 10000)
            self.stop_event.clear()
            self.active_id = servo_id

            if self.mock:
                time.sleep(min(duration, 300) / 1000.0)
                self._write_cache(servo_id, target_position, "ready")
                return {"status": "complete", "servo": dict(self.state_cache[servo_id]), "duration_ms": duration}

            with self.bus_lock:
                self.bridge.set_positions(duration, [(servo_id, target_position)])
            was_stopped = self.stop_event.wait(duration / 1000.0 + 0.05)
            with self.bus_lock:
                actual_position = self.bridge.read_position(servo_id)
            if actual_position is None:
                with self.bus_lock:
                    self.bridge.stop([servo_id])
                self._write_cache(servo_id, None, "error", "Position read failed after motion")
                raise RuntimeError("Position read failed after motion; stop sent to this servo")

            actual_angle = self.model.positions_to_angles({servo_id: int(actual_position)})[joint["name"]]
            error_deg = abs(float(angle_deg) - float(actual_angle))
            if was_stopped:
                status = "stopped"
            elif servo_id == 5 and error_deg > float(self.policy.position_error_stop_deg):
                status = "contact"
            elif error_deg > float(self.policy.position_error_stop_deg):
                with self.bus_lock:
                    self.bridge.stop([servo_id])
                status = "position_error"
            else:
                status = "ready"
            self._write_cache(servo_id, int(actual_position), status)
            return {
                "status": "position_error" if status == "position_error" else "contact" if status == "contact" else "complete",
                "servo": dict(self.state_cache[servo_id]),
                "target_deg": float(angle_deg),
                "error_deg": round(error_deg, 2),
                "duration_ms": duration,
            }
        finally:
            self.active_id = None
            self.move_lock.release()

    def stop(self) -> None:
        self.stop_event.set()
        if self.active_action_id is not None:
            self._publish_action_progress("stopped")
        if not self.mock:
            with self.bus_lock:
                self.bridge.stop(self.servo_ids)

    def close(self) -> None:
        if self.bridge is not None:
            self.bridge.close()


def create_app(
    config_path: str | Path,
    mock: bool,
    allowed_client_ip: str | None,
) -> FastAPI:
    """Create the browser API and apply the configured client-IP allowlist."""
    control = ArmWebControl(config_path, mock=mock)
    allowed_client = ipaddress.ip_address(allowed_client_ip) if allowed_client_ip else None

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        yield
        control.close()

    app = FastAPI(title="Jibot Arm Studio", docs_url=None, redoc_url=None, lifespan=lifespan)

    def client_is_allowed(request: Request) -> bool:
        client_host = request.client.host if request.client else ""
        try:
            client_address = ipaddress.ip_address(client_host)
        except ValueError:
            return False
        return client_address.is_loopback or client_address == allowed_client

    @app.middleware("http")
    async def restrict_clients(request: Request, call_next):
        if not client_is_allowed(request):
            return JSONResponse(
                status_code=403,
                content={"detail": "Only localhost and the configured browser device may access this demo"},
            )
        return await call_next(request)

    def authorize(request: Request) -> None:
        if not client_is_allowed(request):
            raise HTTPException(status_code=403, detail="Client address is not allowed")

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "jibot-arm-studio"}

    @app.get("/api/state")
    def state(request: Request) -> dict[str, Any]:
        authorize(request)
        return control.snapshot()

    @app.get("/api/motion-progress")
    def motion_progress(request: Request) -> dict[str, Any]:
        authorize(request)
        return control.motion_snapshot()

    @app.post("/api/joints/{servo_id}/move")
    def move_joint(servo_id: int, payload: dict[str, Any], request: Request) -> dict[str, Any]:
        authorize(request)
        try:
            angle_deg = float(payload.get("angle_deg"))
            duration_ms = int(payload.get("duration_ms", 1000))
            result = control.move(servo_id, angle_deg, duration_ms)
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        except RuntimeError as error:
            status_code = 409 if "in progress" in str(error).lower() else 502
            raise HTTPException(status_code=status_code, detail=str(error)) from error
        return result

    @app.get("/api/action-groups")
    def action_groups(request: Request) -> dict[str, Any]:
        authorize(request)
        try:
            return {"groups": control.action_groups()}
        except RuntimeError as error:
            raise HTTPException(status_code=500, detail=str(error)) from error

    @app.get("/api/catalog-action-groups")
    def catalog_action_groups(request: Request) -> dict[str, Any]:
        authorize(request)
        try:
            return control.catalog_action_library()
        except RuntimeError as error:
            raise HTTPException(status_code=500, detail=str(error)) from error

    @app.post("/api/action-groups")
    def create_action_group(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        authorize(request)
        try:
            return {"group": control.create_action_group(payload)}
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        except (OSError, RuntimeError) as error:
            raise HTTPException(status_code=500, detail=str(error)) from error

    @app.delete("/api/action-groups/{group_id}")
    def delete_action_group(group_id: str, request: Request) -> dict[str, str]:
        authorize(request)
        try:
            deleted = control.delete_action_group(group_id)
        except (OSError, RuntimeError) as error:
            raise HTTPException(status_code=500, detail=str(error)) from error
        if not deleted:
            raise HTTPException(status_code=404, detail="Action group not found")
        return {"status": "deleted"}

    @app.post("/api/action-groups/{group_id}/play")
    def play_action_group(group_id: str, payload: dict[str, Any], request: Request) -> dict[str, Any]:
        authorize(request)
        try:
            # Keep single-group API calls conservative; continuous playback can
            # reuse the previous group's verified readback to avoid six extra
            # serial queries at every group boundary.
            refresh_before = payload.get("refresh_before", True)
            if not isinstance(refresh_before, bool):
                raise ValueError("refresh_before must be a boolean")
            return control.play_action_group(group_id, refresh_before=refresh_before)
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        except RuntimeError as error:
            status_code = 409 if "in progress" in str(error).lower() else 502
            raise HTTPException(status_code=status_code, detail=str(error)) from error

    @app.post("/api/stop")
    def stop(request: Request) -> dict[str, str]:
        authorize(request)
        control.stop()
        return {"status": "stopped"}

    app.mount("/", StaticFiles(directory=str(WEB_ROOT), html=True), name="web")
    return app


def main() -> None:
    parser = argparse.ArgumentParser(description="Jibot1 Three.js web control panel")
    parser.add_argument("--config", default="config.yaml", help="path to config.yaml")
    parser.add_argument("--host", default="127.0.0.1", help="bind address")
    parser.add_argument("--port", type=int, default=8080, help="HTTP port")
    parser.add_argument("--mock", action="store_true", help="serve a no-hardware preview with simulated joints")
    args = parser.parse_args()

    local_hosts = {"127.0.0.1", "localhost", "::1"}
    config = load_config(args.config)
    web_config = config.get("web", {}) or {}
    if not isinstance(web_config, dict):
        parser.error("web must be a mapping in config.yaml")
    allowed_client_raw = str(web_config.get("allowed_client_ip", "")).strip()
    if args.host not in local_hosts and not allowed_client_raw:
        parser.error("Set web.allowed_client_ip in config.yaml when binding beyond localhost")
    try:
        allowed_client_ip = str(ipaddress.ip_address(allowed_client_raw)) if allowed_client_raw else None
    except ValueError:
        parser.error("web.allowed_client_ip must be one IPv4 or IPv6 address, without a CIDR suffix")
    if args.host not in local_hosts and allowed_client_ip and ipaddress.ip_address(allowed_client_ip).is_loopback:
        parser.error("web.allowed_client_ip must identify the external browser device; localhost is always allowed")
    if args.mock and args.host not in local_hosts:
        parser.error("--mock mode may only bind to localhost")

    application = create_app(args.config, mock=args.mock, allowed_client_ip=allowed_client_ip)
    uvicorn.run(application, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
