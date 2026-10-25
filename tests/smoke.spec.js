// Smoke tests for TV Home (desktop preview + simulated Tizen APIs).
// These simulate API contracts only; they do NOT verify a Samsung TV or its Chromium 76 runtime.
const { test, expect } = require('@playwright/test');
const {
  mockWeather, stubWindowOpen, openDesktop, openTizen, focused, pressRemote, press, moveUntil, calls, watchConsole
} = require('./helpers');

const MOCK_APPS = ['Netflix', 'YouTube', 'Prime Video', 'Disney+', 'Plex', 'Spotify'];
const STUB_VISIBLE_APPS = ['Netflix', 'YouTube', 'Prime Video', 'Disney+', 'Plex', 'Spotify', 'Twitch', 'Crave', 'Apple TV'];

let pageErrors;

test.beforeEach(async ({ page }) => {
  pageErrors = watchConsole(page);
  await mockWeather(page);
  await stubWindowOpen(page);
});

test.afterEach(async () => {
  expect(pageErrors, 'no console errors or uncaught exceptions').toEqual([]);
});

async function focusInSettings(page) {
  return page.evaluate(() => document.getElementById('settings').contains(document.activeElement));
}

test.describe('desktop preview (no tizen)', () => {
  test('shows 6 mock tiles, desktop labels, and focuses the first app', async ({ page }) => {
    await openDesktop(page);
    await expect(page.locator('#apps .app-name')).toHaveText(MOCK_APPS);
    await expect(page.locator('#environment')).toHaveText('Desktop preview');
    await expect(page.locator('#apps-caption')).toHaveText('Sample apps · Launches are simulated');
    await expect(page.locator('#apps-status')).toBeHidden();
    expect(await focused(page)).toBe('app:Netflix');
  });

  test('Left/Right stop at row edges and keep focus', async ({ page }) => {
    await openDesktop(page);
    await press(page, 'ArrowLeft');
    expect(await focused(page)).toBe('app:Netflix');
    for (let i = 1; i < MOCK_APPS.length; i++) {
      await press(page, 'ArrowRight');
      expect(await focused(page)).toBe('app:' + MOCK_APPS[i]);
    }
    await press(page, 'ArrowRight', 2);
    expect(await focused(page)).toBe('app:Spotify');
  });

  test('Up reaches character shortcuts; Down reaches websites; Up returns to the same column', async ({ page }) => {
    await openDesktop(page);
    for (const [rights, name] of [[0, 'Netflix'], [3, 'Disney+'], [5, 'Spotify']]) {
      await page.reload();
      await expect(page.locator('#apps .app-tile')).toHaveCount(6);
      await press(page, 'ArrowRight', rights);
      expect(await focused(page)).toBe('app:' + name);
      await press(page, 'ArrowDown');
      expect(await focused(page)).toMatch(/^web:/);
      await press(page, 'ArrowDown'); // bottom row: stays
      expect(await focused(page)).toMatch(/^web:/);
      await press(page, 'ArrowUp');
      expect(await focused(page)).toBe('app:' + name);
    }
    await press(page, 'ArrowUp');
    await expect(page.locator('#characters [data-character-id]:focus')).toHaveCount(1);
  });

  test('every website tile is reachable and Enter shows preview feedback', async ({ page }) => {
    await openDesktop(page);
    await press(page, 'ArrowDown');
    await press(page, 'ArrowLeft', 3);
    const seen = [];
    for (let i = 0; i < 3; i++) {
      seen.push(await focused(page));
      if (i < 2) await press(page, 'ArrowRight');
    }
    expect(seen).toEqual(['web:YouTube', 'web:Wikipedia', 'web:BBC News']);
    await press(page, 'Enter');
    await expect(page.locator('#toast')).toBeVisible();
    await expect(page.locator('#toast')).toHaveText('Desktop preview · Opening bbc.com in a new tab');
    expect(await page.evaluate(() => window.__opened)).toEqual([{ url: 'https://www.bbc.com/news', target: '_blank' }]);
  });

  test('R opens settings with focus contained; Backspace restores previous focus', async ({ page }) => {
    await openDesktop(page);
    await press(page, 'ArrowRight', 2);
    expect(await focused(page)).toBe('app:Prime Video');
    await press(page, 'r');
    await expect(page.locator('#settings')).toBeVisible();
    await expect(page.locator('#home')).toHaveAttribute('aria-hidden', 'true');
    expect(await focused(page)).toBe('#wallpaper-lake');
    for (const key of ['ArrowUp', 'ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'Tab', 'Tab', 'Tab', 'Shift+Tab']) {
      await press(page, key);
      expect(await focusInSettings(page), 'focus stays in settings after ' + key).toBe(true);
    }
    await press(page, 'r'); // already open: no-op
    await press(page, 'Backspace');
    await expect(page.locator('#settings')).toBeHidden();
    await expect(page.locator('#home')).not.toHaveAttribute('aria-hidden', 'true');
    expect(await focused(page)).toBe('app:Prime Video');
    await expect(page.locator('#toast')).toBeHidden(); // closing settings must not trigger exit
  });

  test('settings via header button; panel buttons work; close button restores focus', async ({ page }) => {
    await openDesktop(page);
    await page.locator('#open-settings').focus();
    expect(await focused(page)).toBe('#open-settings');
    await press(page, 'Enter');
    await expect(page.locator('#settings')).toBeVisible();
    expect(await focused(page)).toBe('#wallpaper-lake');
    await moveUntil(page, '#close-settings', 'ArrowDown');
    await press(page, 'Enter');
    await expect(page.locator('#settings')).toBeHidden();
    expect(await focused(page)).toBe('#open-settings');
  });

  test('Escape also closes settings', async ({ page }) => {
    await openDesktop(page);
    await press(page, 'r');
    await expect(page.locator('#settings')).toBeVisible();
    await press(page, 'Escape');
    await expect(page.locator('#settings')).toBeHidden();
    expect(await focused(page)).toBe('app:Netflix');
  });

  test('Enter on an app shows the simulated-launch toast', async ({ page }) => {
    await openDesktop(page);
    await press(page, 'ArrowRight');
    await press(page, 'Enter');
    await expect(page.locator('#toast')).toBeVisible();
    await expect(page.locator('#toast')).toHaveText('Desktop preview · Would open YouTube');
  });

  test('Backspace on home shows the mock-exit toast and the page stays', async ({ page }) => {
    await openDesktop(page);
    const url = page.url();
    await press(page, 'Backspace');
    await expect(page.locator('#toast')).toHaveText('Desktop preview · Back on home would exit TV Home');
    expect(page.url()).toBe(url);
    expect(await focused(page)).toBe('app:Netflix');
  });

  test('no console errors, no page overflow, clock renders', async ({ page }) => {
    await openDesktop(page);
    await expect(page.locator('#clock')).toHaveText(/^\d{1,2}:\d{2}$/);
    await expect(page.locator('#period')).toHaveText(/^(a\.m\.|p\.m\.)$/); // default locale en-CA, 12-hour
    const overflow = await page.evaluate(() => ({
      w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight
    }));
    expect(overflow.w).toBeLessThanOrEqual(1920);
    expect(overflow.h).toBeLessThanOrEqual(1080);
    await press(page, 'ArrowRight', 3);
    await press(page, 'Enter');
    await press(page, 'r');
    await press(page, 'Backspace');
    await press(page, 'Backspace');
    // afterEach asserts that nothing was logged to console.error
  });
});

test.describe('Tizen mode (stubbed window.tizen)', () => {
  test('filters out the app itself and show:false apps', async ({ page }) => {
    await openTizen(page);
    await expect(page.locator('#apps .app-name')).toHaveText(STUB_VISIBLE_APPS);
    await expect(page.locator('#apps-caption')).toHaveText(STUB_VISIBLE_APPS.length + ' installed apps');
    await expect(page.locator('#apps')).not.toContainText('TVHome');
    await expect(page.locator('#apps')).not.toContainText('Hidden Service');
    expect(await focused(page)).toBe('app:Netflix');
    expect((await calls(page, 'application.getAppsInfo')).length).toBe(1);
  });

  test('more than 6 apps: Right scrolls the row to the last app', async ({ page }) => {
    await openTizen(page);
    await press(page, 'ArrowRight', STUB_VISIBLE_APPS.length + 2);
    expect(await focused(page)).toBe('app:Apple TV');
    const state = await page.evaluate(() => {
      const row = document.getElementById('apps');
      const rect = document.activeElement.getBoundingClientRect();
      return { scrollLeft: row.scrollLeft, left: rect.left, right: rect.right };
    });
    expect(state.scrollLeft).toBeGreaterThan(0);
    expect(state.left).toBeGreaterThanOrEqual(0);
    expect(state.right).toBeLessThanOrEqual(1920);
  });

  test('Enter launches using the id returned by getAppsInfo', async ({ page }) => {
    await openTizen(page);
    await press(page, 'ArrowRight', 2);
    await press(page, 'Enter');
    expect(await calls(page, 'application.launch')).toEqual([{ api: 'application.launch', args: ['prime.app'] }]);
    await expect(page.locator('#toast')).toBeHidden();
  });

  test('launch error callback shows a toast', async ({ page }) => {
    await openTizen(page, { launchError: { name: 'NotFoundError' } });
    await press(page, 'Enter');
    await expect(page.locator('#toast')).toHaveText('Could not open Netflix: NotFoundError');
  });

  test('launch throwing synchronously shows a toast', async ({ page }) => {
    await openTizen(page, { launchThrow: { name: 'InvalidValuesError' } });
    await press(page, 'Enter');
    await expect(page.locator('#toast')).toHaveText('Could not open Netflix: InvalidValuesError');
  });

  test('registers the 5 extra remote keys', async ({ page }) => {
    await openTizen(page);
    const keys = (await calls(page, 'tvinputdevice.registerKey')).map((c) => c.args[0]);
    expect(keys).toEqual(['ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue', 'MediaPlayPause']);
  });

  test('a key that fails to register does not break startup', async ({ page }) => {
    await openTizen(page, { registerKeyThrow: ['MediaPlayPause'] });
    await expect(page.locator('#apps .app-tile')).toHaveCount(STUB_VISIBLE_APPS.length);
    expect(await focused(page)).toBe('app:Netflix');
  });

  test('Back (10009) on home calls exit()', async ({ page }) => {
    await openTizen(page);
    await pressRemote(page, 10009, 'XF86Back');
    expect((await calls(page, 'application.getCurrentApplication().exit')).length).toBe(1);
  });

  test('Red (403) opens settings; Back (10009) closes it without exiting', async ({ page }) => {
    await openTizen(page);
    await press(page, 'ArrowRight');
    await pressRemote(page, 403, 'ColorF0Red');
    await expect(page.locator('#settings')).toBeVisible();
    expect(await focused(page)).toBe('#wallpaper-lake');
    await pressRemote(page, 10009, 'XF86Back');
    await expect(page.locator('#settings')).toBeHidden();
    expect(await focused(page)).toBe('app:YouTube');
    expect((await calls(page, 'application.getCurrentApplication().exit')).length).toBe(0);
  });

  test('desktop-only keys (R, Backspace) are ignored on TV', async ({ page }) => {
    await openTizen(page);
    await press(page, 'r');
    await expect(page.locator('#settings')).toBeHidden();
    await press(page, 'Backspace');
    expect((await calls(page, 'application.getCurrentApplication().exit')).length).toBe(0);
  });

  test('MediaPlayPause (10252) shows feedback', async ({ page }) => {
    await openTizen(page);
    await pressRemote(page, 10252, 'MediaPlayPause');
    await expect(page.locator('#toast')).toHaveText('Play / pause received · No media is playing');
  });

  test('async getAppsInfo (as on a real TV) still lands focus on the first app', async ({ page }) => {
    await openTizen(page, { async: true });
    await expect(page.locator('#apps .app-tile')).toHaveCount(STUB_VISIBLE_APPS.length);
    await expect.poll(() => focused(page)).toBe('app:Netflix');
  });

  test('empty app list shows "No launchable apps found."', async ({ page }) => {
    await openTizen(page, { apps: [{ id: 'TvHome0001.TVHome', name: 'TVHome' }] });
    await expect(page.locator('#apps-status')).toBeVisible();
    await expect(page.locator('#apps-status')).toHaveText('No launchable apps found.');
    expect(await focused(page)).toBe('#open-settings');
  });

  for (const mode of ['error callback', 'synchronous throw']) {
    test(`getAppsInfo failure (${mode}) shows the error and settings stay reachable`, async ({ page }) => {
      const cfg = mode === 'error callback'
        ? { getAppsInfoError: { name: 'UnknownError' } }
        : { getAppsInfoThrow: { name: 'SecurityError' } };
      const errName = mode === 'error callback' ? 'UnknownError' : 'SecurityError';
      await openTizen(page, cfg);
      await expect(page.locator('#apps-status')).toBeVisible();
      await expect(page.locator('#apps-status')).toHaveText('Could not read installed apps: ' + errName);
      await expect(page.locator('#apps .app-tile')).toHaveCount(0);
      expect(await focused(page)).toBe('#open-settings');
      // Via OK on the settings button...
      await press(page, 'Enter');
      await expect(page.locator('#settings')).toBeVisible();
      await pressRemote(page, 10009, 'XF86Back');
      await expect(page.locator('#settings')).toBeHidden();
      expect(await focused(page)).toBe('#open-settings');
      // ...and via the Red key.
      await pressRemote(page, 403, 'ColorF0Red');
      await expect(page.locator('#settings')).toBeVisible();
      // Websites remain reachable too.
      await pressRemote(page, 10009, 'XF86Back');
      await press(page, 'ArrowDown');
      await expect(page.locator('#characters [data-focusable]:focus')).toHaveCount(1);
      await press(page, 'ArrowDown');
      expect(await focused(page)).toMatch(/^web:/);
    });
  }
});
