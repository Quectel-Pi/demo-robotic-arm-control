from __future__ import annotations

import math


def max_delta_deg(current: dict[str, float], target: dict[str, float]) -> float:
    """Return the largest joint-angle change in a pose transition."""
    max_delta = 0.0
    for name, target_value in target.items():
        current_value = float(current.get(name, target_value))
        max_delta = max(max_delta, abs(float(target_value) - current_value))
    return max_delta


def compute_duration_ms(
    current: dict[str, float],
    target: dict[str, float],
    speed_deg_s: float,
    min_duration_ms: int,
) -> int:
    """Choose a duration from the largest joint delta and configured minimum."""
    speed = max(1e-6, float(speed_deg_s))
    delta = max_delta_deg(current, target)
    raw_ms = int(math.ceil((delta / speed) * 1000.0))
    return max(int(min_duration_ms), raw_ms)


def interpolate_linear(
    current: dict[str, float],
    target: dict[str, float],
    max_step_deg: float,
) -> list[dict[str, float]]:
    """Split a pose transition into synchronized linear angle steps."""
    if max_step_deg <= 0:
        raise ValueError("max_step_deg must be positive")
    delta = max_delta_deg(current, target)
    if delta == 0:
        return [dict(target)]
    steps = max(1, int(math.ceil(delta / max_step_deg)))
    frames: list[dict[str, float]] = []
    for index in range(1, steps + 1):
        ratio = index / steps
        frame: dict[str, float] = {}
        for name, target_value in target.items():
            start = float(current.get(name, target_value))
            frame[name] = start + (float(target_value) - start) * ratio
        frames.append(frame)
    return frames
