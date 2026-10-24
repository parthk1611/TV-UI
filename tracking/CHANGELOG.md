# Changelog

## Integrated cinematic update, 2026-10-24
- Imported the full user-provided ZIP baseline with weather, persistence, editable tiles, browser shortcuts and idle mode.
- Preserved `tvhome.settings.v1`, app/package IDs, and all existing wallpaper preset IDs.
- Added cinematic photo/font assets, neutral app dock, matching settings, and a new default lake preset.
- Included font assets/license in packaging; 63 feature and smoke tests plus the compatibility scan passed.
- Corrected the macOS test select-all shortcut and local test-server connection handling.

## `grok` (Engineer), 2026-10-24
- b35f660: Unsigned `.wgt` build script (`scripts/build-wgt.sh`, `.buildignore`) and `INSTALL.md` for macOS.
- e80605a: Test harness restored and extended (Tizen stub, smoke + feature Playwright tests, Chromium 76 compat check, npm scripts).
- 68233dc: Steps 2–4: Open-Meteo weather with cache/offline, wallpapers, arrange/hide apps, editable website shortcuts, idle screen, locale/12-24h settings, narrowed `<access>`, version 0.2.0.
- 4cf5918: Tracking folder.

## `main` (summary), 2026-10-24
- 743b4ca: Ignore Playwright MCP artifacts (`.gitignore`).
- 0dcefbe: Add TV Home navigation prototype (Step 1: layout, navigation, settings shell, Tizen app discovery/launch, remote keys, README).
