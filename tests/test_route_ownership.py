from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PANEL = ROOT / "custom_components" / "nikas_rooms" / "panel.py"
INIT = ROOT / "custom_components" / "nikas_rooms" / "__init__.py"


def test_integration_owns_only_parallel_rooms_root() -> None:
    source = PANEL.read_text(encoding="utf-8")
    assert 'PANEL_URL_PATH = "dashboard-rooms-v11"' in source
    assert 'PANEL_ENTRY_ROUTE = "/dashboard-rooms-v11/rooms"' in source
    assert 'PANEL_PRESERVED_YAML_ROUTE = "/dashboard-rooms/rooms"' in source
    assert "frontend.async_panel_exists(hass, PANEL_URL_PATH)" in source
    assert "frontend.async_remove_panel(hass, PANEL_URL_PATH" in source
    assert 'async_remove_panel(hass, "dashboard-rooms"' not in source
    assert 'frontend_url_path="dashboard-rooms"' not in source


def test_unload_is_guarded_by_this_integration_registration() -> None:
    source = PANEL.read_text(encoding="utf-8")
    assert "domain_data[PANEL_ROUTE_REGISTERED] = True" in source
    assert "domain_data.pop(PANEL_ROUTE_REGISTERED, False)" in source
    assert "if domain_data.pop(PANEL_ROUTE_REGISTERED, False):" in source
    assert "async_unregister_panel(hass)" in INIT.read_text(encoding="utf-8")


def test_rooms_repository_has_no_house_implementation_import() -> None:
    combined = "\n".join(
        path.read_text(encoding="utf-8")
        for path in (ROOT / "custom_components" / "nikas_rooms").rglob("*")
        if path.is_file() and path.suffix in {".py", ".js", ".json"}
    )
    assert "contract_generated_ui" not in combined
    assert "from .house" not in combined

