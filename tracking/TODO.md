# TODO

## Next
- Test the remaining device behaviors below; do not treat desktop API stubs as hardware evidence.
- Optional: settings JSON export/import; a day/night weather icon.

## Test on the TV (Samsung Q60A, Tizen 6.0). Install and launch verified for integrated 0.3.0; remaining feature checks are open
- Check that the 0.3.0 update retained the TV's saved settings, tile order, and websites. Installation and launch passed; the direct staging-folder packaging route is documented in INSTALL.md.
- App list loads from `getAppsInfo()`, with the right count and names. `iconPath` icons display. Each tile launches the right app.
- Arrow keys, OK, Back, Red key and Play/Pause respond. Back on home exits cleanly.
- Weather loads with only the two Open-Meteo `<access>` entries (WARP) and the `internet` privilege.
- Offline: unplug the network or block it at the router, then reopen the app. You should see "Offline · updated …" or "Weather unavailable".
- Text fields: OK opens the on-screen keyboard. **Done** saves. **Back** cancels and does not close settings.
  Tizen 6.0 has no Cancel key on the IME, and Samsung says Back/Up-at-top arrive as Cancel (65385).
- Website tiles: `launchAppControl` with `http://tizen.org/appcontrol/operation/view` + URL opens the Samsung browser on that page.
  If not, check whether the `org.tizen.browser` fallback works. Back from the browser returns to TV Home.
- The idle screen appears after the chosen time, any remote key dismisses it without acting, and the drift and crossfade are smooth.
- The fr-CA/en-GB date formats render (ICU data on the TV), and so does the 24-hour clock.
- Layout at the TV's real 1920×1080: no overflow, the settings panel scrolls to every control, and the focus ring is visible from the couch.
- Performance: SVG wallpapers and the idle crossfade do not stutter.
