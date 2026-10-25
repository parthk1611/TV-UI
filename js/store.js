(function () {
  'use strict';
  // One versioned localStorage key for all preferences. Reads never throw:
  // missing, corrupt or wrong-typed values fall back to defaults.
  var KEY = 'tvhome.settings.v1';
  var VERSION = 1;
  var listeners = [];
  var current;

  var LOCALES = ['en-CA', 'en-US', 'en-GB', 'fr-CA'];
  var IDLE_OPTIONS = [0, 1, 5, 15];

  function defaults() {
    return {
      version: VERSION,
      wallpaper: 'lake',
      locale: 'en-CA',
      hour12: true,
      weatherCity: 'Toronto',
      weatherUnits: 'celsius',
      idleMinutes: 5,
      appOrder: [],
      hiddenApps: [],
      characters: [
        { id: 'heisenberg', name: 'Heisenberg', title: 'Breaking Bad', art: 'heisenberg', image: '', url: 'https://net77.cc/home' },
        { id: 'patrick-jane', name: 'Patrick Jane', title: 'The Mentalist', art: 'patrick-jane', image: '', url: 'https://net77.cc/home' },
        { id: 'flash', name: 'The Flash', title: 'The Flash', art: 'flash', image: '', url: 'https://net77.cc/home' }
      ],
      websites: [
        { id: 'site-youtube', name: 'YouTube', url: 'https://www.youtube.com/' },
        { id: 'site-wikipedia', name: 'Wikipedia', url: 'https://www.wikipedia.org/' },
        { id: 'site-bbc', name: 'BBC News', url: 'https://www.bbc.com/news' }
      ]
    };
  }

  function isStringArray(value) {
    return Array.isArray(value) && value.every(function (item) { return typeof item === 'string'; });
  }

  // localhost, *.local and private IPv4 ranges default to http:// (home devices rarely have TLS).
  function isLocalHost(host) {
    var name = String(host).toLowerCase();
    if (name === 'localhost' || /\.local$/.test(name)) { return true; }
    var ip = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(name);
    if (!ip) { return false; }
    var a = Number(ip[1]);
    var b = Number(ip[2]);
    return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }

  function validUrl(value) {
    if (typeof value !== 'string') { return null; }
    var text = value.trim();
    if (!text) { return null; }
    // "scheme:" counts as a scheme only when followed by "//". Otherwise "name:1234" is host:port
    // (localhost:3000, homeassistant.local:8123); anything else (javascript:, data:, mailto:) is rejected.
    var scheme = /^[a-z][a-z0-9+.-]*:([\s\S]*)$/i.exec(text);
    if (scheme && scheme[1].indexOf('//') !== 0) {
      if (!/^\d+([\/?#]|$)/.test(scheme[1])) { return null; }
      scheme = null;
    }
    if (!scheme) { text = (isLocalHost(text.split(/[\/?#:]/)[0]) ? 'http://' : 'https://') + text; }
    var parsed;
    try { parsed = new URL(text); } catch (error) { return null; }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') { return null; }
    if (!parsed.hostname || parsed.hostname.indexOf('.') < 0 && parsed.hostname !== 'localhost') { return null; }
    if (parsed.username || parsed.password) { return null; }
    return parsed.href;
  }

  function sanitize(raw) {
    var base = defaults();
    if (!raw || typeof raw !== 'object' || raw.version !== VERSION) { return base; }
    if (typeof raw.wallpaper === 'string') { base.wallpaper = raw.wallpaper; }
    if (LOCALES.indexOf(raw.locale) >= 0) { base.locale = raw.locale; }
    if (typeof raw.hour12 === 'boolean') { base.hour12 = raw.hour12; }
    if (typeof raw.weatherCity === 'string' && raw.weatherCity.trim()) { base.weatherCity = raw.weatherCity.trim().slice(0, 80); }
    if (raw.weatherUnits === 'celsius' || raw.weatherUnits === 'fahrenheit') { base.weatherUnits = raw.weatherUnits; }
    if (IDLE_OPTIONS.indexOf(raw.idleMinutes) >= 0) { base.idleMinutes = raw.idleMinutes; }
    if (isStringArray(raw.appOrder)) { base.appOrder = raw.appOrder.slice(0, 500); }
    if (isStringArray(raw.hiddenApps)) { base.hiddenApps = raw.hiddenApps.slice(0, 500); }
    if (Array.isArray(raw.characters)) {
      var characterIds = [];
      base.characters = raw.characters.filter(function (item) {
        if (!item || typeof item.id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(item.id) || characterIds.indexOf(item.id) >= 0 ||
          typeof item.name !== 'string' || !item.name.trim() || typeof item.title !== 'string' || !item.title.trim() || !validUrl(item.url)) { return false; }
        characterIds.push(item.id);
        return true;
      }).slice(0, 8).map(function (item) {
        return { id: item.id, name: item.name.trim().slice(0, 60), title: item.title.trim().slice(0, 80),
          art: ['heisenberg', 'patrick-jane', 'flash'].indexOf(item.art) >= 0 ? item.art : 'heisenberg',
          image: typeof item.image === 'string' && item.image.length <= 550000 && /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(item.image) ? item.image : '',
          url: validUrl(item.url) };
      });
    }
    if (Array.isArray(raw.websites)) {
      base.websites = raw.websites.filter(function (site) {
        return site && typeof site.id === 'string' && typeof site.name === 'string' && site.name.trim() && validUrl(site.url);
      }).slice(0, 12).map(function (site) {
        return { id: site.id, name: site.name.trim().slice(0, 40), url: validUrl(site.url) };
      });
    }
    return base;
  }

  function read() {
    var text = null;
    try { text = window.localStorage.getItem(KEY); } catch (error) { console.warn('[TV Home] Storage unavailable:', error.name); }
    if (!text) { return defaults(); }
    try { return sanitize(JSON.parse(text)); } catch (error) {
      console.warn('[TV Home] Ignoring unreadable settings');
      return defaults();
    }
  }

  function copy(value) { return JSON.parse(JSON.stringify(value)); }

  window.TVHome = window.TVHome || {};
  window.TVHome.store = {
    KEY: KEY,
    LOCALES: LOCALES,
    IDLE_OPTIONS: IDLE_OPTIONS,
    validUrl: validUrl,
    get: function () {
      if (!current) { current = read(); }
      return copy(current);
    },
    // Apply a partial update, persist it, and notify listeners with the changed keys.
    set: function (patch) {
      var next = this.get();
      var changed = [];
      Object.keys(patch).forEach(function (key) {
        if (JSON.stringify(next[key]) !== JSON.stringify(patch[key])) { changed.push(key); }
        next[key] = patch[key];
      });
      var sanitized = sanitize(next);
      try { window.localStorage.setItem(KEY, JSON.stringify(sanitized)); }
      catch (error) { window.TVHome.toast('Could not save settings: ' + error.name); return this.get(); }
      current = sanitized;
      if (changed.length) {
        listeners.forEach(function (listener) { listener(copy(current), changed); });
      }
      return copy(current);
    },
    onChange: function (listener) { listeners.push(listener); },
    readJSON: function (key) {
      try { return JSON.parse(window.localStorage.getItem(key)); } catch (error) { return null; }
    },
    writeJSON: function (key, value) {
      try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (error) { console.warn('[TV Home] Could not cache', key); }
    }
  };
}());
