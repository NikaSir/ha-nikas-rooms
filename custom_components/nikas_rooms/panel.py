"""Register the integration-owned NikaS Rooms v11 panel."""

from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

PANEL_ID = "rooms_v11"
PANEL_TITLE = "Помещения"
PANEL_SIDEBAR_TITLE = "Помещения · новая"
PANEL_URL_PATH = "dashboard-rooms-v11"
PANEL_ENTRY_ROUTE = "/dashboard-rooms-v11/rooms"
PANEL_PRESERVED_YAML_ROUTE = "/dashboard-rooms/rooms"
PANEL_PARENT_ROUTE = "/dashboard-house-v11/home"
PANEL_ICON = "mdi:floor-plan"
PANEL_WEB_COMPONENT = "nikas-rooms-v11"
PANEL_UI_VERSION = "11.0.9"
PANEL_TEMPLATE_VERSION = "1.9"
PANEL_STATIC_URL = "/nikas_rooms_panel"
PANEL_STATIC_REGISTERED = "panel_static_registered"
PANEL_ROUTE_REGISTERED = "panel_route_registered"
PANEL_DIRECTORY = Path(__file__).parent / "frontend"
PANEL_BUNDLE = "nikas-rooms-panel.js"

PANEL_METADATA = {
    "id": PANEL_ID,
    "title": PANEL_TITLE,
    "path": f"/{PANEL_URL_PATH}",
    "entry_route": PANEL_ENTRY_ROUTE,
    "parent_route": PANEL_PARENT_ROUTE,
    "preserved_yaml_route": PANEL_PRESERVED_YAML_ROUTE,
    "icon": PANEL_ICON,
    "owner": DOMAIN,
    "preferred_view": "rooms",
    "ui_version": PANEL_UI_VERSION,
    "template_version": PANEL_TEMPLATE_VERSION,
    "frontend_bundle": PANEL_BUNDLE,
}


async def async_register_panel(hass: HomeAssistant) -> None:
    """Register the preview route without replacing any existing owner."""
    domain_data = hass.data.setdefault(DOMAIN, {})
    if not domain_data.get(PANEL_STATIC_REGISTERED):
        await hass.http.async_register_static_paths(
            [StaticPathConfig(PANEL_STATIC_URL, str(PANEL_DIRECTORY), cache_headers=False)]
        )
        domain_data[PANEL_STATIC_REGISTERED] = True

    if frontend.async_panel_exists(hass, PANEL_URL_PATH):
        _LOGGER.warning(
            "NikaS Rooms preview route /%s already has an owner; preserving it unchanged",
            PANEL_URL_PATH,
        )
        return

    await panel_custom.async_register_panel(
        hass=hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name=PANEL_WEB_COMPONENT,
        sidebar_title=PANEL_SIDEBAR_TITLE,
        sidebar_icon=PANEL_ICON,
        module_url=f"{PANEL_STATIC_URL}/{PANEL_BUNDLE}?v={PANEL_UI_VERSION}",
        embed_iframe=False,
        require_admin=False,
        handle_safe_area=True,
        config=PANEL_METADATA,
    )
    domain_data[PANEL_ROUTE_REGISTERED] = True


def async_unregister_panel(hass: HomeAssistant) -> None:
    """Remove only the route registered by this integration instance."""
    domain_data = hass.data.setdefault(DOMAIN, {})
    if domain_data.pop(PANEL_ROUTE_REGISTERED, False):
        frontend.async_remove_panel(hass, PANEL_URL_PATH, warn_if_unknown=False)
