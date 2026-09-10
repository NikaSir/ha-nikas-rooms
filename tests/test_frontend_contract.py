import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "custom_components" / "nikas_rooms" / "frontend" / "nikas-rooms-panel.js"


def source() -> str:
    return FRONTEND.read_text(encoding="utf-8")


def test_frontend_uses_live_home_assistant_registries() -> None:
    text = source()
    assert "hassRegistrySnapshot()" in text
    assert "this._hass?.areas" in text
    assert "this._hass?.devices" in text
    assert "this._hass?.entities" in text
    for request in (
        "config/area_registry/list",
        "config/device_registry/list",
        "config/entity_registry/list",
        "config/label_registry/list",
    ):
        assert request in text
    assert "function normArea(value)" in text
    assert "buildRooms()" in text


def test_frontend_carries_reference_label_policy() -> None:
    text = source()
    assert 'const ACTIVE_LABEL = "v_ekspluatatsii"' in text
    assert 'const SERVICE_LABEL = "na_obsluzhivanii"' in text
    assert 'const REPLACEMENT_LABEL = "trebuet_zameny"' in text
    assert 'const CLIMATE_LABEL = "datchik_klimata_pomeshcheniia"' in text
    assert '"rezerv"' in text
    assert '"vyvedeno_iz_ekspluatatsii"' in text
    assert "admitted(device)" in text
    assert "operational(device)" in text


def test_frontend_room_definitions_match_the_contract() -> None:
    text = source()
    matches = re.findall(
        r'^\s*\["([a-z]+)", "([0-9.]+)", "([^"]+)", "mdi:[^"]+", [012]\],$',
        text,
        re.MULTILINE,
    )
    contract = yaml.safe_load((ROOT / "contracts" / "rooms_v11.yaml").read_text(encoding="utf-8"))
    expected = [
        (room["slug"], str(room["number"]), room["name"])
        for room in contract["spec"]["rooms"]
    ]
    assert matches == expected


def test_frontend_has_canonical_shell_v21_and_gesture_zoom() -> None:
    text = source()
    assert text.count('<main class="nikas-shell__viewport viewport" id="viewport">') == 1
    assert text.count('<header class="nikas-shell__header header">') == 1
    assert text.count('<nav class="nikas-shell__tabs tabs"') == 1
    assert text.count('class="nikas-shell__tab"') == 4
    assert 'const NIKAS_SHELL_V2_VERSION = "2.1"' in text
    assert "createNikasShellScrollBoundaryGuard" in text
    assert "this._scrollBoundaryGuardCleanup = createNikasShellScrollBoundaryGuard" in text
    assert "this._scrollBoundaryGuardCleanup?.();" in text
    assert "position:fixed" not in text
    assert "100vw" not in text and "100vh" not in text and "100dvh" not in text
    assert "grid-template-rows:calc(60px + env(safe-area-inset-top,0px))" in text
    assert "calc(64px + env(safe-area-inset-bottom,0px))" in text
    assert "hass-toggle-menu" in text
    assert 'icon="mdi:menu"' in text
    assert "touchStart(event)" in text and "touchMove(event)" in text and "touchEnd(event)" in text
    assert "resetZoom()" in text
    assert "0.75, 2" in text
    assert "history.back(" not in text
    assert '<button class="nikas-shell__title title-return"' in text
    assert 'id="navigation-proxy"' in text and "anchor.click()" in text
    assert "import " not in text and "import(" not in text


def test_state_updates_do_not_rebuild_shell() -> None:
    text = source()
    patch = text[text.index("patchStates() {") : text.index("headerModel(")]
    assert "node.textContent = value" in patch
    assert "card.classList.toggle" in patch
    assert "shadowRoot.innerHTML" not in patch
    assert "buildRouteViews()" in text
    assert 'this._canvas.querySelectorAll("[data-route-panel]")' in text
    assert "panel.hidden = !active" in text
    assert "replaceChildren" not in text


def test_frontend_never_navigates_into_preserved_yaml_rooms() -> None:
    text = source()
    assert 'const ROOT_PATH = "/dashboard-rooms-v11/rooms"' in text
    assert "/dashboard-rooms-v11/room-${" in text
    assert "/dashboard-rooms/room-" not in text
    assert "callService(" not in text
    assert 'CustomEvent("hass-more-info"' in text


def test_frontend_resolves_the_runtime_new_house_panel() -> None:
    text = source()
    assert 'const HOUSE_PANEL_COMPONENT = "nikas-house-overview"' in text
    assert "hass?.panels" in text
    assert '"/dashboard-house-v12/home"' in text
    assert '"/dashboard-house-v13/home"' in text
    assert 'const SAFE_DEFAULT_ROUTE = "/dashboard-house-v13/home"' in text
    assert "detectedHouseRoute(this._hass)" in text
    assert '.tabs button[aria-label="Дом"]' in text
    assert "homeButton.dataset.path = route" in text


def test_frontend_preserves_entity_area_override() -> None:
    text = source()
    assert "const effectiveArea = entity.area_id || device?.area_id || null" in text
    assert "const referencedDeviceIds = new Set(" in text
    assert "const relevantDevices = devices.filter" in text
    assert "diagnosticDevices: relevantDevices" in text


def test_disconnect_resets_animation_frame_handle() -> None:
    text = source()
    block = text[text.index("  disconnectedCallback() {") : text.index("\n\n  mountShell() {")]
    assert "window.cancelAnimationFrame(this._stateFrame)" in block
    assert "this._stateFrame = null;" in block


def test_shipped_brand_asset_is_present() -> None:
    icon = ROOT / "custom_components" / "nikas_rooms" / "brand" / "icon.png"
    assert icon.is_file()
    assert icon.stat().st_size > 1_000


def test_refresh_action_contract_v11_is_behavioral() -> None:
    text = source()
    assert "REFRESH_MIN_BUSY_MS = 900" in text
    assert "REFRESH_RESULT_MS = 1400" in text
    assert "async runRegistryRefreshAction()" in text
    assert 'this._refreshPhase = success ? "success" : "error"' in text
    assert 'refresh.classList.toggle("is-busy", busy)' in text
    assert 'refresh.classList.toggle("is-success", phase === "success")' in text
    assert 'refresh.classList.toggle("is-error", phase === "error")' in text
    assert "mdi:check" in text and "mdi:alert-circle-outline" in text
    assert "prefers-reduced-motion:reduce" in text
    assert "window.clearTimeout(this._refreshResultTimer)" in text
    assert "this._viewport.scrollTo({ left: 0, top: scrollTop })" in text


def test_v22_bundle_has_explicit_build_sources() -> None:
    assert (ROOT / "custom_components" / "nikas_rooms" / "frontend" / "src" / "shell-v2.js").is_file()
    assert (ROOT / "custom_components" / "nikas_rooms" / "frontend" / "src" / "nikas-rooms-panel.js").is_file()
    assert (ROOT / "scripts" / "build_frontend.py").is_file()
