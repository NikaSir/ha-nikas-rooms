"""Run the shipped panel logic against child-device registry records."""
from pathlib import Path
import subprocess


def test_child_device_room_assignment():
    result = subprocess.run(
        ["node", str(Path(__file__).with_name("child_device_rooms_harness.js"))],
        capture_output=True, text=True, timeout=15,
    )
    assert result.returncode == 0, result.stdout + result.stderr
