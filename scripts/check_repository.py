#!/usr/bin/env python3
"""Run deterministic repository-level release checks."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
DOMAIN = ROOT / "custom_components" / "nikas_rooms"
FRONTEND = DOMAIN / "frontend" / "nikas-rooms-panel.js"
REFERENCE = ROOT / "references" / "Home_Assistant_Rooms_v10_8_18_PRIMARY_CLIMATE_LABEL.yaml"
REFERENCE_SHA256 = "a9bceb0a48edd0932e6099149d55e5bde5bc9f6b427b906a4648c493229149a0"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def main() -> None:
    manifest = json.loads((DOMAIN / "manifest.json").read_text(encoding="utf-8"))
    panel_manifest = json.loads((DOMAIN / "panel_manifest.json").read_text(encoding="utf-8"))
    standard = json.loads((ROOT / ".nikas-ui-standard.json").read_text(encoding="utf-8"))
    contract = yaml.safe_load((ROOT / "contracts" / "rooms_v11.yaml").read_text(encoding="utf-8"))
    reference = yaml.safe_load(REFERENCE.read_text(encoding="utf-8"))
    source = FRONTEND.read_text(encoding="utf-8")

    digest = hashlib.sha256(REFERENCE.read_bytes()).hexdigest()
    require(digest == REFERENCE_SHA256, "reference YAML differs from the approved v10.8.18 source")
    require(reference.get("title") == "Помещения", "reference YAML title changed")
    require(len(reference.get("views", [])) == 19, "reference YAML must contain overview plus 18 rooms")

    require(manifest["domain"] == "nikas_rooms", "integration domain drift")
    require(manifest["version"] == "0.1.3", "integration version drift")
    require(panel_manifest["ui_version"] == "11.0.3", "panel UI version drift")
    require(standard["ui_version"] == "11.0.3", "standard UI version drift")
    require(contract["spec"]["ui"]["version"] == "11.0.3", "contract UI version drift")
    require(panel_manifest["entry_route"] == "/dashboard-rooms-v11/rooms", "entry route drift")
    require(panel_manifest["preserved_yaml_route"] == "/dashboard-rooms/rooms", "preserved route drift")

    require(source.count("class NikasRoomsV11") == 1, "frontend must contain one panel class")
    require(source.count('customElements.define(ELEMENT_NAME') == 1, "frontend must register one component")
    require("import " not in source and "import(" not in source, "production bundle must be autonomous")
    require("history.back(" not in source, "browser history is not a navigation contract")
    require("hass-toggle-menu" in source and "mdi:menu" in source, "Home Assistant menu control missing")
    require("touchStart(event)" in source and "resetZoom()" in source, "gesture zoom contract missing")
    require(
        'addEventListener("pointerup"' in source and "activateControl(button)" in source,
        "mobile activation fallback missing",
    )
    require(
        'HOUSE_PANEL_COMPONENT = "nikas-house-overview"' in source
        and "this.navigate(this.houseRoute())" in source,
        "new House panel route resolution missing",
    )
    require("callService(" not in source and ".turn_on" not in source, "direct commands are forbidden")
    require("/dashboard-rooms/room-" not in source, "frontend must not navigate into preserved YAML")

    subprocess.run(["node", "--check", str(FRONTEND)], check=True)
    subprocess.run(["node", str(ROOT / "tests" / "registry_loader_harness.js")], check=True)
    print("repository checks passed")


if __name__ == "__main__":
    main()
