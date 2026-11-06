from __future__ import annotations

from pathlib import Path
from typing import Literal

import yaml

from ..board import ZLIS2Bridge, ZLIS2BridgeConfig
from ..motion import SafetyPolicy
from ..servo import ArmModel


BridgeBackend = Literal["zl_is2"]


def load_config(path: str | Path) -> dict:
    """Load the YAML configuration used by the web console."""
    with Path(path).open("r", encoding="utf-8") as file:
        return yaml.safe_load(file)


def build_stack(config: dict) -> tuple[BridgeBackend, ZLIS2BridgeConfig, ArmModel, SafetyPolicy]:
    """Validate the configured ZL-IS2 backend and build its runtime settings."""
    serial_cfg = config.get("serial", {})
    backend_raw = str(serial_cfg.get("backend", "zl_is2")).strip().lower()
    # Accept common spellings while always constructing the same ZL-IS2 bridge.
    aliases: dict[str, BridgeBackend] = {
        "zl-is2": "zl_is2",
        "zlis2": "zl_is2",
        "zl_is2": "zl_is2",
    }
    backend = aliases.get(backend_raw)
    if backend is None:
        raise ValueError(
            "unsupported serial.backend="
            + repr(backend_raw)
            + ", expected: zl_is2"
        )

    bridge_cfg = ZLIS2BridgeConfig(
        serial_port=str(serial_cfg.get("port", "/dev/ttyS1")),
        baudrate=int(serial_cfg.get("baudrate", 115200)),
        timeout_sec=float(serial_cfg.get("timeout_sec", 0.05)),
        read_timeout_sec=float(serial_cfg.get("read_timeout_sec", 0.6)),
    )
    model = ArmModel.from_dict(config)

    safety_cfg = config.get("safety", {})
    policy = SafetyPolicy(
        vin_low_mv=int(safety_cfg.get("vin_low_mv", 7000)),
        vin_stop_mv=int(safety_cfg.get("vin_stop_mv", 6800)),
        max_parallel_axes=int(safety_cfg.get("max_parallel_axes", 3)),
        min_duration_ms=int(safety_cfg.get("min_duration_ms", 800)),
        heavy_axis_ids=tuple(int(i) for i in safety_cfg.get("heavy_axis_ids", [1, 2])),
        heavy_axis_min_duration_ms=int(safety_cfg.get("heavy_axis_min_duration_ms", 1200)),
    )
    return backend, bridge_cfg, model, policy


def open_bridge(backend: BridgeBackend, bridge_cfg: ZLIS2BridgeConfig) -> ZLIS2Bridge:
    """Open the single supported physical servo-controller backend."""
    if backend != "zl_is2" or not isinstance(bridge_cfg, ZLIS2BridgeConfig):
        raise TypeError("ZL-IS2 bridge configuration required")
    return ZLIS2Bridge(bridge_cfg)
