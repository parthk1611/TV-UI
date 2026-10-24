# TV Home

A remote-controlled home-screen app targeting the Samsung Q60A (2021), Tizen 6.0, and the Chromium 76 compatibility ceiling in the project brief. Plain HTML, CSS, and JavaScript; no build step or runtime dependencies.

## Current milestone: Step 1

- Full-screen home layout designed for 1920×1080, with local landscape artwork and a live clock/date.
- Arrow navigation between the settings button, apps, and website shortcuts; strong focus ring and scale.
- Settings shell with focus containment and restoration on close.
- Desktop mock app list and simulated launches/exit. No real streaming service opens on desktop.
- Guarded TV app discovery using `tizen.application.getAppsInfo()`, and launch by the returned IDs. TV behavior is pending device verification.
- Remote color keys and MediaPlayPause registration. Red opens settings; play/pause shows feedback.
- Manifest keeps `TvHome0001.TVHome` and `TvHome0001` fixed.

Weather is explicitly a placeholder. Website activation shows preview feedback. Editing/persistence, settings import/export, custom wallpapers, and idle mode are later milestones. The settings panel makes that status visible.

## Run the desktop preview

Clone the repository:

```sh
git clone https://github.com/parthk1611/TV-UI.git
cd TV-UI
```

From the repository folder:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open <http://127.0.0.1:8765> in Chrome and set the viewport to **1920×1080** in DevTools. Keep the same origin and port in future steps so browser localStorage stays consistent.

| TV remote | Desktop | Action |
| --- | --- | --- |
| Arrows | Arrows | Move focus; stop at row edges |
| OK | Enter | Activate focused control |
| Back | Backspace or Escape | Close settings; on home, exit on TV / show a mock exit toast on desktop |
| Red | R | Open settings |
| — | Tab / Shift+Tab | Cycle controls within the current screen |

Initial focus is the first app. Up goes to settings; Down goes to websites. Vertical movement remembers the horizontal position. On TV, more than six installed apps can be reached by moving right; the row scrolls to the focused app.

## Verification checklist

1. Start on Netflix in the desktop preview. Move through all six apps using Left/Right. Edges should keep focus on the same tile.
2. Move Down to a website and Up to the app row. Every website should be reachable.
3. Press R, test both panel buttons, and press Backspace. Focus should return to the original tile.
4. Reach Settings with Up and Enter. Arrows and Tab must stay in the panel until it closes.
5. Press Enter on an app and a website. Each must show accurate preview feedback.
6. Press Backspace on home. The preview should stay open and show simulated exit feedback.
7. Check the console for errors. Repeat the remote checks on the actual TV before claiming hardware compatibility.

## Verification record — October 24, 2026

Passed in desktop Chrome at a 1920×1080 viewport: all six app tiles and all three website tiles reachable with arrows; row boundaries; remembered vertical position; Enter activation feedback; R/Up access to settings; panel arrow/Tab containment; Back and close-button focus restoration; simulated home exit; visible focus outline; no page overflow. The browser console had no errors or warnings in the desktop preview.

Separate Tizen API stubs passed: discovery/filtering of nine installed apps, scrolling beyond six apps, launch using returned IDs, launch-error feedback, five extra-key registrations, Red/Back handling, and exit. Both callback and synchronous discovery failures kept settings reachable and showed an error. These checks simulate API contracts; they do not verify a Samsung TV or its Chromium 76 runtime.

JavaScript passed `node --check`. Manifest XML, fixed application/package IDs, TV profile, icon, and entry-point references were checked. Screenshots are saved in `output/playwright/`. Exclude that folder and `.playwright-cli/` from future widget builds.

## TV packaging and installation (later milestone)

Tizen Studio, a Samsung TV certificate profile with this TV's DUID, and the TV's Developer Mode connection are prerequisites. Tool availability and TV installation have not been verified in Step 1. The full installation/update guide comes in Step 5; packaging and device checks are Step 6.

Keep the app ID, package ID, and signing identity unchanged across updates. Store certificate files and passwords outside the project. Uninstalling can remove stored settings; do not use uninstall as a normal update step.

TODO / not supported in v1: HDMI/input switching and Samsung Home-button replacement. Open TV Home from Samsung's home bar. Do not reset Smart Hub.

## Next steps

2. Open-Meteo weather, a 30-minute cache/offline fallback, and configurable wallpaper.
3. Editable/reorderable app and website tiles, installed-app picker, localStorage settings, JSON import/export, and website opening.
4. Idle photo-frame / clock screen.
5. Exact verified install/update commands and certificate setup documentation.
6. Sign/package/install on the TV, test every tile, and use discovered device IDs.

## References

- [Samsung remote control guide](https://developer.samsung.com/smarttv/develop/guides/user-interaction/remote-control.html)
- [Samsung Application API](https://developer.samsung.com/smarttv/develop/api-references/tizen-web-device-api-references/application-api.html)
- [Samsung web engine specifications](https://developer.samsung.com/smarttv/develop/specifications/web-engine-specifications.html)

The local wallpaper is original vector artwork. App names identify third-party services; mock tiles do not imply those services are installed on the TV.
