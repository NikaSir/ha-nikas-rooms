#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOMAIN = ROOT / "custom_components" / "nikas_rooms"
FRONTEND = DOMAIN / "frontend"
SOURCE_DIR = FRONTEND / "src"
PRODUCTION = FRONTEND / "nikas-rooms-panel.js"
SOURCE = SOURCE_DIR / "nikas-rooms-panel.js"
SHELL = SOURCE_DIR / "shell-v2.js"
OLD_INTEGRATION = "0.1.15"
NEW_INTEGRATION = "0.1.16"
OLD_UI = "11.0.14"
NEW_UI = "11.0.15"
CANONICAL_SHELL_URL = "https://raw.githubusercontent.com/NikaSir/ha-contract-generated-ui/main/templates/shell_v2/nikas-specialized-shell.js"
STANDARD_SHA = "2a15e5c2483f0fa959faff54cd29144ddb8c392e6da4546bd4c5034bf652c2c7"
NAV_SHA = "79923d2de82ef59ab76e37491f75ba7eb7e7c4c23e62d75142744159cae64229"
REFRESH_SHA = "69f73e9d5949a2564f2bcef3059039cc339c12c9e8dfe71cfa9f24a45b78d2a8"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, got {count}")
    return text.replace(old, new, 1)


# Preserve the approved monolithic panel as the source, then make delivery deterministic.
source = read(PRODUCTION)
SOURCE_DIR.mkdir(parents=True, exist_ok=True)

with urllib.request.urlopen(CANONICAL_SHELL_URL, timeout=30) as response:
    shell = response.read().decode("utf-8")
if 'const NIKAS_SHELL_V2_VERSION = "2.1";' not in shell:
    raise SystemExit("canonical Shell v2.1 guard failed")
write(SHELL, shell)
shell_sha = hashlib.sha256(shell.encode("utf-8")).hexdigest()

# Version and refresh timing constants.
source = replace_once(source, f'const UI_VERSION = "{OLD_UI}";', f'const UI_VERSION = "{NEW_UI}";', "UI version")
source = replace_once(
    source,
    "const DIRECT_TOUCH_THRESHOLD_PX = 10;\n",
    "const DIRECT_TOUCH_THRESHOLD_PX = 10;\nconst REFRESH_MIN_BUSY_MS = 900;\nconst REFRESH_RESULT_MS = 1400;\n",
    "refresh constants",
)

# Lifecycle state for canonical boundary guard and Refresh Action Contract v1.1.
source = replace_once(
    source,
    "    this._toastTimer = null;\n    this._returnRoute = null;\n",
    "    this._toastTimer = null;\n    this._refreshPhase = \"idle\";\n    this._refreshRequestId = 0;\n    this._refreshResultTimer = null;\n    this._scrollBoundaryGuardCleanup = null;\n    this._returnRoute = null;\n",
    "constructor lifecycle",
)
source = replace_once(
    source,
    "  connectedCallback() {\n    this.mountShell();\n",
    "  connectedCallback() {\n    this.mountShell();\n    this._scrollBoundaryGuardCleanup?.();\n    this._scrollBoundaryGuardCleanup = createNikasShellScrollBoundaryGuard({ host: this, viewport: this._viewport });\n",
    "connected boundary guard",
)
source = replace_once(
    source,
    "    window.clearTimeout(this._toastTimer);\n    window.clearTimeout(this._registryRetryTimer);\n",
    "    window.clearTimeout(this._toastTimer);\n    window.clearTimeout(this._registryRetryTimer);\n    window.clearTimeout(this._refreshResultTimer);\n    this._refreshResultTimer = null;\n    this._refreshRequestId += 1;\n    this._refreshPhase = \"idle\";\n    this._scrollBoundaryGuardCleanup?.();\n    this._scrollBoundaryGuardCleanup = null;\n",
    "disconnect cleanup",
)

# Canonical Shell v2.1 DOM geometry while keeping legacy class names for panel-specific styling.
source = replace_once(source, '<style>${this.styles()}</style>', '<style>${this.styles()}${nikasShellV2Styles()}</style>', "shell styles")
source = replace_once(source, '<div class="app">', '<div class="nikas-shell app" style="--nikas-shell-tab-count:4">', "shell root")
source = replace_once(source, '<header class="header">', '<header class="nikas-shell__header header">', "header class")
source = replace_once(source, '<button class="shell-button menu"', '<button class="nikas-shell__side-action shell-button menu"', "menu class")
source = replace_once(source, '<button class="title-return"', '<button class="nikas-shell__title title-return"', "title class")
source = replace_once(source, '<button class="shell-button refresh"', '<button class="nikas-shell__side-action nikas-shell__side-action--right shell-button refresh"', "refresh class")
source = replace_once(source, '<main class="viewport" id="viewport">', '<main class="nikas-shell__viewport viewport" id="viewport">', "viewport class")
source = replace_once(source, '<section class="canvas" id="canvas">\n            <div class="loading">Загрузка помещений…</div>\n          </section>', '<section class="nikas-shell__canvas canvas" id="canvas">\n            <div class="nikas-shell__content"><div class="loading">Загрузка помещений…</div></div>\n          </section>', "canvas class")
source = replace_once(source, '<nav class="tabs" aria-label="Основные панели NikaS">', '<nav class="nikas-shell__tabs tabs" aria-label="Основные панели NikaS">', "tabs class")
source = source.replace('<button type="button" data-path="${this.houseRoute()}" aria-label="Дом">', '<button class="nikas-shell__tab" type="button" data-path="${this.houseRoute()}" aria-label="Дом">', 1)
source = source.replace('<button type="button" data-route-kind="overview" aria-label="Помещения">', '<button class="nikas-shell__tab" type="button" data-route-kind="overview" aria-label="Помещения">', 1)
source = source.replace('<button type="button" data-path="/dashboard-actions/home" aria-label="Действия">', '<button class="nikas-shell__tab" type="button" data-path="/dashboard-actions/home" aria-label="Действия">', 1)
source = source.replace('<button type="button" data-path="/dashboard-infrastructure/overview" aria-label="Инфраструктура">', '<button class="nikas-shell__tab" type="button" data-path="/dashboard-infrastructure/overview" aria-label="Инфраструктура">', 1)
if source.count('class="nikas-shell__tab"') != 4:
    raise SystemExit("canonical bottom tab class count drift")

# Refresh activations use the v1.1 state machine.
source = replace_once(
    source,
    '    if (button.classList?.contains("refresh") || button.dataset?.registryRetry !== undefined) {\n      this.loadRegistries(true);\n      return true;\n    }\n',
    '    if (button.classList?.contains("refresh") || button.dataset?.registryRetry !== undefined) {\n      void this.runRegistryRefreshAction();\n      return true;\n    }\n',
    "refresh activation",
)

refresh_method = '''  async runRegistryRefreshAction() {\n    if (this._refreshPhase === "busy" || this._loading) return;\n    const requestId = ++this._refreshRequestId;\n    window.clearTimeout(this._refreshResultTimer);\n    this._refreshResultTimer = null;\n    this._refreshPhase = "busy";\n    const startedAt = Date.now();\n    const routeKey = this.routeKey(this._activeRoute || this.route());\n    const scrollTop = Number(this._viewport?.scrollTop) || 0;\n    this.syncRefreshState();\n\n    const success = await this.loadRegistries(true);\n    if (routeKey === this.routeKey(this._activeRoute || this.route()) && this._viewport) {\n      this._viewport.scrollTo({ left: 0, top: scrollTop });\n    }\n    const remaining = Math.max(0, REFRESH_MIN_BUSY_MS - (Date.now() - startedAt));\n    if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining));\n    if (requestId !== this._refreshRequestId || !this.isConnected) return;\n\n    this._refreshPhase = success ? "success" : "error";\n    this.syncRefreshState();\n    this._refreshResultTimer = window.setTimeout(() => {\n      if (requestId !== this._refreshRequestId) return;\n      this._refreshResultTimer = null;\n      this._refreshPhase = "idle";\n      this.syncRefreshState();\n    }, REFRESH_RESULT_MS);\n  }\n\n'''
marker = "  async loadRegistries(force = false) {\n"
if marker not in source:
    raise SystemExit("loadRegistries insertion point missing")
source = source.replace(marker, refresh_method + marker, 1)

# Make registry refresh return a truthful result for success/error presentation.
source = replace_once(source, "      this.applyRegistrySnapshot(snapshot, force);\n      return;\n", "      this.applyRegistrySnapshot(snapshot, force);\n      return true;\n", "snapshot refresh result")
source = replace_once(source, "    if (this._loading) return;\n", "    if (this._loading) return false;\n", "loading refresh result")
no_transport = '''      this.scheduleRegistryRetry();\n      return;\n    }\n\n    const loadId = ++this._registryLoadId;'''
no_transport_new = '''      this.scheduleRegistryRetry();\n      if (force) {\n        this._registryFailed = true;\n        this.syncRefreshState();\n      }\n      return false;\n    }\n\n    const loadId = ++this._registryLoadId;'''
source = replace_once(source, no_transport, no_transport_new, "transport refresh result")
source = replace_once(source, "      this.loadOptionalLabels(loadId);\n    } catch (error) {\n", "      this.loadOptionalLabels(loadId);\n      return true;\n    } catch (error) {\n", "success refresh result")
source = replace_once(source, "      this.scheduleRegistryRetry();\n    } finally {\n", "      this.scheduleRegistryRetry();\n      return false;\n    } finally {\n", "failure refresh result")

# Complete refresh feedback is point-patched into the existing Header action.
pattern = re.compile(r"  syncRefreshState\(\) \{.*?\n  \}\n", re.S)
refresh_sync = '''  syncRefreshState() {\n    const refresh = this.shadowRoot?.querySelector(".refresh");\n    if (!refresh) return;\n    const phase = this._refreshPhase;\n    const busy = phase === "busy" || (phase === "idle" && this._loading);\n    const iconName = phase === "success"\n      ? "mdi:check"\n      : phase === "error"\n        ? "mdi:alert-circle-outline"\n        : "mdi:refresh";\n    const label = phase === "success"\n      ? "Помещения обновлены"\n      : phase === "error"\n        ? "Ошибка обновления — нажмите, чтобы повторить"\n        : busy\n          ? "Помещения обновляются"\n          : "Обновить";\n    if (refresh.disabled !== busy) refresh.disabled = busy;\n    refresh.classList.toggle("is-busy", busy);\n    refresh.classList.toggle("is-success", phase === "success");\n    refresh.classList.toggle("is-error", phase === "error");\n    const icon = refresh.querySelector("ha-icon");\n    if (icon?.getAttribute("icon") !== iconName) icon?.setAttribute("icon", iconName);\n    const ariaBusy = String(busy);\n    if (refresh.getAttribute("aria-busy") !== ariaBusy) refresh.setAttribute("aria-busy", ariaBusy);\n    if (refresh.getAttribute("aria-label") !== label) refresh.setAttribute("aria-label", label);\n    if (refresh.title !== label) refresh.title = label;\n  }\n'''
source, count = pattern.subn(refresh_sync, source, count=1)
if count != 1:
    raise SystemExit(f"syncRefreshState replacement count={count}")

# Content frame and canonical class must survive internal route rebuilds.
source = replace_once(
    source,
    '    canvas.innerHTML = `\n      <div class="loading registry-message">',
    '    canvas.innerHTML = `\n      <div class="nikas-shell__content"><div class="loading registry-message">',
    "registry message wrapper open",
)
source = replace_once(source, '      </div>`;\n  }\n\n  scheduleRegistryRetry()', '      </div></div>`;\n  }\n\n  scheduleRegistryRetry()', "registry message wrapper close")
source = replace_once(source, '    this._canvas.className = `canvas ${route.kind}`;', '    this._canvas.className = `nikas-shell__canvas canvas ${route.kind}`;', "canvas route class")
source = replace_once(source, '    this._canvas.innerHTML = panels.join("");', '    this._canvas.innerHTML = `<div class="nikas-shell__content">${panels.join("")}</div>`;', "route content frame")

# Remove browser-window ownership from the old style layer; canonical shell follows it and is authoritative.
source = replace_once(
    source,
    "        position:fixed;inset:0;z-index:1;display:block;min-width:0;min-height:0;\n",
    "        position:relative;display:block;width:100%;height:100%;min-width:0;min-height:0;\n",
    "host boundary",
)
# Align fallback structural dimensions to canonical values even before canonical overrides.
source = source.replace("grid-template-rows:calc(62px + env(safe-area-inset-top,0px))", "grid-template-rows:calc(60px + env(safe-area-inset-top,0px))", 1)
source = source.replace("calc(70px + env(safe-area-inset-bottom,0px));", "calc(64px + env(safe-area-inset-bottom,0px));", 1)
# Result-state visuals have higher specificity than the canonical idle color and preserve geometry.
style_anchor = "      *{box-sizing:border-box}\n"
source = replace_once(
    source,
    style_anchor,
    style_anchor
    + "      @keyframes nikas-refresh-spin{to{transform:rotate(360deg)}}\n"
    + "      .refresh.is-busy ha-icon{animation:nikas-refresh-spin .8s linear infinite}\n"
    + "      .refresh.is-success{color:#43a047}\n"
    + "      .refresh.is-error{color:#e53935}\n"
    + "      @media (prefers-reduced-motion:reduce){.refresh.is-busy ha-icon{animation:none}}\n",
    "refresh styles",
)

write(SOURCE, source)

# Deterministic autonomous build; runtime imports remain forbidden.
build_script = '''#!/usr/bin/env python3\nfrom __future__ import annotations\n\nimport argparse\nfrom pathlib import Path\n\nROOT = Path(__file__).resolve().parents[1]\nFRONTEND = ROOT / "custom_components" / "nikas_rooms" / "frontend"\nSHELL = FRONTEND / "src" / "shell-v2.js"\nSOURCE = FRONTEND / "src" / "nikas-rooms-panel.js"\nOUTPUT = FRONTEND / "nikas-rooms-panel.js"\nBANNER = "/* NikaS Rooms UI v11.0.15 · NikaS UI Standard v2.2 · Shell v2.1 */\\n"\n\ndef render() -> str:\n    return BANNER + SHELL.read_text(encoding="utf-8").rstrip() + "\\n\\n" + SOURCE.read_text(encoding="utf-8").lstrip()\n\ndef main() -> None:\n    parser = argparse.ArgumentParser()\n    parser.add_argument("--check", action="store_true")\n    args = parser.parse_args()\n    expected = render()\n    if args.check:\n        if not OUTPUT.exists() or OUTPUT.read_text(encoding="utf-8") != expected:\n            raise SystemExit("frontend bundle is stale; run python scripts/build_frontend.py")\n        print("frontend bundle is current")\n        return\n    OUTPUT.write_text(expected, encoding="utf-8")\n    print(f"built {OUTPUT}")\n\nif __name__ == "__main__":\n    main()\n'''
write(ROOT / "scripts" / "build_frontend.py", build_script)

# Repository-level declaration.
standard_path = ROOT / ".nikas-ui-standard.json"
standard = json.loads(read(standard_path))
standard["version"] = "2.2"
standard["navigation_contract_version"] = "1.2"
standard["canonical_repository"] = "NikaSir/ha-contract-generated-ui"
standard["standard_path"] = "NIKAS_SPECIALIZED_PANEL_UI_STANDARD.md"
standard["standard_sha256"] = STANDARD_SHA
standard["navigation_contract_path"] = "docs/NIKAS_PANEL_NAVIGATION_CONTRACT.md"
standard["navigation_contract_sha256"] = NAV_SHA
standard["build_source_files"] = [
    "custom_components/nikas_rooms/frontend/src/shell-v2.js",
    "custom_components/nikas_rooms/frontend/src/nikas-rooms-panel.js",
]
standard["ui_version"] = NEW_UI
standard["shell_source_sha256"] = shell_sha
standard["shell_contract"] = {
    "version": "2.1",
    "host_boundary": "ha-panel",
    "header_body_px": 60,
    "peer_selector_px": 52,
    "bottom_nav_body_px": 64,
    "content_max_width_px": 1280,
    "coordinate_tolerance_px": 2,
    "scroll_boundary_guard": "capture-non-passive-touchmove",
    "specialized_tab_range": [3, 5],
}
standard["refresh_action_feedback"] = {
    "version": "1.1",
    "status": "implemented",
    "path": "docs/NIKAS_REFRESH_ACTION_CONTRACT.md",
    "sha256": REFRESH_SHA,
    "minimum_visible_ms": 900,
    "result_visible_ms": 1400,
    "duplicate_activation": "blocked_while_busy",
    "retry_during_result": True,
    "disconnect_cleanup": True,
    "reduced_motion": "static_busy_surface",
    "success_semantics": "required_registry_refresh_explicitly_succeeded",
    "context_preservation": ["header", "active_route", "viewport", "scroll", "zoom"],
}
standard["peer_device_selector"] = {"present": False, "reason": "Rooms is an area selector, not a peer physical-device selector"}
write(standard_path, json.dumps(standard, ensure_ascii=False, indent=2) + "\n")

manifest_path = DOMAIN / "manifest.json"
manifest = json.loads(read(manifest_path))
manifest["version"] = NEW_INTEGRATION
write(manifest_path, json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")

panel_manifest_path = DOMAIN / "panel_manifest.json"
panel_manifest = json.loads(read(panel_manifest_path))
panel_manifest["ui_version"] = NEW_UI
panel_manifest["template_version"] = "2.2"
panel_manifest["shell"].update({
    "header_grid_px": [52, 0, 52],
    "header_button_px": 44,
    "header_icon_px": 25,
    "bottom_tab_min_height_px": 52,
    "bottom_icon_px": 26,
    "phone_shell": "ha_panel_bound_shell_v2_1",
    "outer_document_scroll": False,
    "header_body_px": 60,
    "bottom_nav_body_px": 64,
    "content_max_width_px": 1280,
    "scroll_boundary_guard": "capture_non_passive_touchmove",
})
panel_manifest["rendering"]["registry_refresh"] = "rebuild_internal_views_inside_stable_shell_and_restore_scroll"
panel_manifest["refresh_action"] = {
    "contract_version": "1.1",
    "minimum_busy_ms": 900,
    "result_visible_ms": 1400,
    "states": ["idle", "busy", "success", "error"],
    "retry_during_result": True,
    "disconnect_cleanup": True,
}
write(panel_manifest_path, json.dumps(panel_manifest, ensure_ascii=False, indent=2) + "\n")

# YAML contract: only version/standard plus explicit shell/refresh contracts.
contract_path = ROOT / "contracts" / "rooms_v11.yaml"
contract = read(contract_path)
contract = replace_once(contract, f"    version: {OLD_UI}\n    standard: \"1.9\"", f"    version: {NEW_UI}\n    standard: \"2.2\"", "contract UI")
nav_marker = "  navigation:\n"
contract = replace_once(
    contract,
    nav_marker,
    "  shell:\n    contract_version: \"2.1\"\n    host_boundary: ha-panel\n    header_body_px: 60\n    bottom_nav_body_px: 64\n    content_max_width_px: 1280\n    scroll_boundary_guard: capture-non-passive-touchmove\n  refresh_action:\n    contract_version: \"1.1\"\n    minimum_busy_ms: 900\n    result_visible_ms: 1400\n    retry_during_result: true\n    disconnect_cleanup: true\n  navigation:\n    contract_version: \"1.2\"\n",
    "contract shell refresh",
)
write(contract_path, contract)

pyproject_path = ROOT / "pyproject.toml"
pyproject = read(pyproject_path)
pyproject = replace_once(pyproject, f'version = "{OLD_INTEGRATION}"', f'version = "{NEW_INTEGRATION}"', "pyproject version")
write(pyproject_path, pyproject)

# Strengthen deterministic repository gates.
checker_path = ROOT / "scripts" / "check_repository.py"
checker = read(checker_path)
checker = checker.replace('require(manifest["version"] == "0.1.15", "integration version drift")', 'require(manifest["version"] == "0.1.16", "integration version drift")')
checker = checker.replace('require(panel_manifest["ui_version"] == "11.0.14", "panel UI version drift")', 'require(panel_manifest["ui_version"] == "11.0.15", "panel UI version drift")')
checker = checker.replace('require(standard["ui_version"] == "11.0.14", "standard UI version drift")', 'require(standard["ui_version"] == "11.0.15", "standard UI version drift")')
checker = checker.replace('require(contract["spec"]["ui"]["version"] == "11.0.14", "contract UI version drift")', 'require(contract["spec"]["ui"]["version"] == "11.0.15", "contract UI version drift")')
insert = '    require(panel_manifest["preserved_yaml_route"] == "/dashboard-rooms/rooms", "preserved route drift")\n'
if insert not in checker:
    raise SystemExit("checker insertion point missing")
extra = '''    require(standard["version"] == "2.2", "NikaS UI standard drift")\n    require(standard["navigation_contract_version"] == "1.2", "navigation contract drift")\n    shell_path = DOMAIN / "frontend" / "src" / "shell-v2.js"\n    source_path = DOMAIN / "frontend" / "src" / "nikas-rooms-panel.js"\n    require(shell_path.is_file() and source_path.is_file(), "v2.2 build sources are missing")\n    shell = shell_path.read_text(encoding="utf-8")\n    shell_digest = hashlib.sha256(shell_path.read_bytes()).hexdigest()\n    require(shell_digest == standard["shell_source_sha256"], "vendored Shell v2.1 hash drift")\n    require('const NIKAS_SHELL_V2_VERSION = "2.1"' in source, "production Shell v2.1 source is missing")\n    require('<header class="nikas-shell__header header">' in source, "canonical Header class missing")\n    require('<main class="nikas-shell__viewport viewport" id="viewport">' in source, "canonical viewport class missing")\n    require('<nav class="nikas-shell__tabs tabs"' in source, "canonical Bottom Nav class missing")\n    require(source.count('class="nikas-shell__tab"') == 4, "canonical base tab count drift")\n    require("position:fixed" not in source, "panel must not bind to browser window")\n    require("100vw" not in source and "100vh" not in source and "100dvh" not in source, "browser viewport units are forbidden")\n    require("createNikasShellScrollBoundaryGuard" in source, "Shell boundary guard missing")\n    require("this._scrollBoundaryGuardCleanup = createNikasShellScrollBoundaryGuard" in source, "boundary guard is not installed")\n    require("this._scrollBoundaryGuardCleanup?.();" in source, "boundary guard cleanup missing")\n    require("REFRESH_MIN_BUSY_MS = 900" in source and "REFRESH_RESULT_MS = 1400" in source, "Refresh Action timings missing")\n    require('this._refreshPhase = success ? "success" : "error"' in source, "Refresh Action result state missing")\n    require("mdi:check" in source and "mdi:alert-circle-outline" in source, "Refresh Action result glyphs missing")\n    require("prefers-reduced-motion:reduce" in source, "Refresh Action reduced-motion behavior missing")\n    require("window.clearTimeout(this._refreshResultTimer)" in source, "Refresh Action timer cleanup missing")\n    subprocess.run(["python", str(ROOT / "scripts" / "build_frontend.py"), "--check"], check=True)\n'''
checker = checker.replace(insert, insert + extra, 1)
write(checker_path, checker)

# Validation must fail if source and production bundle diverge.
workflow_path = ROOT / ".github" / "workflows" / "validate.yml"
workflow = read(workflow_path)
workflow = replace_once(workflow, "      - run: python -m pytest\n", "      - run: python scripts/build_frontend.py --check\n      - run: python -m pytest\n", "validate build gate")
write(workflow_path, workflow)

# Update frontend tests from legacy fixed-window assumptions to canonical v2.2 behavior.
test_path = ROOT / "tests" / "test_frontend_contract.py"
test = read(test_path)
start = test.index("def test_frontend_has_autonomous_fixed_shell_and_gesture_zoom() -> None:\n")
end = test.index("\n\ndef test_state_updates_do_not_rebuild_shell()", start)
new_test = '''def test_frontend_has_canonical_shell_v21_and_gesture_zoom() -> None:\n    text = source()\n    assert text.count('<main class="nikas-shell__viewport viewport" id="viewport">') == 1\n    assert text.count('<header class="nikas-shell__header header">') == 1\n    assert text.count('<nav class="nikas-shell__tabs tabs"') == 1\n    assert text.count('class="nikas-shell__tab"') == 4\n    assert 'const NIKAS_SHELL_V2_VERSION = "2.1"' in text\n    assert "createNikasShellScrollBoundaryGuard" in text\n    assert "this._scrollBoundaryGuardCleanup = createNikasShellScrollBoundaryGuard" in text\n    assert "this._scrollBoundaryGuardCleanup?.();" in text\n    assert "position:fixed" not in text\n    assert "100vw" not in text and "100vh" not in text and "100dvh" not in text\n    assert "grid-template-rows:calc(60px + env(safe-area-inset-top,0px))" in text\n    assert "calc(64px + env(safe-area-inset-bottom,0px))" in text\n    assert "hass-toggle-menu" in text\n    assert 'icon="mdi:menu"' in text\n    assert "touchStart(event)" in text and "touchMove(event)" in text and "touchEnd(event)" in text\n    assert "resetZoom()" in text\n    assert "0.75, 2" in text\n    assert "history.back(" not in text\n    assert '<button class="nikas-shell__title title-return"' in text\n    assert 'id="navigation-proxy"' in text and "anchor.click()" in text\n    assert "import " not in text and "import(" not in text\n'''
test = test[:start] + new_test + test[end:]
# Add Refresh Action and deterministic-build regressions.
append = '''\n\ndef test_refresh_action_contract_v11_is_behavioral() -> None:\n    text = source()\n    assert "REFRESH_MIN_BUSY_MS = 900" in text\n    assert "REFRESH_RESULT_MS = 1400" in text\n    assert "async runRegistryRefreshAction()" in text\n    assert 'this._refreshPhase = success ? "success" : "error"' in text\n    assert 'refresh.classList.toggle("is-busy", busy)' in text\n    assert 'refresh.classList.toggle("is-success", phase === "success")' in text\n    assert 'refresh.classList.toggle("is-error", phase === "error")' in text\n    assert "mdi:check" in text and "mdi:alert-circle-outline" in text\n    assert "prefers-reduced-motion:reduce" in text\n    assert "window.clearTimeout(this._refreshResultTimer)" in text\n    assert "this._viewport.scrollTo({ left: 0, top: scrollTop })" in text\n\n\ndef test_v22_bundle_has_explicit_build_sources() -> None:\n    assert (ROOT / "custom_components" / "nikas_rooms" / "frontend" / "src" / "shell-v2.js").is_file()\n    assert (ROOT / "custom_components" / "nikas_rooms" / "frontend" / "src" / "nikas-rooms-panel.js").is_file()\n    assert (ROOT / "scripts" / "build_frontend.py").is_file()\n'''
if "test_refresh_action_contract_v11_is_behavioral" not in test:
    test += append
write(test_path, test)

# Changelog records the behavioral migration.
changelog_path = ROOT / "CHANGELOG.md"
changelog = read(changelog_path)
entry = f'''## {NEW_INTEGRATION} / UI {NEW_UI} — 2026-09-10\n\n- A19: migrated Rooms from NikaS UI Standard v1.9 / navigation v1.1 to v2.2 / v1.2.\n- Adopted vendored canonical Shell v2.1 with `ha-panel` ownership, 60 px Header, 64 px Bottom Nav and the iOS scroll-boundary guard.\n- Implemented Refresh Action Contract v1.1 with truthful success/error result states, 900 ms minimum busy feedback, 1400 ms completion feedback, retry and disconnect cleanup.\n- Registry refresh keeps the shell stable and restores the active route scroll position after a structural view rebuild.\n- Added deterministic source-to-bundle build validation.\n\n'''
heading_end = changelog.find("\n") + 1
if entry not in changelog:
    changelog = changelog[:heading_end] + "\n" + entry + changelog[heading_end:].lstrip("\n")
write(changelog_path, changelog)

print(f"Rooms A19 source migration complete; Shell SHA-256={shell_sha}")
