(function () {
  'use strict';
  // Open-Meteo weather (no API key). Results are cached for 30 minutes; when a
  // refresh fails the last cached value is shown with its time.
  var CACHE_KEY = 'tvhome.weather.v1';
  var MAX_AGE = 30 * 60 * 1000;
  var CHECK_EVERY = 5 * 60 * 1000;
  var TIMEOUT = 10000;
  var GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
  var FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
  var inFlight = null;

  // WMO weather interpretation codes, as listed at https://open-meteo.com/en/docs
  var CODES = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Rime fog',
    51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle',
    61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
    71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
    80: 'Rain showers', 81: 'Rain showers', 82: 'Violent showers',
    85: 'Snow showers', 86: 'Heavy snow showers',
    95: 'Thunderstorm', 96: 'Thunderstorm, hail', 99: 'Thunderstorm, hail'
  };

  function describe(code) { return CODES.hasOwnProperty(code) ? CODES[code] : 'Weather code ' + code; }

  function icon(code) {
    if (code === 0 || code === 1) { return 'sun'; }
    if (code === 2 || code === 3 || code === 45 || code === 48) { return 'cloud'; }
    if (code >= 71 && code <= 77 || code === 85 || code === 86) { return 'snow'; }
    if (code >= 95) { return 'storm'; }
    return 'rain';
  }

  // A reachable service that answered badly (HTTP error, malformed or unexpected body).
  function serviceError(message) {
    var error = new Error(message);
    error.service = true;
    return error;
  }

  function fetchJSON(url) {
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer;
    var timeout = new Promise(function (resolve, reject) {
      timer = window.setTimeout(function () {
        if (controller) { controller.abort(); }
        var failure = new Error('Timed out');
        failure.network = true;
        reject(failure);
      }, TIMEOUT);
    });
    var request = fetch(url, controller ? { signal: controller.signal } : {}).then(function (response) {
      if (!response.ok) { throw serviceError('HTTP ' + response.status); }
      return response.json().catch(function () { throw serviceError('Malformed response'); });
    }, function (error) {
      var failure = new Error('Network: ' + (error && error.message));
      failure.network = true;
      throw failure;
    });
    return Promise.race([request, timeout]).then(function (value) {
      window.clearTimeout(timer);
      return value;
    }, function (error) {
      window.clearTimeout(timer);
      throw error;
    });
  }

  function cacheKey(settings) { return settings.weatherCity.toLowerCase() + '|' + settings.weatherUnits; }

  function readCache() {
    var cache = window.TVHome.store.readJSON(CACHE_KEY);
    return cache && typeof cache === 'object' ? cache : {};
  }

  function geocode(city, cache) {
    var key = city.toLowerCase();
    if (cache.places && cache.places[key]) { return Promise.resolve(cache.places[key]); }
    return fetchJSON(GEOCODE_URL + '?name=' + encodeURIComponent(city) + '&count=1&language=en&format=json').then(function (data) {
      var hit = data && data.results && data.results[0];
      if (!hit || typeof hit.latitude !== 'number' || typeof hit.longitude !== 'number') {
        var error = new Error('City not found');
        error.notFound = true;
        throw error;
      }
      var place = { name: hit.name, region: hit.admin1 || hit.country || '', latitude: hit.latitude, longitude: hit.longitude };
      var latest = readCache();
      latest.places = latest.places || {};
      latest.places[key] = place;
      window.TVHome.store.writeJSON(CACHE_KEY, latest);
      return place;
    });
  }

  function forecast(place, units) {
    var url = FORECAST_URL + '?latitude=' + place.latitude + '&longitude=' + place.longitude +
      '&current=temperature_2m,weather_code&temperature_unit=' + units + '&timezone=auto';
    return fetchJSON(url).then(function (data) {
      var current = data && data.current;
      if (!current || typeof current.temperature_2m !== 'number' || typeof current.weather_code !== 'number') {
        throw serviceError('Unexpected response');
      }
      return { temperature: current.temperature_2m, code: current.weather_code };
    });
  }

  function formatTime(timestamp) {
    var settings = window.TVHome.store.get();
    try {
      return new Intl.DateTimeFormat(settings.locale, { hour: 'numeric', minute: '2-digit', hour12: settings.hour12 }).format(new Date(timestamp));
    } catch (error) { return new Date(timestamp).toTimeString().slice(0, 5); }
  }

  function render(state) {
    var box = document.getElementById('weather');
    var main = document.getElementById('weather-main');
    var status = document.getElementById('weather-status');
    box.setAttribute('data-state', state.kind);
    if (state.reading) {
      var reading = state.reading;
      var unit = reading.units === 'fahrenheit' ? '°F' : '°C';
      box.setAttribute('data-icon', icon(reading.code));
      main.textContent = Math.round(reading.temperature) + unit + ' · ' + describe(reading.code);
      status.textContent = state.kind === 'offline'
        ? 'Offline · updated ' + formatTime(reading.fetchedAt)
        : reading.place + ' · updated ' + formatTime(reading.fetchedAt);
    } else {
      box.setAttribute('data-icon', 'cloud');
      main.textContent = state.title;
      status.textContent = state.detail;
    }
  }

  function refresh(force) {
    var settings = window.TVHome.store.get();
    var key = cacheKey(settings);
    var cache = readCache();
    var last = cache.reading && cache.reading.key === key ? cache.reading : null;
    var now = Date.now();
    if (!force && last && now - last.fetchedAt >= 0 && now - last.fetchedAt < MAX_AGE) {
      render({ kind: 'fresh', reading: last });
      return Promise.resolve('cache');
    }
    if (inFlight && inFlight.key === key) { return inFlight.promise; }
    if (!last) { render({ kind: 'loading', title: 'Checking the weather…', detail: settings.weatherCity }); }
    var promise = geocode(settings.weatherCity, cache).then(function (place) {
      return forecast(place, settings.weatherUnits).then(function (result) {
        var reading = {
          key: key, place: place.name, units: settings.weatherUnits,
          temperature: result.temperature, code: result.code, fetchedAt: Date.now()
        };
        var latest = readCache();
        latest.reading = reading;
        window.TVHome.store.writeJSON(CACHE_KEY, latest);
        if (cacheKey(window.TVHome.store.get()) === key) { render({ kind: 'fresh', reading: reading }); }
        return 'network';
      });
    }).catch(function (error) {
      if (cacheKey(window.TVHome.store.get()) !== key) { return 'stale-request'; }
      if (error.notFound) {
        render({ kind: 'error', title: 'City not found', detail: '“' + settings.weatherCity + '” · change it in Settings' });
      } else if (last) {
        render({ kind: 'offline', reading: last });
      } else if (error.service && navigator.onLine !== false) {
        render({ kind: 'error', title: 'Weather unavailable', detail: 'Weather service error · will retry' });
      } else {
        render({ kind: 'error', title: 'Weather unavailable', detail: 'No connection · will retry' });
      }
      console.warn('[TV Home] Weather refresh failed:', error.message);
      return 'failed';
    }).then(function (outcome) {
      if (inFlight && inFlight.promise === promise) { inFlight = null; }
      return outcome;
    });
    inFlight = { key: key, promise: promise };
    return promise;
  }

  window.TVHome.weather = {
    CACHE_KEY: CACHE_KEY,
    describe: describe,
    refresh: refresh,
    init: function () {
      refresh(false);
      window.setInterval(function () { refresh(false); }, CHECK_EVERY);
      window.addEventListener('online', function () { refresh(false); });
      window.TVHome.store.onChange(function (settings, changed) {
        if (changed.indexOf('weatherCity') >= 0 || changed.indexOf('weatherUnits') >= 0) { refresh(false); }
        else if (changed.indexOf('locale') >= 0 || changed.indexOf('hour12') >= 0) {
          var cache = readCache();
          if (cache.reading && cache.reading.key === cacheKey(settings)) { refresh(false); }
        }
      });
    }
  };
}());
