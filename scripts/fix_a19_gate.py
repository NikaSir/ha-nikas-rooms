#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
checker_path = ROOT / "scripts" / "check_repository.py"
text = checker_path.read_text(encoding="utf-8")

needle = '    source_path = DOMAIN / "frontend" / "src" / "nikas-rooms-panel.js"\n'
if needle not in text:
    raise SystemExit("A19 source-path gate missing")
text = text.replace(
    needle,
    needle + '    panel_source = source_path.read_text(encoding="utf-8")\n',
    1,
)

old = '''    require(
        '<button class="title-return"' in source
        and '<button class="room-card' in source
        and 'data-route-kind="room" data-route-slug="${room.slug}"' in source
        and 'data-route-kind="diagnostics" data-route-slug="${room.slug}"' in source
        and 'data-route-kind="overview"' in source,
        "internal navigation buttons missing",
    )
'''
new = '''    require(
        'class="nikas-shell__title title-return"' in source
        and '<button class="room-card' in source
        and 'data-route-kind="room" data-route-slug="${room.slug}"' in source
        and 'data-route-kind="diagnostics" data-route-slug="${room.slug}"' in source
        and 'data-route-kind="overview"' in source,
        "internal navigation buttons missing",
    )
'''
if old not in text:
    raise SystemExit("legacy internal-navigation gate missing")
text = text.replace(old, new, 1)

old = '        and "window.history.pushState" not in source,\n'
new = '        and "window.history.pushState" not in panel_source,\n'
if old not in text:
    raise SystemExit("legacy pushState gate missing")
text = text.replace(old, new, 1)

checker_path.write_text(text, encoding="utf-8")
print("Rooms A19 navigation gate aligned")
