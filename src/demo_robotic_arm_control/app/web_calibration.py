"""A fixed physical reference for the web console, independent of source motions."""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

from ..servo import ArmModel


MOD1_POSITION_SCALE = 1000.0 / 270.0


def calibrated_config(config: dict, baseline_path: Path | None) -> tuple[dict, dict[str, Any]]:
    """Apply an optional saved physical reference without changing the source file."""
    result = copy.deepcopy(config)
    baseline = None
    if baseline_path is not None and baseline_path.exists():
        try:
            baseline = json.loads(baseline_path.read_text(encoding="utf-8"))
            if baseline["version"] != 1 or baseline["backend"] != "zl_is2":
                raise ValueError("unsupported baseline format or controller")
            if not isinstance(baseline["saved_at"], str) or not baseline["saved_at"]:
                raise ValueError("missing baseline timestamp")
            positions = baseline["positions"]
            if not isinstance(positions, dict) or set(positions) != {str(j["id"]) for j in config["joints"]}:
                raise ValueError("baseline must contain all six configured servo IDs")
            for joint in config["joints"]:
                pos = positions[str(joint["id"])]
                if type(pos) is not int or not joint["min_pos"] <= pos <= joint["max_pos"]:
                    raise ValueError(f"invalid baseline position for servo {joint['id']}")
                if int(joint["id"]) == 5 and 500 + 2 * pos > 1700:
                    raise ValueError("gripper baseline exceeds the confirmed close limit")
        except (OSError, KeyError, TypeError, ValueError) as error:
            raise RuntimeError(f"Cannot load web calibration: {error}") from error

    # Each joint's measured scale is independent of its soft limits and center.
    # MOD1 is only the fallback when no explicit scale has been configured.
    references = []
    for joint in result["joints"]:
        nominal_center = int(joint["center_pos"])
        scale = float(joint.get("position_scale", MOD1_POSITION_SCALE))
        if baseline is not None:
            joint["center_pos"] = baseline["positions"][str(joint["id"])]
        direction = 1 if int(joint.get("direction", 1)) >= 0 else -1
        center = int(joint["center_pos"])
        center_deg = float(joint.get("center_deg", 0))
        max_position = min(int(joint["max_pos"]), 600) if int(joint["id"]) == 5 else int(joint["max_pos"])
        bounds = [center_deg + (pos - center) / scale * direction for pos in (int(joint["min_pos"]), max_position)]
        joint.update(position_scale=scale, min_deg=min(bounds), max_deg=max(bounds))
        references.append({
            "id": int(joint["id"]),
            "pwm": 500 + 2 * center,
            "offset_pwm": 2 * (center - nominal_center),
            "position_scale": scale,
            "direction": direction,
            "center_deg": center_deg,
        })
    # Evaluate scales before opening a serial port.
    model = ArmModel.from_dict(result)
    model.angles_to_positions(model.default_angles())
    return result, {
        "active": baseline is not None,
        "saved_at": baseline["saved_at"] if baseline else None,
        "angle_mapping": "zl-is2-per-axis-v2",
        "reference_id": json.dumps(references, sort_keys=True, separators=(",", ":")),
        "joints": references,
    }
