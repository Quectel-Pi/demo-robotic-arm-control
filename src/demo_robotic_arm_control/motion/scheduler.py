from __future__ import annotations

from dataclasses import dataclass

from .traj import compute_duration_ms


@dataclass(slots=True)
class SafetyPolicy:
    """Motion limits used to stage concurrent joints and detect bad feedback."""

    vin_low_mv: int = 7000
    vin_stop_mv: int = 6800
    max_parallel_axes: int = 3
    min_duration_ms: int = 800
    heavy_axis_ids: tuple[int, ...] = (1, 2)
    heavy_axis_min_duration_ms: int = 1200
    position_error_stop_deg: float = 8.0


@dataclass(slots=True)
class MotionFrame:
    """One staged joint pose and the time allowed to reach it."""

    angles: dict[str, float]
    duration_ms: int


class MotionScheduler:
    """Build staged poses that keep heavy joints from moving together."""

    def __init__(self, policy: SafetyPolicy):
        self.policy = policy

    def build_frames(
        self,
        current_angles: dict[str, float],
        target_angles: dict[str, float],
        joint_name_to_id: dict[str, int],
        speed_deg_s: float = 45.0,
        pause_ms: int = 200,
    ) -> list[MotionFrame]:
        """Group changed axes, preserve the other joints, and add stage pauses."""
        changed_names = [
            name
            for name, target in target_angles.items()
            if abs(float(target) - float(current_angles.get(name, target))) > 1e-6
        ]
        if not changed_names:
            return []

        groups = self._group_by_policy(changed_names, joint_name_to_id)
        frames: list[MotionFrame] = []
        current = dict(current_angles)

        for index, group in enumerate(groups):
            stage_target = dict(current)
            for joint_name in group:
                stage_target[joint_name] = float(target_angles[joint_name])

            duration_ms = compute_duration_ms(
                current=current,
                target=stage_target,
                speed_deg_s=speed_deg_s,
                min_duration_ms=self.policy.min_duration_ms,
            )
            if self._contains_heavy_axis(group, joint_name_to_id):
                duration_ms = max(duration_ms, self.policy.heavy_axis_min_duration_ms)

            frames.append(MotionFrame(angles=stage_target, duration_ms=duration_ms))
            current = stage_target

            if index != len(groups) - 1 and pause_ms > 0:
                frames.append(MotionFrame(angles=dict(current), duration_ms=int(pause_ms)))

        return frames

    def should_stop(self, vin_mv: int | None, position_error_deg: float | None = None) -> bool:
        """Report whether available feedback crosses a configured stop threshold."""
        if vin_mv is not None and int(vin_mv) < self.policy.vin_stop_mv:
            return True
        if position_error_deg is not None and float(position_error_deg) > self.policy.position_error_stop_deg:
            return True
        return False

    def _group_by_policy(self, joint_names: list[str], joint_name_to_id: dict[str, int]) -> list[list[str]]:
        # Limit each stage to the configured axis count and keep the two heavy
        # shoulder/elbow axes in separate stages to reduce simultaneous load.
        groups: list[list[str]] = []
        current_group: list[str] = []
        has_heavy = False

        for joint_name in joint_names:
            joint_id = joint_name_to_id[joint_name]
            is_heavy = joint_id in self.policy.heavy_axis_ids
            next_count = len(current_group) + 1
            next_heavy = has_heavy or is_heavy

            need_flush = (
                next_count > self.policy.max_parallel_axes
                or (is_heavy and has_heavy)
                or (next_heavy and next_count > self.policy.max_parallel_axes)
            )
            if need_flush and current_group:
                groups.append(current_group)
                current_group = []
                has_heavy = False

            current_group.append(joint_name)
            has_heavy = has_heavy or is_heavy

        if current_group:
            groups.append(current_group)
        return groups

    def _contains_heavy_axis(self, group: list[str], joint_name_to_id: dict[str, int]) -> bool:
        for joint_name in group:
            if joint_name_to_id[joint_name] in self.policy.heavy_axis_ids:
                return True
        return False
