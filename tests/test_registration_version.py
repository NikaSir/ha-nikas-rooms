"""Registration must describe and cache-bust the shipped UI version."""

import asyncio
import importlib.util
import json
from pathlib import Path
import re
import sys
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch
from urllib.parse import parse_qs, urlsplit


COMPONENT = Path(__file__).resolve().parents[1] / "custom_components/nikas_rooms"


class RegistrationVersionTests(unittest.TestCase):
    def setUp(self):
        package = ModuleType("rooms_registration_test")
        package.__path__ = [str(COMPONENT)]
        frontend = ModuleType("homeassistant.components.frontend")
        frontend.async_panel_exists = lambda hass, path: False
        panel_custom = ModuleType("homeassistant.components.panel_custom")
        panel_custom.async_register_panel = AsyncMock()
        http = ModuleType("homeassistant.components.http")
        http.StaticPathConfig = lambda *args, **kwargs: (args, kwargs)
        core = ModuleType("homeassistant.core")
        core.HomeAssistant = object
        components = ModuleType("homeassistant.components")
        components.frontend = frontend
        components.panel_custom = panel_custom
        modules = {
            "rooms_registration_test": package,
            "homeassistant": ModuleType("homeassistant"),
            "homeassistant.components": components,
            "homeassistant.components.frontend": frontend,
            "homeassistant.components.panel_custom": panel_custom,
            "homeassistant.components.http": http,
            "homeassistant.core": core,
        }
        with patch.dict(sys.modules, modules):
            spec = importlib.util.spec_from_file_location(
                "rooms_registration_test.panel", COMPONENT / "panel.py",
            )
            panel = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(panel)
            hass = SimpleNamespace(
                data={}, http=SimpleNamespace(async_register_static_paths=AsyncMock()),
            )
            asyncio.run(panel.async_register_panel(hass))
        panel_custom.async_register_panel.assert_awaited_once()
        self.registration = panel_custom.async_register_panel.await_args.kwargs
        bundle = (COMPONENT / "frontend" / panel.PANEL_BUNDLE).read_text()
        versions = re.findall(r'^const UI_VERSION = "([^"]+)";', bundle, re.MULTILINE)
        self.assertEqual(len(versions), 1)
        self.ui_version = versions[0]
        manifest = json.loads((COMPONENT / "panel_manifest.json").read_text())
        self.assertEqual(self.ui_version, manifest["ui_version"])

    def test_registered_metadata_matches_shipped_ui(self):
        self.assertEqual(self.registration["config"]["ui_version"], self.ui_version)

    def test_registered_url_cache_key_matches_shipped_ui(self):
        query = parse_qs(urlsplit(self.registration["module_url"]).query)
        self.assertEqual(query.get("v"), [self.ui_version])
