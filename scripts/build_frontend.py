#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "custom_components" / "nikas_rooms" / "frontend"
SHELL = FRONTEND / "src" / "shell-v2.js"
SOURCE = FRONTEND / "src" / "nikas-rooms-panel.js"
OUTPUT = FRONTEND / "nikas-rooms-panel.js"
BANNER = "/* NikaS Rooms UI v11.0.15 · NikaS UI Standard v2.2 · Shell v2.1 */\n"

def render() -> str:
    return BANNER + SHELL.read_text(encoding="utf-8").rstrip() + "\n\n" + SOURCE.read_text(encoding="utf-8").lstrip()

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    expected = render()
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text(encoding="utf-8") != expected:
            raise SystemExit("frontend bundle is stale; run python scripts/build_frontend.py")
        print("frontend bundle is current")
        return
    OUTPUT.write_text(expected, encoding="utf-8")
    print(f"built {OUTPUT}")

if __name__ == "__main__":
    main()
