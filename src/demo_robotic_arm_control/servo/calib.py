from __future__ import annotations

from pathlib import Path

import yaml


class CalibrationStore:
    """Read and update the project's YAML joint calibration file."""

    def __init__(self, config_path: str | Path):
        self.config_path = Path(config_path)

    def load(self) -> dict:
        with self.config_path.open("r", encoding="utf-8") as file:
            return yaml.safe_load(file)

    def save(self, data: dict) -> None:
        with self.config_path.open("w", encoding="utf-8") as file:
            yaml.safe_dump(data, file, allow_unicode=True, sort_keys=False)

    def update_joint(self, joint_name: str, **fields: int | float) -> None:
        """Update one named joint while preserving all other configuration data."""
        data = self.load()
        joints = data.get("joints", [])
        for joint in joints:
            if joint.get("name") == joint_name:
                joint.update(fields)
                self.save(data)
                return
        raise KeyError(f"joint not found: {joint_name}")
