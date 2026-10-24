// Feature tests for Steps 2–4 (weather, wallpaper, editable tiles, websites, idle screen, locale).
// Driven only by the keyboard keys a remote maps to. Desktop Chromium simulates the TV; nothing
// here proves behaviour on the Samsung TV itself.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect } = require('@playwright/test');
const {
  mockWeather, stubWindowOpen, openDesktop, openTizen, focused, pressRemote, press, moveUntil, calls, appNames, watchConsole
} = require('./helpers');
const compat = require('./compat-check');

const SETTINGS_KEY = 'tvhome.settings.v1';
const WEATHER_KEY = 'tvhome.weather.v1';
const IME_DONE = 65376;
const BACK = 10009;
const RED = 403;

let pageErrors;
let allowedErrors;

test.beforeEach(async ({ page }) => {
  allowedErrors = [];
  pageErrors = watchConsole(page);
  await stubWindowOpen(page);
});

test.afterEach(async () => {
  const unexpected = pageErrors.filter((text) => !allowedErrors.some((pattern) => pattern.test(text)));
  expect(unexpected, 'no console errors or uncaught exceptions').toEqual([]);
});

async function openSettings(page) {
  await press(page, 'r');
  await expect(page.locator('#settings')).toBeVisible();
}

// Desktop text entry: OK opens the field, type, Enter saves.
async function typeInto(page, buttonId, text) {
  await moveUntil(page, '#' + buttonId);
  await press(page, 'Enter');
  const input = page.locator('#settings input:focus');
  await expect(input).toHaveCount(1);
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Delete');
  await page.keyboard.type(text);
  await press(page, 'Enter');
  await expect(page.locator('#settings input:focus')).toHaveCount(0);
}

test.describe('weather (Open-Meteo, mocked)', () => {
  test('shows current conditions using the documented query parameters', async ({ page }) => {
    const counts = await mockWeather(page, { temperature: 10.3, code: 3 });
    await openDesktop(page);
    await expect(page.locator('#weather-main')).toHaveText('10°C · Overcast');
    await expect(page.locator('#weather-status')).toHaveText(/^Toronto · updated \d{1,2}:\d{2}/);
    expect(counts.geocode).toBe(1);
    expect(counts.forecast).toBe(1);
    const forecastUrl = new URL(counts.urls.find((u) => u.includes('/v1/forecast')));
    expect(forecastUrl.searchParams.get('current')).toBe('temperature_2m,weather_code');
    expect(forecastUrl.searchParams.get('temperature_unit')).toBe('celsius');
    expect(Number(forecastUrl.searchParams.get('latitude'))).toBeCloseTo(43.70643, 4);
  });

  test('reload within 30 minutes uses the cache (no new requests)', async ({ page }) => {
    const counts = await mockWeather(page);
    await openDesktop(page);
    await expect(page.locator('#weather-main')).toHaveText('10°C · Clear sky');
    await page.reload();
    await expect(page.locator('#weather-main')).toHaveText('10°C · Clear sky');
    await page.waitForTimeout(300);
    expect(counts.forecast).toBe(1);
    expect(counts.geocode).toBe(1);
  });

  test('a reading older than 30 minutes is refreshed (geocode stays cached)', async ({ page }) => {
    const counts = await mockWeather(page, { temperature: 4, code: 61 });
    await openDesktop(page);
    await expect(page.locator('#weather-main')).toHaveText('4°C · Light rain');
    await page.evaluate((key) => {
      const cache = JSON.parse(localStorage.getItem(key));
      cache.reading.fetchedAt = Date.now() - 31 * 60 * 1000;
      localStorage.setItem(key, JSON.stringify(cache));
    }, WEATHER_KEY);
    await page.reload();
    await expect.poll(() => counts.forecast).toBe(2);
    expect(counts.geocode).toBe(1);
  });

  test('offline: shows the last cached reading labelled with its time', async ({ page }) => {
    allowedErrors.push(/Failed to load resource/);
    await mockWeather(page, { temperature: 12.4, code: 2 });
    await openDesktop(page);
    await expect(page.locator('#weather-main')).toHaveText('12°C · Partly cloudy');
    // Make the cached reading stale (fetched today at 3:10 PM local time), then go offline.
    const stamp = await page.evaluate((key) => {
      const cache = JSON.parse(localStorage.getItem(key));
      const d = new Date(Date.now() - 31 * 60 * 1000);
      cache.reading.fetchedAt = d.getTime();
      localStorage.setItem(key, JSON.stringify(cache));
      return new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
    }, WEATHER_KEY);
    await page.unrouteAll();
    await mockWeather(page, { fail: true });
    await page.reload();
    await expect(page.locator('#weather-status')).toHaveText('Offline · updated ' + stamp);
    await expect(page.locator('#weather-main')).toHaveText('12°C · Partly cloudy');
    await expect(page.locator('#weather')).toHaveAttribute('data-state', 'offline');
  });

  test('offline with no cache: clear "Weather unavailable" message', async ({ page }) => {
    allowedErrors.push(/Failed to load resource/);
    await mockWeather(page, { fail: true });
    await openDesktop(page);
    await expect(page.locator('#weather-main')).toHaveText('Weather unavailable');
    await expect(page.locator('#weather')).toHaveAttribute('data-state', 'error');
  });

  test('no cache + HTTP 500 from the forecast API: service error, not "No connection"', async ({ page }) => {
    allowedErrors.push(/Failed to load resource: the server responded with a status of 500/);
    await mockWeather(page, { status: 500 });
    await openDesktop(page);
    await expect(page.locator('#weather-main')).toHaveText('Weather unavailable');
    await expect(page.locator('#weather-status')).toHaveText('Weather service error · will retry');
  });

  test('no cache + malformed JSON body: service error', async ({ page }) => {
    await mockWeather(page, { badJson: true });
    await openDesktop(page);
    await expect(page.locator('#weather-main')).toHaveText('Weather unavailable');
    await expect(page.locator('#weather-status')).toHaveText('Weather service error · will retry');
  });

  test('no cache + network failure: "No connection"', async ({ page }) => {
    allowedErrors.push(/Failed to load resource/);
    await mockWeather(page, { fail: true });
    await openDesktop(page);
    await expect(page.locator('#weather-status')).toHaveText('No connection · will retry');
  });

  test('no cache + service error while the browser reports offline: "No connection"', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'onLine', { get: () => false }));
    await mockWeather(page, { badJson: true });
    await openDesktop(page);
    await expect(page.locator('#weather-status')).toHaveText('No connection · will retry');
  });

  test('city and units are configurable in settings (typing does not trigger shortcuts)', async ({ page }) => {
    const counts = await mockWeather(page);
    await openDesktop(page);
    await expect(page.locator('#weather-main')).toHaveText('10°C · Clear sky');
    await openSettings(page);
    await moveUntil(page, '#setting-city');
    await press(page, 'Enter');
    await expect(page.locator('#input-city')).toBeFocused();
    // Backspace and R edit the text; they must not close or reopen settings.
    await press(page, 'Backspace', 7);
    await page.keyboard.type('Paris');
    await expect(page.locator('#settings')).toBeVisible();
    await press(page, 'Enter');
    await expect(page.locator('#setting-city')).toBeFocused();
    await expect(page.locator('#setting-city .value')).toHaveText('Paris');
    await expect(page.locator('#weather-status')).toHaveText(/^Paris · updated/);
    await press(page, 'ArrowDown');
    expect(await focused(page)).toBe('#setting-units');
    await press(page, 'Enter');
    await expect(page.locator('#setting-units .value')).toHaveText('°F');
    await expect(page.locator('#weather-main')).toHaveText(/°F · Clear sky$/);
    expect(counts.urls.some((u) => u.includes('temperature_unit=fahrenheit'))).toBe(true);
    await page.reload();
    await expect(page.locator('#weather-status')).toHaveText(/^Paris · updated/);
    await expect(page.locator('#weather-main')).toHaveText(/°F/);
  });

  test('Escape discards a city edit', async ({ page }) => {
    await mockWeather(page);
    await openDesktop(page);
    await openSettings(page);
    await moveUntil(page, '#setting-city');
    await press(page, 'Enter');
    await page.keyboard.type('zzz');
    await press(page, 'Escape');
    await expect(page.locator('#setting-city')).toBeFocused();
    await expect(page.locator('#setting-city .value')).toHaveText('Toronto');
    await expect(page.locator('#settings')).toBeVisible();
  });

  test('unknown city shows "City not found"', async ({ page }) => {
    await mockWeather(page);
    await openDesktop(page);
    await openSettings(page);
    await typeInto(page, 'setting-city', 'Atlantis');
    await expect(page.locator('#weather-main')).toHaveText('City not found');
  });
});

test.describe('wallpaper', () => {
  test('choosing a wallpaper applies it and persists across reload', async ({ page }) => {
    await mockWeather(page);
    await openDesktop(page);
    await expect(page.locator('#wallpaper')).toHaveAttribute('data-wallpaper', 'lake');
    await openSettings(page);
    expect(await focused(page)).toBe('#wallpaper-lake');
    await press(page, 'ArrowRight', 3);
    expect(await focused(page)).toBe('#wallpaper-aurora');
    await press(page, 'Enter');
    await expect(page.locator('#wallpaper')).toHaveAttribute('data-wallpaper', 'aurora');
    await expect(page.locator('#wallpaper-aurora')).toHaveAttribute('aria-pressed', 'true');
    await press(page, 'Backspace');
    await page.reload();
    await expect(page.locator('#wallpaper')).toHaveAttribute('data-wallpaper', 'aurora');
    const bg = await page.locator('#wallpaper').evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bg).toContain('wallpaper-aurora.svg');
  });
});

test.describe('editable app tiles', () => {
  test('arrange mode: OK picks up, Right moves, OK drops; order persists', async ({ page }) => {
    await mockWeather(page);
    await openDesktop(page);
    await openSettings(page);
    await moveUntil(page, '#arrange-apps');
    await press(page, 'Enter');
    await expect(page.locator('#settings')).toBeHidden();
    await expect(page.locator('#arrange-banner')).toBeVisible();
    expect(await focused(page)).toBe('app:Netflix');
    await press(page, 'Enter');                 // pick up Netflix
    await expect(page.locator('#apps .app-tile.held')).toHaveText('Netflix');
    await press(page, 'ArrowRight', 2);
    expect(await appNames(page)).toEqual(['YouTube', 'Prime Video', 'Netflix', 'Disney+', 'Plex', 'Spotify']);
    expect(await focused(page)).toBe('app:Netflix');
    await press(page, 'Enter');                 // drop
    await press(page, 'ArrowUp');               // ignored while arranging
    expect(await focused(page)).toBe('app:Netflix');
    await press(page, 'Backspace');             // done
    await expect(page.locator('#arrange-banner')).toBeHidden();
    await expect(page.locator('#toast')).toHaveText('App order saved');
    await page.reload();
    expect(await appNames(page)).toEqual(['YouTube', 'Prime Video', 'Netflix', 'Disney+', 'Plex', 'Spotify']);
  });

  test('Back while holding a tile cancels that move; Enter in arrange mode never launches', async ({ page }) => {
    await mockWeather(page);
    await openDesktop(page);
    await openSettings(page);
    await moveUntil(page, '#arrange-apps');
    await press(page, 'Enter');
    await press(page, 'ArrowRight');            // focus YouTube
    await press(page, 'Enter');
    await press(page, 'ArrowRight', 3);
    expect((await appNames(page))[4]).toBe('YouTube');
    await press(page, 'Backspace');             // cancel the move
    expect(await appNames(page)).toEqual(['Netflix', 'YouTube', 'Prime Video', 'Disney+', 'Plex', 'Spotify']);
    expect(await focused(page)).toBe('app:YouTube');
    await expect(page.locator('#arrange-banner')).toBeVisible();
    await press(page, 'Backspace');             // leave arrange mode
    await expect(page.locator('#arrange-banner')).toBeHidden();
    await expect(page.locator('#toast')).not.toHaveText(/Would open/);
  });

  test('hide and show apps from settings; persists across reload', async ({ page }) => {
    await mockWeather(page);
    await openDesktop(page);
    await openSettings(page);
    await moveUntil(page, 'key:app-mock.app.1');
    await expect(page.locator('[data-key="app-mock.app.1"] .value')).toHaveText('Shown');
    await press(page, 'Enter');
    await expect(page.locator('[data-key="app-mock.app.1"] .value')).toHaveText('Hidden');
    expect(await focused(page)).toBe('key:app-mock.app.1');
    await press(page, 'Escape');
    expect(await appNames(page)).toEqual(['Netflix', 'Prime Video', 'Disney+', 'Plex', 'Spotify']);
    await expect(page.locator('#apps-caption')).toHaveText(/· 1 hidden$/);
    await page.reload();
    await expect(page.locator('#apps .app-tile')).toHaveCount(5);
    await openSettings(page);
    await moveUntil(page, 'key:app-mock.app.1');
    await press(page, 'Enter');
    await press(page, 'Escape');
    expect(await appNames(page)).toEqual(['Netflix', 'YouTube', 'Prime Video', 'Disney+', 'Plex', 'Spotify']);
  });

  test('on TV, order and hidden apps are keyed by the IDs from getAppsInfo', async ({ page }) => {
    await mockWeather(page);
    await page.addInitScript((key) => {
      localStorage.setItem(key, JSON.stringify({ version: 1, appOrder: ['apple.tv', 'netflix.app'], hiddenApps: ['crave.app'] }));
    }, SETTINGS_KEY);
    await openTizen(page);
    await expect(page.locator('#apps .app-tile')).toHaveCount(8);
    expect((await appNames(page)).slice(0, 3)).toEqual(['Apple TV', 'Netflix', 'YouTube']);
    expect(await appNames(page)).not.toContain('Crave');
    await press(page, 'Enter');
    expect(await calls(page, 'application.launch')).toEqual([{ api: 'application.launch', args: ['apple.tv'] }]);
  });
});

test.describe('website shortcuts', () => {
  test('TV: add a website with the on-screen keyboard (IME Done) and open it via launchAppControl', async ({ page }) => {
    await mockWeather(page);
    await openTizen(page);
    await pressRemote(page, RED, 'ColorF0Red');
    await expect(page.locator('#settings')).toBeVisible();
    await moveUntil(page, '#site-name');
    await press(page, 'Enter');
    await expect(page.locator('#input-siteName')).toBeFocused();
    await page.keyboard.type('Example');
    await press(page, 'Enter');                         // on TV, OK must not close the field
    await expect(page.locator('#input-siteName')).toBeFocused();
    await pressRemote(page, IME_DONE, 'Accept');
    await expect(page.locator('#site-name .value')).toHaveText('Example');
    await press(page, 'ArrowDown');
    expect(await focused(page)).toBe('#site-url');
    await press(page, 'Enter');
    await page.keyboard.type('example.com/tv');
    await pressRemote(page, IME_DONE, 'Accept');
    await press(page, 'ArrowDown');
    expect(await focused(page)).toBe('#site-save');
    await press(page, 'Enter');
    await expect(page.locator('#toast')).toHaveText('Added Example');
    await pressRemote(page, BACK, 'XF86Back');
    await expect(page.locator('#settings')).toBeHidden();
    await expect(page.locator('#websites .website-tile')).toHaveCount(4);
    await press(page, 'ArrowDown');
    await moveUntil(page, 'web:Example', 'ArrowRight', 6);
    await press(page, 'Enter');
    expect(await calls(page, 'application.launchAppControl')).toEqual([{
      api: 'application.launchAppControl',
      args: [{ operation: 'http://tizen.org/appcontrol/operation/view', uri: 'https://example.com/tv', mime: null, category: null, data: [] }, null]
    }]);
    expect((await calls(page, 'application.getCurrentApplication().exit')).length).toBe(0);
  });

  test('TV: if the implicit view request fails, retries with the browser app ID; errors show a toast', async ({ page }) => {
    await mockWeather(page);
    await openTizen(page, { launchAppControlErrorOnce: { name: 'NotFoundError' } });
    await press(page, 'ArrowDown');
    await press(page, 'Enter');
    const launched = await calls(page, 'application.launchAppControl');
    expect(launched.map((c) => c.args[1])).toEqual([null, 'org.tizen.browser']);
    expect(launched[1].args[0].uri).toBe('https://www.youtube.com/');
    await expect(page.locator('#toast')).toBeHidden();
  });

  test('TV: launchAppControl failing every time shows an error toast', async ({ page }) => {
    await mockWeather(page);
    await openTizen(page, { launchAppControlError: { name: 'NotFoundError' } });
    await press(page, 'ArrowDown');
    await press(page, 'Enter');
    await expect(page.locator('#toast')).toHaveText('Could not open YouTube: NotFoundError');
  });

  test('TV: launchAppControl throwing synchronously falls back to the browser app with the URL', async ({ page }) => {
    await mockWeather(page);
    await openTizen(page, { launchAppControlThrowOnce: { name: 'TypeMismatchError' } });
    await press(page, 'ArrowDown');
    await press(page, 'Enter');
    const launched = await calls(page, 'application.launchAppControl');
    expect(launched.map((c) => c.args[1])).toEqual([null, 'org.tizen.browser']);
    expect(launched[1].args[0]).toEqual({ operation: 'http://tizen.org/appcontrol/operation/view', uri: 'https://www.youtube.com/', mime: null, category: null, data: [] });
    await expect(page.locator('#toast')).toBeHidden();
  });

  test('TV: launchAppControl throwing on both attempts shows the error toast (one retry only)', async ({ page }) => {
    await mockWeather(page);
    await openTizen(page, { launchAppControlThrow: { name: 'TypeMismatchError' } });
    await press(page, 'ArrowDown');
    await press(page, 'Enter');
    await expect(page.locator('#toast')).toHaveText('Could not open YouTube: TypeMismatchError');
    expect((await calls(page, 'application.launchAppControl')).map((c) => c.args[1])).toEqual([null, 'org.tizen.browser']);
  });

  test('URL rules: host:port and LAN addresses get a default scheme; non-web schemes are rejected', async ({ page }) => {
    await mockWeather(page);
    await openDesktop(page);
    const cases = {
      'homeassistant.local:8123': 'http://homeassistant.local:8123/',
      'localhost:3000': 'http://localhost:3000/',
      'localhost': 'http://localhost/',
      '192.168.1.10:8123': 'http://192.168.1.10:8123/',
      '10.0.0.5/admin': 'http://10.0.0.5/admin',
      '172.16.0.1': 'http://172.16.0.1/',
      '172.31.255.1:81': 'http://172.31.255.1:81/',
      '172.32.0.1': 'https://172.32.0.1/',
      '8.8.8.8': 'https://8.8.8.8/',
      'example.com': 'https://example.com/',
      'example.com:8443/tv?x=1': 'https://example.com:8443/tv?x=1',
      'https://www.bbc.com/news': 'https://www.bbc.com/news',
      'http://homeassistant.local:8123': 'http://homeassistant.local:8123/',
      'HTTPS://Example.com': 'https://example.com/',
      'javascript:alert(1)': null,
      'JavaScript:alert(1)': null,
      'javascript:1': null,
      'data:text/html,<b>x</b>': null,
      'data:8080': null,
      'file:///etc/passwd': null,
      'ftp://example.com/file': null,
      'mailto:someone@example.com': null,
      'vbscript:msgbox(1)': null,
      'http://user:pass@example.com': null,
      'http:example.com': null,
      'not a url': null,
      '': null
    };
    const results = await page.evaluate((inputs) => inputs.map((input) => window.TVHome.store.validUrl(input)), Object.keys(cases));
    expect(Object.fromEntries(Object.keys(cases).map((k, i) => [k, results[i]]))).toEqual(cases);
  });

  for (const bad of ['javascript:alert(1)', 'ftp://example.com/file', 'not a url', 'file:///etc/passwd']) {
    test(`invalid URL is rejected: ${bad}`, async ({ page }) => {
      await mockWeather(page);
      await openDesktop(page);
      await openSettings(page);
      await typeInto(page, 'site-name', 'Bad');
      await typeInto(page, 'site-url', bad);
      await expect(page.locator('#site-error')).toBeVisible();
      await moveUntil(page, '#site-save');
      await press(page, 'Enter');
      await expect(page.locator('#site-error')).toHaveText('Enter a web address starting with http:// or https://');
      await press(page, 'Escape');
      await expect(page.locator('#websites .website-tile')).toHaveCount(3);
      const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), SETTINGS_KEY);
      expect(stored === null || stored.websites.length === 3).toBe(true);
    });
  }

  test('desktop: rename and change a website, then remove it with a second OK; persists', async ({ page }) => {
    await mockWeather(page);
    await openDesktop(page);
    await openSettings(page);
    await moveUntil(page, 'key:site-edit-site-wikipedia');
    await press(page, 'Enter');
    expect(await focused(page)).toBe('#site-name');
    await expect(page.locator('#website-form-title')).toHaveText('Edit website');
    await typeInto(page, 'site-name', 'Wiki FR');
    await typeInto(page, 'site-url', 'https://fr.wikipedia.org/');
    await moveUntil(page, '#site-save');
    await press(page, 'Enter');
    await expect(page.locator('#toast')).toHaveText('Saved Wiki FR');
    await expect(page.locator('#websites [data-website="Wiki FR"] small')).toHaveText('fr.wikipedia.org');
    // Remove BBC News: first OK arms, second OK removes.
    await moveUntil(page, 'key:site-edit-site-bbc', 'ArrowDown');
    await press(page, 'ArrowRight');
    expect(await focused(page)).toBe('key:site-remove-site-bbc');
    await press(page, 'Enter');
    await expect(page.locator('[data-key="site-remove-site-bbc"]')).toHaveText('Press OK again to remove');
    await press(page, 'Enter');
    await expect(page.locator('#toast')).toHaveText('BBC News removed');
    await press(page, 'Escape');
    await page.reload();
    await expect(page.locator('#websites .website-tile')).toHaveCount(2);
    expect(await page.locator('#websites strong').allTextContents()).toEqual(['YouTube', 'Wiki FR']);
    await press(page, 'ArrowDown');
    await press(page, 'ArrowRight');
    await press(page, 'Enter');
    expect(await page.evaluate(() => window.__opened)).toEqual([{ url: 'https://fr.wikipedia.org/', target: '_blank' }]);
  });
});

test.describe('idle screen', () => {
  test('appears after 5 idle minutes (fake clock); a key dismisses it and is swallowed', async ({ page }) => {
    await mockWeather(page);
    await page.clock.install({ time: new Date('2026-10-24T15:10:00') });
    await openDesktop(page);
    await page.clock.fastForward('04:50');
    await expect(page.locator('#idle')).toBeHidden();
    await page.clock.fastForward('00:15');
    await expect(page.locator('#idle')).toBeVisible();
    await expect(page.locator('#idle-clock')).toHaveText(/^3:1\d$/);
    await expect(page.locator('#idle-date')).toHaveText('Saturday, October 24');
    expect(await focused(page)).toBe('app:Netflix');
    await press(page, 'Enter');                  // would launch Netflix if not swallowed
    await expect(page.locator('#idle')).toBeHidden();
    await expect(page.locator('#toast')).toBeHidden();
    await press(page, 'ArrowRight');             // swallowed? No: idle is gone, so this moves normally
    expect(await focused(page)).toBe('app:YouTube');
  });

  test('activity resets the timer; Back on TV dismisses without exiting', async ({ page }) => {
    await mockWeather(page);
    await page.clock.install({ time: new Date('2026-10-24T15:10:00') });
    await openTizen(page);
    await page.clock.fastForward('04:00');
    await press(page, 'ArrowRight');
    await page.clock.fastForward('04:00');
    await expect(page.locator('#idle')).toBeHidden();
    await page.clock.fastForward('01:10');
    await expect(page.locator('#idle')).toBeVisible();
    await pressRemote(page, BACK, 'XF86Back');
    await expect(page.locator('#idle')).toBeHidden();
    expect((await calls(page, 'application.getCurrentApplication().exit')).length).toBe(0);
    expect(await focused(page)).toBe('app:YouTube');
  });

  test('Off disables it; Preview shows it on demand', async ({ page }) => {
    await mockWeather(page);
    await page.clock.install({ time: new Date('2026-10-24T15:10:00') });
    await openDesktop(page);
    await openSettings(page);
    await moveUntil(page, '#setting-idle');
    const seen = [];
    for (let i = 0; i < 4; i++) { await press(page, 'Enter'); seen.push(await page.locator('#setting-idle .value').textContent()); }
    expect(seen).toEqual(['15 min', 'Off', '1 min', '5 min']);
    await press(page, 'Enter'); await press(page, 'Enter');   // -> Off
    await expect(page.locator('#setting-idle .value')).toHaveText('Off');
    await press(page, 'Escape');
    await page.clock.fastForward('30:00');
    await expect(page.locator('#idle')).toBeHidden();
    await openSettings(page);
    await moveUntil(page, '#setting-idle');
    await press(page, 'ArrowRight');
    expect(await focused(page)).toBe('#idle-preview');
    await press(page, 'Enter');
    await expect(page.locator('#idle')).toBeVisible();
    await press(page, 'Escape');
    await expect(page.locator('#idle')).toBeHidden();
    await expect(page.locator('#settings')).toBeVisible();   // Escape was swallowed, settings stayed open
  });
});

test.describe('clock locale', () => {
  test('locale and 12/24-hour settings update the clock and date, and persist', async ({ page }) => {
    await mockWeather(page);
    await page.clock.install({ time: new Date('2026-10-24T15:10:00') });
    await openDesktop(page);
    await expect(page.locator('#date')).toHaveText('Saturday, October 24');
    await expect(page.locator('#clock')).toHaveText('3:10');
    await expect(page.locator('#period')).toHaveText('p.m.');
    await openSettings(page);
    await moveUntil(page, '#setting-locale');
    const dates = {};
    for (let i = 0; i < 3; i++) {
      await press(page, 'Enter');
      const locale = (await page.locator('#setting-locale .value').textContent()).split(' · ')[1];
      dates[locale] = await page.locator('#date').textContent();
    }
    expect(dates['en-US']).toBe('Saturday, October 24');
    expect(dates['en-GB']).toBe('Saturday 24 October');
    expect(dates['fr-CA']).toBe('samedi 24 octobre');
    await press(page, 'ArrowDown');
    expect(await focused(page)).toBe('#setting-hour12');
    await press(page, 'Enter');
    await expect(page.locator('#setting-hour12 .value')).toHaveText('24-hour');
    await expect(page.locator('#clock')).toHaveText(/^15\s?h\s?10$|^15:10$/);
    await expect(page.locator('#period')).toHaveText('');
    await page.reload();
    await expect(page.locator('#date')).toHaveText('samedi 24 octobre');
    await expect(page.locator('#clock')).toHaveText(/^15\s?h\s?10$|^15:10$/);
  });
});

test.describe('robustness', () => {
  test('the cinematic update retains existing version-1 preferences', async ({ page }) => {
    await mockWeather(page);
    const saved = {
      version: 1, wallpaper: 'ridge', locale: 'fr-CA', hour12: false,
      weatherCity: 'Paris', weatherUnits: 'fahrenheit', idleMinutes: 15,
      appOrder: ['mock.app.2', 'mock.app.0'], hiddenApps: ['mock.app.1'],
      websites: [{ id: 'saved-site', name: 'Saved website', url: 'https://example.com/' }]
    };
    await page.addInitScript(({ key, saved }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(saved));
    }, { key: SETTINGS_KEY, saved });
    await openDesktop(page, 5);
    await expect(page.locator('#wallpaper')).toHaveAttribute('data-wallpaper', 'ridge');
    expect((await appNames(page))[0]).toBe('Prime Video');
    await expect(page.locator('#websites .website-tile')).toHaveText(/Saved website/);
    await page.reload();
    expect(await page.evaluate(() => window.TVHome.store.get())).toEqual(saved);
    await expect(page.locator('#period')).toHaveText('');
  });

  test('corrupt or old settings fall back to defaults without errors', async ({ page }) => {
    await mockWeather(page);
    await openDesktop(page);
    await page.evaluate((key) => localStorage.setItem(key, '{not json'), SETTINGS_KEY);
    await page.reload();
    await expect(page.locator('#apps .app-tile')).toHaveCount(6);
    await expect(page.locator('#websites .website-tile')).toHaveCount(3);
    await expect(page.locator('#wallpaper')).toHaveAttribute('data-wallpaper', 'lake');
    await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ version: 1, websites: [{ id: 'x', name: 'Evil', url: 'javascript:alert(1)' }], locale: 'xx', idleMinutes: 7 })), SETTINGS_KEY);
    await page.reload();
    await expect(page.locator('#websites .website-tile')).toHaveCount(0);
    await expect(page.locator('#date')).not.toHaveText('');
  });

  test('home fits 1920x1080 with 12 websites and many apps (rows scroll)', async ({ page }) => {
    await mockWeather(page);
    const sites = Array.from({ length: 12 }, (_, i) => ({ id: 's' + i, name: 'Site ' + i, url: 'https://site' + i + '.example.com/' }));
    await page.addInitScript(({ key, sites }) => localStorage.setItem(key, JSON.stringify({ version: 1, websites: sites })), { key: SETTINGS_KEY, sites });
    await openTizen(page);
    await press(page, 'ArrowDown');
    await press(page, 'ArrowRight', 11);
    expect(await focused(page)).toBe('web:Site 11');
    const state = await page.evaluate(() => ({
      w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight,
      right: document.activeElement.getBoundingClientRect().right
    }));
    expect(state.w).toBeLessThanOrEqual(1920);
    expect(state.h).toBeLessThanOrEqual(1080);
    expect(state.right).toBeLessThanOrEqual(1920);
  });
});

test.describe('compat checker', () => {
  test('flags planted Chromium-76-incompatible JS and CSS', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-'));
    fs.mkdirSync(path.join(dir, 'js'));
    fs.mkdirSync(path.join(dir, 'css'));
    const js = compat.stripJsComments([
      'var a = b?.c;', 'var d = e ?? f;', 'x ||= 1;', 's.replaceAll("a", "b");', 'list.at(-1);',
      'Object.hasOwn(o, "k");', 'structuredClone(o);', '// a?.b in a comment is fine', 'var ok = "a ?? b in a string";'
    ].join('\n')).split('\n');
    const jsHits = js.filter((line) => compat.JS_RULES.some(([re]) => re.test(line)));
    expect(jsHits.length).toBe(7);
    const css = ['.a { gap: 10px; }', '.b { inset: 0; }', '.c { aspect-ratio: 1; }', 'a:focus-visible {}', '.d:is(.e) {}',
      '.f { width: clamp(1px, 2px, 3px); }', '.g { color: color-mix(in srgb, red, blue); }', '.h { height: 100dvh; }', '.i { translate: 1px; }',
      '.ok { margin: 0; min-width: 0; transform: translate(1px, 2px); }'];
    const cssHits = css.filter((line) => compat.CSS_RULES.some(([re]) => re.test(line)));
    expect(cssHits.length).toBe(9);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

test.describe('manifest and packaging', () => {
  const ROOT = path.resolve(__dirname, '..');

  test('config.xml keeps the fixed IDs and only allows the Open-Meteo hosts', () => {
    const xml = fs.readFileSync(path.join(ROOT, 'config.xml'), 'utf8');
    expect(xml).toContain('<tizen:application id="TvHome0001.TVHome" package="TvHome0001" required_version="6.0"/>');
    const origins = Array.from(xml.matchAll(/<access origin="([^"]+)"/g)).map((m) => m[1]);
    expect(origins).toEqual(['https://api.open-meteo.com', 'https://geocoding-api.open-meteo.com']);
    expect(xml).not.toContain('origin="*"');
  });

  test('build-wgt.sh packages only app files', () => {
    const { execFileSync } = require('child_process');
    execFileSync('bash', [path.join(ROOT, 'scripts', 'build-wgt.sh')], { cwd: ROOT, stdio: 'pipe' });
    const listing = execFileSync('unzip', ['-Z1', path.join(ROOT, 'dist', 'TVHome-unsigned.wgt')], { encoding: 'utf8' }).trim().split('\n');
    expect(listing).toContain('config.xml');
    expect(listing).toContain('index.html');
    expect(listing).toContain('js/main.js');
    expect(listing).toContain('images/wallpaper-aurora.svg');
    expect(listing).toContain('images/lago-di-braies.jpg');
    expect(listing).toContain('fonts/InterVariable.woff2');
    expect(listing).toContain('fonts/OFL.txt');
    for (const entry of listing) {
      expect(entry).toMatch(/^(config\.xml|index\.html|css\/|js\/|images\/|fonts\/)/);
    }
    // Every script referenced by index.html is in the package.
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    for (const m of html.matchAll(/<script src="([^"]+)"/g)) expect(listing).toContain(m[1].split('?')[0]);
  });
});
