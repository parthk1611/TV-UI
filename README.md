# TV Home

A remote-controlled home screen for the Samsung Q60A (2021, Tizen 6.0), kept within the Chromium 76
limits of its web engine. It uses plain HTML, CSS and ES5 JavaScript, with no build step and no runtime dependencies.

> Integrated from the user-provided full app ZIP, with the approved cinematic UI.
> Integrated version 0.3.0 installed over the prior ZIP and launched successfully on the Samsung TV on October 24, 2026. Desktop feature tests pass; individual TV features and saved-preference retention still need a device check.

## Features

- **Character shortcuts (0.4.0)**: a character shelf with editable names, movie or series titles, artwork and website links. Hold OK on a character, choose **Edit shortcuts**, or press Blue (desktop E) to edit. Add up to eight, reorder or remove them, and import PNG/JPEG/WebP artwork. Existing settings are retained.
- Starter shortcuts point to NetMirror's home page. Paste a specific title URL into the editor to open that selection. Generated starter artwork and its prompts are recorded in [`images/characters/credits.json`](images/characters/credits.json); the red runner is original placeholder artwork for The Flash shortcut.
- **Home**: clock and date, live weather, your apps and website shortcuts, laid out for 1920×1080.
- **Weather (Step 2)**: [Open-Meteo](https://open-meteo.com/) (no API key needed). The city is geocoded once,
  and the current temperature and conditions are cached for 30 minutes. If a refresh fails, the last
  reading stays on screen labelled `Offline · updated 3:10 p.m.`. With no cached reading, you see "Weather unavailable".
- **Wallpaper (Step 2)**: a scenic photograph and the four original vector wallpapers bundled with the app. Choose one in Settings.
- **Editable tiles (Step 3)**:
  - *Arrange apps*: Settings → Arrange apps on home. OK picks up a tile, ←/→ moves it, OK drops it.
    Back cancels a move, and Back again finishes.
  - *Show/hide apps*: Settings → Apps. Each app toggles between Shown and Hidden.
  - *Website shortcuts*: add, rename, change the address or remove (press OK twice) in Settings → Websites.
    Only `http://` and `https://` addresses are accepted. On the TV, a site opens in the Samsung browser through
    a Tizen application control (no iframes). On desktop it opens in a new tab.
- **Idle screen (Step 4)**: after 1, 5 (default) or 15 idle minutes, or Off, a large clock and date appear over a
  slow photo frame of the wallpapers. The clock drifts slightly every minute to avoid burn-in. Any key
  dismisses it, and that key does nothing else.
- **Clock and date**: region format (en-CA, en-US, en-GB, fr-CA) and a 12/24-hour clock.
- All settings are saved in the TV's localStorage under one versioned key (`tvhome.settings.v1`). Bad or old data
  falls back to the defaults.

### Text entry on the TV

Text fields (city, website name and address) are buttons first. Press OK and the field opens.
Per Samsung's [Keyboard/IME guide](https://developer.samsung.com/smarttv/develop/guides/user-interaction/keyboardime.html),
the TV's on-screen keyboard appears when the field gets focus. **Done** saves and **Back** cancels.
On desktop, Enter saves and Escape cancels. Not yet checked on the TV.

## Remote keys

| TV remote | Desktop | Action |
| --- | --- | --- |
| Arrows | Arrows | Move focus. Stops at row edges |
| OK | Enter | Activate. In arrange mode, pick up or drop a tile |
| Back | Backspace or Escape | Close settings, leave arrange mode, or exit on home (desktop shows a mock-exit toast) |
| Red | R | Open settings |
| Blue / hold OK on a character | E / hold Enter | Edit character shortcuts |
| — | Tab / Shift+Tab | Cycle controls on the current screen |
| Any key | Any key | Dismiss the idle screen |

## Run the desktop preview

```sh
git clone https://github.com/parthk1611/TV-UI.git
cd TV-UI
python3 -m http.server 8765 --bind 127.0.0.1
```

Open <http://127.0.0.1:8765> in Chrome at a **1920×1080** viewport (DevTools device toolbar). Weather needs internet access.

## Tests

```sh
npm install
npx playwright install chromium   # first time only
npm test            # compat check + all Playwright tests
npm run test:compat # Chromium 76 compatibility scan of js/ and css/
npm run test:e2e    # Playwright only (starts its own server on port 8799)
```

- `tests/compat-check.js` scans `js/` and `css/` for syntax and CSS that the TV's Chromium 76 engine does not
  support, such as `?.`, `??`, `replaceAll`, `.at()`, flex `gap`, `inset`, `aspect-ratio`, `:focus-visible` and
  `clamp()`, plus anything that breaks the ES5 style (arrow functions, `let`/`const`, classes). Any hit fails the run.
- `tests/tizen-stub.js` is a fake `window.tizen` (app list, launch, `launchAppControl`, `ApplicationControl`,
  exit, key registration). It records every call and can be set up to fail.
- `tests/smoke.spec.js` and `tests/features.spec.js` drive the app at 1920×1080 using only remote-equivalent keys,
  with Open-Meteo mocked. They cover navigation, settings, weather (success, cache, offline), wallpaper, arranging and
  hiding tiles, adding, opening and removing websites, URL validation, the idle screen (with a fake clock),
  locale changes, the manifest, and the package contents. Console errors fail every test.

These tests check the app's logic in desktop Chromium. They do not prove it works on the TV.

## Build and install on the TV

```sh
./scripts/build-wgt.sh   # dist/TVHome-unsigned.wgt + dist/TVHome/ (app files only)
```

The package is **unsigned**. Samsung TVs only install apps signed with a Samsung certificate that lists the TV's
DUID, which needs Tizen Studio, Parth's Samsung account and the TV. Follow [`INSTALL.md`](INSTALL.md) (macOS).

Keep the app ID `TvHome0001.TVHome`, the package ID `TvHome0001` and the signing certificate the same across
updates. Install updates over the existing app. Uninstalling first deletes saved settings.

## Project layout

```
config.xml index.html css/ js/ images/ fonts/   ← the app (all that goes in the .wgt)
js/store.js      settings (one versioned localStorage key)
js/weather.js    Open-Meteo + 30-minute cache + offline fallback
js/wallpaper.js  bundled wallpapers
js/apps.js       app discovery, order, hide/show, arrange mode
js/websites.js   website tiles, URL validation, opening via app control
js/idle.js       idle clock / photo frame
js/settings.js   settings panel
js/keys.js nav.js main.js   remote keys, row-based focus, start-up and clock
tests/ scripts/ tracking/ INSTALL.md     ← development only, never packaged
```

## Known limitations

- The 0.4.0 character interface has desktop tests; simulator deployment and physical-TV validation are separate checks. The Samsung simulator lacks a browser handler for website shortcuts and can report `NotFoundError`; desktop preview opens links in a new tab.
- The prior app installed and launched; individual features and the integrated UI still need TV checks. See `tracking/TODO.md` for the checks to run there.
- The Samsung Home button and HDMI/input switching are not supported. Open TV Home from the Samsung home bar.
- The weather icon is simple (sun, cloud, rain, snow, storm) and ignores day/night.
- Opening websites relies on the TV's browser accepting a `view` application control. The Tizen docs describe this
  for mobile, so it is unverified on TV. The app retries with the browser app ID `org.tizen.browser`, which is also
  unverified on TV.
- Settings JSON import/export was skipped (optional).

## References

- [Samsung remote control guide](https://developer.samsung.com/smarttv/develop/guides/user-interaction/remote-control.html)
- [Samsung Keyboard/IME guide](https://developer.samsung.com/smarttv/develop/guides/user-interaction/keyboardime.html)
- [Samsung Application API](https://developer.samsung.com/smarttv/develop/api-references/tizen-web-device-api-references/application-api.html)
- [Samsung web engine specifications](https://developer.samsung.com/smarttv/develop/specifications/web-engine-specifications.html)
- [Tizen web app controls](https://github.com/Samsung/tizen-docs/blob/master/docs/application/web/guides/app-management/app-controls.md)
- [Open-Meteo forecast API docs](https://open-meteo.com/en/docs) (`current=temperature_2m,weather_code` checked against the live API on 2026-10-24)

The four vector presets are original artwork. The scenic photograph and font are credited below. App names identify third-party services; mock tiles do not imply installation.

## History

Step 1 (commit 0dcefbe on `main`) was verified in desktop Chrome and with Tizen API stubs on 2026-10-24
(see that commit's README). Steps 2–4 were added on `grok` on 2026-10-24/25.


## Cinematic UI

The user-selected cinematic direction uses a locally bundled Lago di Braies photograph, a 184px Inter clock, quiet charcoal app artwork, separate app labels, immediate white focus feedback, and matching editable settings. Existing preferences remain under `tvhome.settings.v1`; saved wallpaper IDs, tile order, hidden apps, websites, city, units and idle timeout retain their values. New profiles default to the new lake photograph.

## Asset credits

- Wallpaper: [Lago di Braies photograph by Luca Bravo](https://unsplash.com/photos/boathouse-on-lago-di-braies-hFzIoD0F_i8), downloaded from [Unsplash's image CDN](https://images.unsplash.com/photo-1482192505345-5655af888cc4). Used under the [Unsplash License](https://unsplash.com/license). Bundled as `images/lago-di-braies.jpg`; photographer credit is also visible in settings. This is a photograph of Italy, not live weather or a claim about the user's location.
- Typeface: [Inter by Rasmus Andersson and contributors](https://github.com/rsms/inter), bundled as `fonts/InterVariable.woff2`; SIL Open Font License included in `fonts/OFL.txt`.
- Interface icons and app pictograms are local SVG. App names identify third-party services; mock tiles do not imply those services are installed on the TV.

## Integrated validation — October 24, 2026

`npm test` passed: Chromium 76 source scan and **63/63 Playwright tests**. This includes retaining existing version-1 preferences, old wallpaper IDs, app order/visibility, saved websites, weather units/city, locale, and idle timeout. Packaging checks require the local font, its license, scenic image, and all app scripts. Tests use a local HTTP/1.1 server with a larger connection backlog, one browser worker, and a cross-platform select-all shortcut; assertions were not relaxed. Live Open-Meteo weather also loaded in desktop preview. UI and code were reviewed locally because delegation was disabled.

Deployment: signed `dist/TVHome/TVHome.wgt` with the existing `TVProfile`; author certificate matched the prior ZIP. Tizen confirmed installation and launch on QN65Q60AAFXZC. No uninstall was performed. App/package IDs remain fixed.
