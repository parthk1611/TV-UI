// Shared helpers for the TV Home Playwright tests. Dev-only.
const path = require('path');
const { expect } = require('@playwright/test');

const STUB_PATH = path.join(__dirname, 'tizen-stub.js');
const GEOCODE = /^https:\/\/geocoding-api\.open-meteo\.com\/v1\/search\?/;
const FORECAST = /^https:\/\/api\.open-meteo\.com\/v1\/forecast\?/;

// Responses shaped like the real Open-Meteo responses fetched on 2026-10-24.
function geocodeBody(name) {
  const places = {
    toronto: { name: 'Toronto', latitude: 43.70643, longitude: -79.39864, admin1: 'Ontario', country: 'Canada' },
    paris: { name: 'Paris', latitude: 48.85341, longitude: 2.3488, admin1: 'Île-de-France', country: 'France' }
  };
  const hit = places[String(name).toLowerCase()];
  return hit ? { results: [Object.assign({ id: 1, country_code: 'CA', timezone: 'America/Toronto' }, hit)], generationtime_ms: 0.2 } : { generationtime_ms: 0.2 };
}

function forecastBody(temperature, code, units) {
  return {
    latitude: 43.70455, longitude: -79.404625, timezone: 'America/Toronto',
    current_units: { time: 'iso8601', interval: 'seconds', temperature_2m: units === 'fahrenheit' ? '°F' : '°C', weather_code: 'wmo code' },
    current: { time: '2026-10-24T18:45', interval: 900, temperature_2m: temperature, weather_code: code }
  };
}

// Mocks Open-Meteo. Returns counters so tests can assert how many requests went out.
async function mockWeather(page, options) {
  const opts = Object.assign({ temperature: 10.3, code: 0, fail: false, status: 200, badJson: false }, options || {});
  const counts = { geocode: 0, forecast: 0, urls: [] };
  await page.route(GEOCODE, (route) => {
    counts.geocode += 1;
    counts.urls.push(route.request().url());
    if (opts.fail) return route.abort('internetdisconnected');
    const name = new URL(route.request().url()).searchParams.get('name');
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(geocodeBody(name)) });
  });
  await page.route(FORECAST, (route) => {
    counts.forecast += 1;
    counts.urls.push(route.request().url());
    if (opts.fail) return route.abort('internetdisconnected');
    if (opts.status !== 200) return route.fulfill({ status: opts.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"error":true,"reason":"Internal error"}' });
    if (opts.badJson) return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"current": {"temperature_2m": 10' });
    const units = new URL(route.request().url()).searchParams.get('temperature_unit');
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(forecastBody(opts.temperature, opts.code, units)) });
  });
  return counts;
}

// Desktop: record window.open instead of opening real tabs.
async function stubWindowOpen(page) {
  await page.addInitScript(() => {
    window.__opened = [];
    window.open = function (url, target) { window.__opened.push({ url: String(url), target: target }); return null; };
  });
}

async function openDesktop(page, count) {
  await page.goto('/index.html');
  await expect(page.locator('#apps .app-tile')).toHaveCount(count === undefined ? 6 : count);
}

async function openTizen(page, config) {
  await page.addInitScript((cfg) => { window.__TIZEN_STUB_CONFIG__ = cfg; }, config || {});
  await page.addInitScript({ path: STUB_PATH });
  await page.goto('/index.html');
  await expect(page.locator('#environment')).toHaveText('Samsung TV');
}

// Describe the focused element in a stable, human-readable way.
async function focused(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return 'body';
    if (el.id) return '#' + el.id;
    if (el.hasAttribute('data-website')) return 'web:' + el.getAttribute('data-website');
    if (el.classList.contains('app-tile')) return 'app:' + el.querySelector('.app-name').textContent;
    if (el.hasAttribute('data-key')) return 'key:' + el.getAttribute('data-key');
    return el.tagName.toLowerCase();
  });
}

// Remote keys with no standard key name (Back 10009, Red 403, IME Done 65376) are dispatched manually.
async function pressRemote(page, keyCode, key) {
  await page.evaluate(({ keyCode, key }) => {
    const event = new KeyboardEvent('keydown', { key: key, bubbles: true, cancelable: true });
    Object.defineProperty(event, 'keyCode', { get: () => keyCode });
    Object.defineProperty(event, 'which', { get: () => keyCode });
    (document.activeElement || document.body).dispatchEvent(event);
  }, { keyCode, key });
}

async function press(page, key, times) {
  for (let i = 0; i < (times === undefined ? 1 : times); i++) await page.keyboard.press(key);
}

// Press ArrowDown (or another key) until the target is focused; fails after `limit` presses.
async function moveUntil(page, target, key, limit) {
  for (let i = 0; i < (limit || 60); i++) {
    if (await focused(page) === target) return;
    await page.keyboard.press(key || 'ArrowDown');
  }
  expect(await focused(page)).toBe(target);
}

async function calls(page, api) {
  return page.evaluate((api) => window.__tizenCalls.filter((c) => !api || c.api === api), api);
}

async function appNames(page) {
  return page.locator('#apps .app-name').allTextContents();
}

function watchConsole(page) {
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console.error: ' + msg.text()); });
  page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));
  return errors;
}

module.exports = {
  STUB_PATH, mockWeather, stubWindowOpen, openDesktop, openTizen, focused, pressRemote, press, moveUntil,
  calls, appNames, watchConsole, geocodeBody, forecastBody
};
