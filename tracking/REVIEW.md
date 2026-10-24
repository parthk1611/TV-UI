# Review

## 743b4ca + 0dcefbe (2026-10-24), Step 1 prototype

Static read of `index.html`, `js/*.js`, `css/style.css`, `config.xml` and `.gitignore`.

Good:
- Plain HTML/CSS/ES5 JS, no build step, about 9 KB of JS.
- The Chromium 76 scan found no newer syntax: no `?.`, `??`, arrow functions, let/const, flex `gap`, `inset`, `aspect-ratio`, `:focus-visible` or `clamp()`.
- Apps come from `tizen.application.getAppsInfo()` and launch by the returned IDs, with no hard-coded app IDs. The app itself and `show:false` apps are filtered out.
- App and package IDs are fixed (`TvHome0001.TVHome`, `TvHome0001`). Certificates and `.wgt` files are git-ignored.
- Focus is contained and restored in settings. If app discovery fails, settings stay reachable.

Issues and resolution:
1. **No tests committed.** → **Resolved in e80605a (2026-10-24).** The harness is restored and extended: `tests/tizen-stub.js`, `tests/smoke.spec.js`, `tests/features.spec.js`, `tests/compat-check.js`, and npm scripts. While restoring it I fixed a helper bug: `press(page, key, 0)` used to press once.
2. **`<access origin="*" subdomains="true"/>` is wide open.** → **Resolved in 68233dc.** It is now limited to `https://api.open-meteo.com` and `https://geocoding-api.open-meteo.com`. Website tiles open through an application control, which should need no `<access>` entry (unverified on the TV).
3. **Unverified on the TV**: `getAppsInfo` with `application.info`, `iconPath` images, and Back-to-exit. → **Still open.** Carried to TODO.md "Test on the TV".
4. **Minor: date locale hard-coded to `en-CA`.** → **Resolved in 68233dc.** Region format (en-CA, en-US, en-GB, fr-CA) and 12/24-hour are now in settings, and the clock uses `Intl.DateTimeFormat`. The clock still updates every second (harmless).

## 68233dc, e80605a, b35f660 (2026-10-24), Steps 2–4 on `grok` (Engineer)

Self-review notes. Reviewer sign-off is still pending.
- The TV-specific behaviour is all simulated: IME Done/Cancel key codes (65376/65385, from Samsung's IME guide), `launchAppControl` with the `view` operation, and `org.tizen.browser` as a fallback.
- Weather cache: `tvhome.weather.v1` holds geocoded places (kept indefinitely) and the last reading (30 minutes). The 5-minute check timer only fetches when the reading is stale.
- Text fields are reached through a button. This is deliberate: Samsung documents that focusing an input with JS shows the on-screen keyboard, so arrow navigation never lands on a raw input.

## Reviewer verdict on 68233dc..a69959e (2026-10-24): Approved with notes

Each note is resolved in the follow-up commit "Address Reviewer notes: website launch fallback, weather service errors, LAN URLs" (the commit right after a69959e on `grok`; a commit cannot contain its own hash, so look it up with `git log --oneline -1 --grep "Address Reviewer notes"`).
1. **`js/websites.js`: if `launchAppControl` threw synchronously, the app showed the error without trying `org.tizen.browser`.** → Fixed. The error callback and the synchronous throw now go through the same single retry with the browser app ID (guarded, so there are no loops). New specs use the stub's `launchAppControlThrowOnce` (fallback attempted with the URL) and `launchAppControlThrow` (both attempts fail, and the error toast shows).
2. **`js/weather.js`: with no cache, HTTP 4xx/5xx or a malformed body showed "No connection".** → Fixed. These now show "Weather service error · will retry". "No connection" is shown only for a network failure, a timeout, or `navigator.onLine === false`. New specs cover HTTP 500, malformed JSON, a network failure, and a service error while offline.
3. **`js/store.js`: `homeassistant.local:8123`, `localhost:3000` and `192.168.1.10:8123` were rejected as unknown schemes.** → Fixed. A prefix counts as a scheme only when it is followed by `//`. If what follows the colon is all digits up to `/`, `?`, `#` or the end, it is treated as host:port. Anything else (`javascript:`, `data:`, `mailto:`, `vbscript:`, `http:example.com`) is rejected. A missing scheme defaults to `http://` for localhost, `*.local`, 10/8, 172.16/12 and 192.168/16, and to `https://` otherwise. `file:` and `ftp:` are still rejected by the http/https check. A table-driven spec covers 27 inputs.
