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


def test_frontend_has_autonomous_fixed_shell_and_gesture_zoom() -> None:
    text = source()
    assert text.count('<main class="viewport" id="viewport">') == 1
    assert text.count('<header class="header">') == 1
    assert text.count('<nav class="tabs"') == 1
    assert "hass-toggle-menu" in text
    assert 'icon="mdi:menu"' in text
    assert "touchStart(event)" in text
    assert "touchMove(event)" in text
    assert "touchEnd(event)" in text
    assert "resetZoom()" in text
    assert "0.75, 2" in text
    assert "grid-template-columns:52px minmax(0,1fr) 52px" in text
    assert "blur(18px) saturate(130%)" in text
    assert "--mdc-icon-size:28px" in text
    assert "history.back(" not in text
    assert "import " not in text
    assert "import(" not in text


def test_state_updates_do_not_rebuild_shell() -> None:
    text = source()
    patch = text[text.index("patchStates() {") : text.index("headerModel(")]
    assert "node.textContent = value" in patch
    assert "card.classList.toggle" in patch
    assert "shadowRoot.innerHTML" not in patch
    assert "this._viewCache = new Map()" in text
    assert "this._canvas.replaceChildren(view)" in text


def test_frontend_never_navigates_into_preserved_yaml_rooms() -> None:
    text = source()
    assert 'const ROOT_PATH = "/dashboard-rooms-v11/rooms"' in text
    assert "/dashboard-rooms-v11/room-${" in text
    assert "/dashboard-rooms/room-" not in text
    assert "callService(" not in text
    assert 'CustomEvent("hass-more-info"' in text


def test_shipped_brand_asset_is_present() -> None:
    icon = ROOT / "custom_components" / "nikas_rooms" / "brand" / "icon.png"
    assert icon.is_file()
    assert icon.stat().st_size > 1_000
