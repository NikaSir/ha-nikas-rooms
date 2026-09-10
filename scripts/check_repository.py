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
    for path in sorted(DOMAIN.rglob("*.py")):
        compile(path.read_bytes(), str(path), "exec")

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
    require(manifest["version"] == "0.1.16", "integration version drift")
    require(panel_manifest["ui_version"] == "11.0.15", "panel UI version drift")
    require(standard["ui_version"] == "11.0.15", "standard UI version drift")
    require(contract["spec"]["ui"]["version"] == "11.0.15", "contract UI version drift")
    require(panel_manifest["entry_route"] == "/dashboard-rooms-v11/rooms", "entry route drift")
    require(panel_manifest["preserved_yaml_route"] == "/dashboard-rooms/rooms", "preserved route drift")
    require(standard["version"] == "2.2", "NikaS UI standard drift")
    require(standard["navigation_contract_version"] == "1.2", "navigation contract drift")
    shell_path = DOMAIN / "frontend" / "src" / "shell-v2.js"
    source_path = DOMAIN / "frontend" / "src" / "nikas-rooms-panel.js"
    panel_source = source_path.read_text(encoding="utf-8")
    require(shell_path.is_file() and source_path.is_file(), "v2.2 build sources are missing")
    shell = shell_path.read_text(encoding="utf-8")
    shell_digest = hashlib.sha256(shell_path.read_bytes()).hexdigest()
    require(shell_digest == standard["shell_source_sha256"], "vendored Shell v2.1 hash drift")
    require('const NIKAS_SHELL_V2_VERSION = "2.1"' in source, "production Shell v2.1 source is missing")
    require('<header class="nikas-shell__header header">' in source, "canonical Header class missing")
    require('<main class="nikas-shell__viewport viewport" id="viewport">' in source, "canonical viewport class missing")
    require('<nav class="nikas-shell__tabs tabs"' in source, "canonical Bottom Nav class missing")
    require(source.count('class="nikas-shell__tab"') == 4, "canonical base tab count drift")
    require("position:fixed" not in source, "panel must not bind to browser window")
    require("100vw" not in source and "100vh" not in source and "100dvh" not in source, "browser viewport units are forbidden")
    require("createNikasShellScrollBoundaryGuard" in source, "Shell boundary guard missing")
    require("this._scrollBoundaryGuardCleanup = createNikasShellScrollBoundaryGuard" in source, "boundary guard is not installed")
    require("this._scrollBoundaryGuardCleanup?.();" in source, "boundary guard cleanup missing")
    require("REFRESH_MIN_BUSY_MS = 900" in source and "REFRESH_RESULT_MS = 1400" in source, "Refresh Action timings missing")
    require('this._refreshPhase = success ? "success" : "error"' in source, "Refresh Action result state missing")
    require("mdi:check" in source and "mdi:alert-circle-outline" in source, "Refresh Action result glyphs missing")
    require("prefers-reduced-motion:reduce" in source, "Refresh Action reduced-motion behavior missing")
    require("window.clearTimeout(this._refreshResultTimer)" in source, "Refresh Action timer cleanup missing")
    subprocess.run(["python", str(ROOT / "scripts" / "build_frontend.py"), "--check"], check=True)

    require(source.count("class NikasRoomsV11") == 1, "frontend must contain one panel class")
    require(source.count('customElements.define(ELEMENT_NAME') == 1, "frontend must register one component")
    require("import " not in source and "import(" not in source, "production bundle must be autonomous")
    require("history.back(" not in source, "browser history is not a navigation contract")
    require("hass-toggle-menu" in source and "mdi:menu" in source, "Home Assistant menu control missing")
    require("touchStart(event)" in source and "resetZoom()" in source, "gesture zoom contract missing")
    require(
        'addEventListener("pointerup"' in source
        and 'addEventListener("touchend"' in source
        and "activateControl(button)" in source,
        "mobile activation fallback missing",
    )
    require(
        'HOUSE_PANEL_COMPONENT = "nikas-house-overview"' in source
        and 'SAFE_DEFAULT_ROUTE = "/dashboard-house-v13/home"' in source
        and '"/dashboard-house-v13/home"' in source
        and '.tabs button[aria-label="Дом"]' in source
        and "homeButton.dataset.path = route" in source,
        "new House panel route resolution missing",
    )
    require(
        'class="nikas-shell__title title-return"' in source
        and '<button class="room-card' in source
        and 'data-route-kind="room" data-route-slug="${room.slug}"' in source
        and 'data-route-kind="diagnostics" data-route-slug="${room.slug}"' in source
        and 'data-route-kind="overview"' in source,
        "internal navigation buttons missing",
    )
    require(
        "buildRouteViews()" in source
        and 'this._canvas.querySelectorAll("[data-route-panel]")' in source
        and "panel.hidden = !active" in source
        and "replaceChildren" not in source
        and "window.history.pushState" not in panel_source,
        "internal navigation must switch prebuilt views without replacing the DOM or changing routes",
    )
    require("callService(" not in source and ".turn_on" not in source, "direct commands are forbidden")
    require("/dashboard-rooms/room-" not in source, "frontend must not navigate into preserved YAML")

    subprocess.run(["node", "--check", str(FRONTEND)], check=True)
    subprocess.run(["node", str(ROOT / "tests" / "registry_loader_harness.js")], check=True)
    print("repository checks passed")


if __name__ == "__main__":
    main()
