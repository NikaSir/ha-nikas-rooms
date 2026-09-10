#!/usr/bin/env python3
"""One-shot exact patch for Rooms audit findings A08, A09 and A10."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "custom_components/nikas_rooms/frontend/nikas-rooms-panel.js"


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path.relative_to(ROOT)}: expected exactly one match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


# UI version and canonical House target.
replace_once(FRONTEND, 'const UI_VERSION = "11.0.13";', 'const UI_VERSION = "11.0.14";')
replace_once(
    FRONTEND,
    'const SAFE_DEFAULT_ROUTE = "/dashboard-house-v11/home";',
    'const SAFE_DEFAULT_ROUTE = "/dashboard-house-v13/home";',
)

# A09: accept the current House v13 while retaining v11/v12 compatibility.
replace_once(
    FRONTEND,
    '''    if (url.pathname === "/dashboard-house-v12" || url.pathname.startsWith("/dashboard-house-v12/")) {
      return "/dashboard-house-v12/home";
    }
    if (url.pathname === "/dashboard-actions" || url.pathname.startsWith("/dashboard-actions/")) {''',
    '''    if (url.pathname === "/dashboard-house-v12" || url.pathname.startsWith("/dashboard-house-v12/")) {
      return "/dashboard-house-v12/home";
    }
    if (url.pathname === "/dashboard-house-v13" || url.pathname.startsWith("/dashboard-house-v13/")) {
      return "/dashboard-house-v13/home";
    }
    if (url.pathname === "/dashboard-actions" || url.pathname.startsWith("/dashboard-actions/")) {''',
)
replace_once(
    FRONTEND,
    '''function isHouseRoute(value) {
  return value === "/dashboard-house-v11/home" || value === "/dashboard-house-v12/home";
}''',
    '''function isHouseRoute(value) {
  return value === "/dashboard-house-v11/home"
    || value === "/dashboard-house-v12/home"
    || value === "/dashboard-house-v13/home";
}''',
)
replace_once(
    FRONTEND,
    '''  return routes.includes("/dashboard-house-v12/home")
    ? "/dashboard-house-v12/home"
    : routes[0] || null;''',
    '''  if (routes.includes("/dashboard-house-v13/home")) return "/dashboard-house-v13/home";
  if (routes.includes("/dashboard-house-v12/home")) return "/dashboard-house-v12/home";
  return routes[0] || null;''',
)

# A08: a cancelled animation-frame handle must not suppress future scheduling after reconnect.
replace_once(
    FRONTEND,
    '''    if (this._stateFrame !== null) window.cancelAnimationFrame(this._stateFrame);
    window.clearTimeout(this._toastTimer);''',
    '''    if (this._stateFrame !== null) window.cancelAnimationFrame(this._stateFrame);
    this._stateFrame = null;
    window.clearTimeout(this._toastTimer);''',
)

# A10: Home Assistant entity.area_id overrides device.area_id. Preserve that entity and the
# device metadata it inherits without moving unrelated entities from the device into the room.
replace_once(
    FRONTEND,
    '''      const areaDevices = devices.filter((device) =>
        device.area_id === area.area_id && !device.disabled_by);
      const areaDeviceIds = new Set(areaDevices.map((device) => device.id));
      const areaEntities = entities.filter((entity) => {
        if (entity.disabled_by || entity.hidden_by || entity.hidden) return false;
        const effectiveArea = entity.area_id || deviceMap.get(entity.device_id)?.area_id || null;
        return effectiveArea === area.area_id
          && (!entity.device_id || areaDeviceIds.has(entity.device_id));
      });

      const roomDevices = areaDevices.filter((device) => admitted(device));
      const deviceIds = new Set(roomDevices.map((device) => device.id));
      const operationalDeviceIds = new Set(
        areaDevices.filter((device) => operational(device)).map((device) => device.id),
      );''',
    '''      const areaDevices = devices.filter((device) =>
        device.area_id === area.area_id && !device.disabled_by);
      const areaDeviceIds = new Set(areaDevices.map((device) => device.id));
      const areaEntities = entities.filter((entity) => {
        if (entity.disabled_by || entity.hidden_by || entity.hidden) return false;
        const device = entity.device_id ? deviceMap.get(entity.device_id) : null;
        if (entity.device_id && (!device || device.disabled_by)) return false;
        const effectiveArea = entity.area_id || device?.area_id || null;
        return effectiveArea === area.area_id;
      });
      const referencedDeviceIds = new Set(
        areaEntities.map((entity) => entity.device_id).filter(Boolean),
      );
      const relevantDeviceIds = new Set([...areaDeviceIds, ...referencedDeviceIds]);
      const relevantDevices = devices.filter((device) =>
        relevantDeviceIds.has(device.id) && !device.disabled_by);

      const roomDevices = relevantDevices.filter((device) => admitted(device));
      const deviceIds = new Set(roomDevices.map((device) => device.id));
      const operationalDeviceIds = new Set(
        relevantDevices.filter((device) => operational(device)).map((device) => device.id),
      );''',
)
replace_once(FRONTEND, '          diagnosticDevices: areaDevices,', '          diagnosticDevices: relevantDevices,')

# Release metadata: integration and UI versions are intentionally independent.
replace_once(
    ROOT / "custom_components/nikas_rooms/manifest.json",
    '"version": "0.1.14"',
    '"version": "0.1.15"',
)
replace_once(
    ROOT / "pyproject.toml",
    'version = "0.1.13"',
    'version = "0.1.15"',
)
replace_once(
    ROOT / "custom_components/nikas_rooms/panel.py",
    'PANEL_PARENT_ROUTE = "/dashboard-house-v11/home"',
    'PANEL_PARENT_ROUTE = "/dashboard-house-v13/home"',
)
replace_once(
    ROOT / "custom_components/nikas_rooms/panel.py",
    'PANEL_UI_VERSION = "11.0.13"',
    'PANEL_UI_VERSION = "11.0.14"',
)
replace_once(
    ROOT / "custom_components/nikas_rooms/panel_manifest.json",
    '"parent_route": "/dashboard-house-v11/home"',
    '"parent_route": "/dashboard-house-v13/home"',
)
replace_once(
    ROOT / "custom_components/nikas_rooms/panel_manifest.json",
    '"ui_version": "11.0.13"',
    '"ui_version": "11.0.14"',
)
replace_once(
    ROOT / "custom_components/nikas_rooms/panel_manifest.json",
    '"home_target": "runtime_detected_nikas-house-overview_v11_or_v12"',
    '"home_target": "runtime_detected_nikas-house-overview_v11_or_v12_or_v13"',
)
replace_once(ROOT / ".nikas-ui-standard.json", '"ui_version": "11.0.13"', '"ui_version": "11.0.14"')

contract = ROOT / "contracts/rooms_v11.yaml"
replace_once(contract, '    safe_return_route: /dashboard-house-v11/home', '    safe_return_route: /dashboard-house-v13/home')
replace_once(contract, '    version: 11.0.13', '    version: 11.0.14')
replace_once(
    contract,
    '''    accepted_house_routes:
      - /dashboard-house-v11/home
      - /dashboard-house-v12/home''',
    '''    accepted_house_routes:
      - /dashboard-house-v11/home
      - /dashboard-house-v12/home
      - /dashboard-house-v13/home''',
)

checks = ROOT / "scripts/check_repository.py"
replace_once(checks, 'manifest["version"] == "0.1.14"', 'manifest["version"] == "0.1.15"')
for old, new in [
    ('panel_manifest["ui_version"] == "11.0.13"', 'panel_manifest["ui_version"] == "11.0.14"'),
    ('standard["ui_version"] == "11.0.13"', 'standard["ui_version"] == "11.0.14"'),
    ('contract["spec"]["ui"]["version"] == "11.0.13"', 'contract["spec"]["ui"]["version"] == "11.0.14"'),
]:
    replace_once(checks, old, new)
replace_once(
    checks,
    '''        'HOUSE_PANEL_COMPONENT = "nikas-house-overview"' in source
        and '.tabs button[aria-label="Дом"]' in source''',
    '''        'HOUSE_PANEL_COMPONENT = "nikas-house-overview"' in source
        and 'SAFE_DEFAULT_ROUTE = "/dashboard-house-v13/home"' in source
        and '"/dashboard-house-v13/home"' in source
        and '.tabs button[aria-label="Дом"]' in source''',
)

# Static frontend contract: current House target plus explicit area-override preservation markers.
frontend_test = ROOT / "tests/test_frontend_contract.py"
replace_once(
    frontend_test,
    '''    assert '"/dashboard-house-v12/home"' in text
    assert "detectedHouseRoute(this._hass)" in text''',
    '''    assert '"/dashboard-house-v12/home"' in text
    assert '"/dashboard-house-v13/home"' in text
    assert 'const SAFE_DEFAULT_ROUTE = "/dashboard-house-v13/home"' in text
    assert "detectedHouseRoute(this._hass)" in text''',
)
append_anchor = '''def test_shipped_brand_asset_is_present() -> None:
'''
insert_tests = '''def test_frontend_preserves_entity_area_override() -> None:
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


'''
replace_once(frontend_test, append_anchor, insert_tests + append_anchor)

# Runtime regression harness: retain v12 compatibility, verify v13 preference, lifecycle recovery,
# and an entity-area override where the backing device belongs to a different Area.
harness = ROOT / "tests/registry_loader_harness.js"
anchor = '''  const diagnosticsMarkupPanel = makePanel({
'''
regressions = '''  const v13NavigationPanel = makePanel({
    panels: {
      "dashboard-house-v12": {
        component_name: "custom",
        config: {
          _panel_custom: { name: "nikas-house-overview" },
          default_path: "/dashboard-house-v12/home",
        },
        url_path: "dashboard-house-v12",
      },
      "dashboard-house-v13": {
        component_name: "custom",
        config: {
          _panel_custom: { name: "nikas-house-overview" },
          default_path: "/dashboard-house-v13/home",
        },
        url_path: "dashboard-house-v13",
      },
    },
  });
  assert.equal(v13NavigationPanel.houseRoute(), "/dashboard-house-v13/home");

  const lifecyclePanel = makePanel({});
  lifecyclePanel._stateFrame = window.setTimeout(() => {}, 60_000);
  lifecyclePanel.disconnectedCallback();
  assert.equal(lifecyclePanel._stateFrame, null, "disconnect must release the cancelled frame handle");

  const areaOverridePanel = new PanelClass();
  areaOverridePanel._hass = { states: {} };
  areaOverridePanel._registries = {
    areas: [
      { area_id: "kitchen", name: "Кухня" },
      { area_id: "garage", name: "Гараж" },
    ],
    devices: [
      {
        id: "remote-device",
        area_id: "garage",
        name: "Выносной датчик",
        labels: ["v_ekspluatatsii"],
      },
    ],
    entities: [
      {
        entity_id: "sensor.kitchen_remote_temperature",
        device_id: "remote-device",
        area_id: "kitchen",
        labels: [],
      },
      {
        entity_id: "sensor.garage_native_temperature",
        device_id: "remote-device",
        labels: [],
      },
    ],
    labels: [],
  };
  areaOverridePanel.buildRooms();
  const kitchenRoom = areaOverridePanel.room("kitchen");
  const garageRoom = areaOverridePanel.room("garage");
  assert.ok(kitchenRoom.entities.some((entity) => entity.entity_id === "sensor.kitchen_remote_temperature"));
  assert.ok(kitchenRoom.diagnosticEntities.some((entity) => entity.entity_id === "sensor.kitchen_remote_temperature"));
  assert.ok(kitchenRoom.devices.some((device) => device.id === "remote-device"));
  assert.ok(!kitchenRoom.entities.some((entity) => entity.entity_id === "sensor.garage_native_temperature"));
  assert.ok(garageRoom.entities.some((entity) => entity.entity_id === "sensor.garage_native_temperature"));
  assert.ok(!garageRoom.entities.some((entity) => entity.entity_id === "sensor.kitchen_remote_temperature"));

'''
replace_once(harness, anchor, regressions + anchor)

changelog = ROOT / "CHANGELOG.md"
text = changelog.read_text(encoding="utf-8")
changelog_anchor = "# Changelog\n\n"
if text.count(changelog_anchor) != 1:
    raise SystemExit("CHANGELOG anchor drift")
entry = '''## 0.1.15 — 2026-09-10 · UI 11.0.14

- A08: после detach сбрасывается handle отменённого `requestAnimationFrame`, поэтому reconnect снова может планировать точечные обновления состояния.
- A09: текущая панель «Дом» `/dashboard-house-v13/home` разрешена как основной safe return; совместимость с v11/v12 сохранена, а runtime detection предпочитает v13.
- A10: явный `entity.area_id` корректно переопределяет `device.area_id`; связанная сущность сохраняет метаданные и ярлыки устройства, но соседние сущности устройства не переносятся в чужое помещение.
- Синхронизирована package metadata: `pyproject.toml` теперь соответствует integration version `0.1.15`.
- Добавлены статические и runtime regression-тесты для lifecycle, навигации v13 и area override.

'''
changelog.write_text(text.replace(changelog_anchor, changelog_anchor + entry, 1), encoding="utf-8")

print("Rooms A08/A09/A10 patch staged")
