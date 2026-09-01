from __future__ import annotations

import hashlib
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / "references" / "Home_Assistant_Rooms_v10_8_18_PRIMARY_CLIMATE_LABEL.yaml"
CONTRACT = ROOT / "contracts" / "rooms_v11.yaml"

EXPECTED_SHA256 = "a9bceb0a48edd0932e6099149d55e5bde5bc9f6b427b906a4648c493229149a0"
EXPECTED_PATHS = [
    "rooms",
    "room-bathroom",
    "room-bedroom",
    "room-wardrobe",
    "room-sasha",
    "room-ilya",
    "room-stairs",
    "room-corridor",
    "room-hall",
    "room-boiler",
    "room-kitchen",
    "room-dining",
    "room-living",
    "room-toilet",
    "room-vestibule",
    "room-veranda",
    "room-garage",
    "room-attic",
    "room-greenhouse",
]


def test_reference_yaml_is_byte_exact() -> None:
    assert hashlib.sha256(REFERENCE.read_bytes()).hexdigest() == EXPECTED_SHA256


def test_reference_keeps_overview_and_eighteen_room_views() -> None:
    source = yaml.safe_load(REFERENCE.read_text(encoding="utf-8"))
    assert source["title"] == "Помещения"
    assert [view["path"] for view in source["views"]] == EXPECTED_PATHS
    assert all(
        view.get("back_path") == "/dashboard-rooms/rooms"
        for view in source["views"][1:]
    )


def test_v11_contract_preserves_reference_room_order_and_names() -> None:
    source = yaml.safe_load(REFERENCE.read_text(encoding="utf-8"))
    contract = yaml.safe_load(CONTRACT.read_text(encoding="utf-8"))
    source_rooms = [
        (view["path"].removeprefix("room-"), view["title"])
        for view in source["views"][1:]
    ]
    contract_rooms = [(room["slug"], room["name"]) for room in contract["spec"]["rooms"]]
    assert contract_rooms == source_rooms

