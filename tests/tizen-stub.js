/*
 * Fake window.tizen for Playwright tests. NOT part of the app; never package.
 *
 * Inject with page.addInitScript({ path: 'tests/tizen-stub.js' }) so it runs
 * before the app's own scripts. Configure it by setting
 * window.__TIZEN_STUB_CONFIG__ in an earlier addInitScript call:
 *
 *   {
 *     apps:            [ { id, name, iconPath, show } ... ]  // replaces the default list
 *     getAppsInfoError: { name: 'UnknownError', message: '...' }  // error callback is called
 *     getAppsInfoThrow: { name: 'SecurityError', message: '...' } // getAppsInfo throws
 *     launchError:      { name: 'NotFoundError', message: '...' } // launch error callback
 *     launchThrow:      { name: 'InvalidValuesError', ... }       // launch throws
 *     registerKeyThrow: ['MediaPlayPause']                         // registerKey throws for these
 *     launchAppControlError: { name: 'NotFoundError' }  // error callback for every launchAppControl
 *     launchAppControlErrorOnce: { name: 'NotFoundError' } // error callback for the first call only
 *     launchAppControlThrow: { name: 'TypeMismatchError' } // launchAppControl throws
 *     launchAppControlThrowOnce: { name: 'TypeMismatchError' } // throws on the first call only
 *     async:            true   // deliver callbacks on a timer (default: false = synchronous)
 *   }
 *
 * Every API call is recorded on window.__tizenCalls as { api, args }.
 * launchAppControl records [ { operation, uri, mime, category, data }, appId ].
 */
(function () {
  'use strict';
  var config = window.__TIZEN_STUB_CONFIG__ || {};
  var calls = window.__tizenCalls = [];

  var DEFAULT_APPS = [
    { id: 'TvHome0001.TVHome', name: 'TVHome', iconPath: '', show: true },          // the app itself, must be filtered out
    { id: 'org.tizen.hidden-service', name: 'Hidden Service', iconPath: '', show: false }, // must be filtered out
    { id: 'netflix.app', name: 'Netflix', iconPath: '', show: true },
    { id: 'youtube.app', name: 'YouTube', iconPath: '', show: true },
    { id: 'prime.app', name: 'Prime Video', iconPath: '', show: true },
    { id: 'disney.app', name: 'Disney+', iconPath: '', show: true },
    { id: 'plex.app', name: 'Plex', iconPath: '', show: true },
    { id: 'spotify.app', name: 'Spotify', iconPath: '', show: true },
    { id: 'twitch.app', name: 'Twitch', iconPath: '', show: true },
    { id: 'crave.app', name: 'Crave', iconPath: '', show: true },
    { id: 'apple.tv', name: 'Apple TV', iconPath: '' } // no `show` field: treated as visible
  ];

  function webApiError(spec) {
    var error = new Error(spec.message || spec.name);
    error.name = spec.name || 'UnknownError';
    return error;
  }

  function deliver(fn) {
    if (config.async) { window.setTimeout(fn, 10); } else { fn(); }
  }

  function record(api, args) {
    calls.push({ api: api, args: Array.prototype.slice.call(args) });
  }

  var appControlCalls = 0;

  function ApplicationControl(operation, uri, mime, category, data, launchMode) {
    if (!(this instanceof ApplicationControl)) { throw new TypeError('ApplicationControl must be called with new'); }
    this.operation = operation;
    this.uri = uri === undefined ? null : uri;
    this.mime = mime === undefined ? null : mime;
    this.category = category === undefined ? null : category;
    this.data = data || [];
    this.launchMode = launchMode || 'SINGLE';
  }

  function ApplicationControlData(key, value) {
    if (!(this instanceof ApplicationControlData)) { throw new TypeError('ApplicationControlData must be called with new'); }
    this.key = key;
    this.value = value;
  }

  var currentApp = {
    appInfo: { id: 'TvHome0001.TVHome', name: 'TVHome' },
    exit: function () { record('application.getCurrentApplication().exit', arguments); },
    hide: function () { record('application.getCurrentApplication().hide', arguments); }
  };

  window.tizen = {
    ApplicationControl: ApplicationControl,
    ApplicationControlData: ApplicationControlData,
    application: {
      getAppsInfo: function (success, error) {
        record('application.getAppsInfo', []);
        if (config.getAppsInfoThrow) { throw webApiError(config.getAppsInfoThrow); }
        deliver(function () {
          if (config.getAppsInfoError) {
            if (typeof error === 'function') { error(webApiError(config.getAppsInfoError)); }
            return;
          }
          var list = (config.apps || DEFAULT_APPS).map(function (app) {
            var copy = {};
            Object.keys(app).forEach(function (key) { copy[key] = app[key]; });
            return copy;
          });
          success(list);
        });
      },
      launch: function (id, success, error) {
        record('application.launch', [id]);
        if (config.launchThrow) { throw webApiError(config.launchThrow); }
        deliver(function () {
          if (config.launchError) {
            if (typeof error === 'function') { error(webApiError(config.launchError)); }
            return;
          }
          if (typeof success === 'function') { success(); }
        });
      },
      launchAppControl: function (control, appId, success, error) {
        appControlCalls += 1;
        if (!(control instanceof ApplicationControl)) { throw webApiError({ name: 'TypeMismatchError', message: 'Not an ApplicationControl' }); }
        record('application.launchAppControl', [{
          operation: control.operation, uri: control.uri, mime: control.mime, category: control.category, data: control.data
        }, appId === undefined ? null : appId]);
        if (config.launchAppControlThrow) { throw webApiError(config.launchAppControlThrow); }
        if (config.launchAppControlThrowOnce && appControlCalls === 1) { throw webApiError(config.launchAppControlThrowOnce); }
        var failure = config.launchAppControlError || (appControlCalls === 1 ? config.launchAppControlErrorOnce : null);
        deliver(function () {
          if (failure) {
            if (typeof error === 'function') { error(webApiError(failure)); }
            return;
          }
          if (typeof success === 'function') { success(); }
        });
      },
      getCurrentApplication: function () {
        record('application.getCurrentApplication', []);
        return currentApp;
      }
    },
    tvinputdevice: {
      registerKey: function (name) {
        record('tvinputdevice.registerKey', [name]);
        if (config.registerKeyThrow && config.registerKeyThrow.indexOf(name) !== -1) {
          throw webApiError({ name: 'InvalidValuesError', message: 'Key not supported: ' + name });
        }
      },
      unregisterKey: function (name) { record('tvinputdevice.unregisterKey', [name]); }
    }
  };

  window.__TIZEN_STUB_DEFAULT_APPS__ = DEFAULT_APPS;
}());
