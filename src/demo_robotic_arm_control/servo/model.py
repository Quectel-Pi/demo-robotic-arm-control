from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class JointConfig:
    """Map servo positions to angles using a center, scale, and rotation sign.

    ``position_scale`` is controller position units per degree; ``direction``
    determines whether increasing position raises or lowers the angle.
    """

    name: str
    servo_id: int
    center_deg: float
    center_pos: int
    min_deg: float
    max_deg: float
    min_pos: int
    max_pos: int
    direction: int = 1
    position_scale: float | None = None

    @property
    def pos_per_deg(self) -> float:
        """Return servo position units per degree, deriving a fallback if needed."""
        if self.position_scale is not None:
            if not self.position_scale > 0:
                raise ValueError(f"joint {self.name} has an invalid position scale")
            return self.position_scale
        span_deg = self.max_deg - self.min_deg
        if span_deg == 0:
            raise ValueError(f"joint {self.name} has zero degree span")
        return (self.max_pos - self.min_pos) / span_deg

    def clamp_deg(self, degree: float) -> float:
        return max(self.min_deg, min(self.max_deg, degree))

    def clamp_pos(self, position: int) -> int:
        return max(self.min_pos, min(self.max_pos, int(position)))

    def degree_to_position(self, degree: float) -> int:
        """Convert a bounded angle to a bounded servo position around its center."""
        deg = self.clamp_deg(degree)
        delta = (deg - self.center_deg) * self.pos_per_deg * self.direction
        return self.clamp_pos(round(self.center_pos + delta))

    def position_to_degree(self, position: int) -> float:
        """Convert a servo position back to degrees using the same calibration."""
        pos = self.clamp_pos(position)
        delta = (pos - self.center_pos) / self.pos_per_deg
        return self.center_deg + (delta * self.direction)


class ArmModel:
    """Convert complete six-joint poses between degrees and servo positions."""

    def __init__(self, joints: list[JointConfig]):
        if len(joints) != 6:
            raise ValueError("6 joints are required for this arm")
        self._joints = joints
        self._joint_by_name = {joint.name: joint for joint in joints}
        self._joint_by_id = {joint.servo_id: joint for joint in joints}

    @classmethod
    def from_dict(cls, data: dict) -> "ArmModel":
        """Build the calibrated joint map from the YAML configuration data."""
        parsed: list[JointConfig] = []
        for item in data["joints"]:
            parsed.append(
                JointConfig(
                    name=str(item["name"]),
                    servo_id=int(item["id"]),
                    center_deg=float(item.get("center_deg", 0.0)),
                    center_pos=int(item["center_pos"]),
                    min_deg=float(item["min_deg"]),
                    max_deg=float(item["max_deg"]),
                    min_pos=int(item["min_pos"]),
                    max_pos=int(item["max_pos"]),
                    direction=1 if int(item.get("direction", 1)) >= 0 else -1,
                    position_scale=float(item["position_scale"]) if "position_scale" in item else None,
                )
            )
        return cls(parsed)

    def joint_names(self) -> list[str]:
        return [joint.name for joint in self._joints]

    def servo_ids(self) -> list[int]:
        return [joint.servo_id for joint in self._joints]

    def name_to_id(self) -> dict[str, int]:
        return {joint.name: joint.servo_id for joint in self._joints}

    def default_angles(self) -> dict[str, float]:
        return {joint.name: joint.center_deg for joint in self._joints}

    def clamp_angles(self, angles: dict[str, float]) -> dict[str, float]:
        result: dict[str, float] = {}
        for name, value in angles.items():
            joint = self._joint_by_name[name]
            result[name] = joint.clamp_deg(float(value))
        return result

    def angles_to_positions(self, angles: dict[str, float]) -> dict[int, int]:
        """Fill unspecified joints with their configured centers before conversion."""
        resolved = self.default_angles()
        resolved.update(angles)
        return {
            joint.servo_id: joint.degree_to_position(float(resolved[joint.name]))
            for joint in self._joints
        }

    def positions_to_angles(self, id_to_pos: dict[int, int]) -> dict[str, float]:
        result: dict[str, float] = {}
        for servo_id, position in id_to_pos.items():
            joint = self._joint_by_id[int(servo_id)]
            result[joint.name] = joint.position_to_degree(int(position))
        return result
