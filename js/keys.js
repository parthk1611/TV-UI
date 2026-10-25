(function () {
  'use strict';
  var directions = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' };
  // Samsung IME key codes (developer.samsung.com Keyboard/IME guide).
  var IME_DONE = 65376;
  var IME_CANCEL = 65385;

  function isTextInput(element) {
    return element && element.tagName === 'INPUT';
  }

  function exitApp() {
    if (typeof tizen === 'undefined') {
      console.log('[TV Home mock] Exit');
      window.TVHome.toast('Desktop preview · Back on home would exit TV Home');
      return;
    }
    try { tizen.application.getCurrentApplication().exit(); }
    catch (error) { window.TVHome.toast('Could not exit: ' + error.name); }
  }

  function back() {
    if (window.TVHome.characters.isOpen()) { window.TVHome.characters.close(); return; }
    if (window.TVHome.settings.isOpen()) { window.TVHome.settings.back(); return; }
    exitApp();
  }

  // Maps a keydown to a remote action name, or null.
  function action(event, desktop) {
    var code = event.keyCode;
    if (directions[code]) { return directions[code]; }
    if (code === 13) { return 'ok'; }
    if (code === 10009 || (desktop && (code === 8 || code === 27))) { return 'back'; }
    if (code === 403 || (desktop && event.key && event.key.toLowerCase() === 'r')) { return 'red'; }
    if (code === 406 || (desktop && event.key && event.key.toLowerCase() === 'e')) { return 'edit'; }
    if (code === 9) { return 'tab'; }
    if (code === 10252) { return 'playpause'; }
    return null;
  }

  // While a text field is being edited, keys belong to the field (caret, typing,
  // Backspace). Only Done/Enter (save) and Cancel/Escape/Back (discard) leave it.
  function textKey(event, desktop) {
    var code = event.keyCode;
    // On the TV, OK (13) on a field opens the on-screen keyboard, so only IME Done saves.
    if (code === IME_DONE || (desktop && code === 13)) {
      if (code === 13) { event.preventDefault(); }
      window.TVHome.settings.finishEdit(true);
    } else if (code === IME_CANCEL || code === 10009 || (desktop && code === 27)) {
      event.preventDefault();
      window.TVHome.settings.finishEdit(false);
    } else if (code === 38 || code === 40 || code === 9) {
      event.preventDefault();
      window.TVHome.settings.finishEdit(true);
    }
  }

  window.TVHome.keys = {
    action: action,
    init: function () {
      if (typeof tizen !== 'undefined') {
        ['ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue', 'MediaPlayPause'].forEach(function (key) {
          try { tizen.tvinputdevice.registerKey(key); }
          catch (error) { console.warn('[TV Home] Key unavailable:', key, error.name); }
        });
      }
      document.addEventListener('keydown', function (event) {
        var desktop = typeof tizen === 'undefined';
        if (isTextInput(document.activeElement)) {
          if (window.TVHome.characters.isOpen()) { window.TVHome.characters.textKey(event, desktop); }
          else { textKey(event, desktop); }
          return;
        }
        var name = action(event, desktop);
        if (!name) { return; }
        if (name !== 'playpause') { event.preventDefault(); }
        if (window.TVHome.characters.remoteKey(name, event)) { return; }
        if (window.TVHome.apps.isArranging()) {
          if (!event.repeat || name === 'left' || name === 'right') { window.TVHome.apps.arrangeKey(name); }
          return;
        }
        if (name === 'left' || name === 'right' || name === 'up' || name === 'down') {
          window.TVHome.nav.move(name);
        } else if (name === 'ok') {
          if (!event.repeat && document.activeElement.matches('[data-focusable]')) { document.activeElement.click(); }
        } else if (name === 'back') {
          if (!event.repeat) { back(); }
        } else if (name === 'red') {
          if (!event.repeat && !window.TVHome.characters.isOpen()) { window.TVHome.settings.open(); }
        } else if (name === 'edit') {
          if (!event.repeat && !window.TVHome.settings.isOpen()) { window.TVHome.characters.open(); }
        } else if (name === 'tab') {
          window.TVHome.nav.tab(event.shiftKey);
        } else if (name === 'playpause') {
          window.TVHome.toast('Play / pause received · No media is playing');
        }
      });
      window.addEventListener('focus', function () { window.TVHome.nav.recover(); });
    }
  };
}());
