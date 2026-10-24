(function () {
  'use strict';
  var directions = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' };

  function back() {
    if (window.TVHome.settings.isOpen()) { window.TVHome.settings.close(); return; }
    if (typeof tizen === 'undefined') {
      console.log('[TV Home mock] Exit');
      window.TVHome.toast('Desktop preview · Back on home would exit TV Home');
      return;
    }
    try { tizen.application.getCurrentApplication().exit(); }
    catch (error) { window.TVHome.toast('Could not exit: ' + error.name); }
  }

  window.TVHome.keys = {
    init: function () {
      if (typeof tizen !== 'undefined') {
        ['ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue', 'MediaPlayPause'].forEach(function (key) {
          try { tizen.tvinputdevice.registerKey(key); }
          catch (error) { console.warn('[TV Home] Key unavailable:', key, error.name); }
        });
      }
      document.addEventListener('keydown', function (event) {
        var code = event.keyCode;
        var desktop = typeof tizen === 'undefined';
        if (directions[code]) {
          event.preventDefault();
          window.TVHome.nav.move(directions[code]);
        } else if (code === 13) {
          event.preventDefault();
          if (!event.repeat && document.activeElement.matches('[data-focusable]')) { document.activeElement.click(); }
        } else if (code === 10009 || (desktop && (code === 8 || code === 27))) {
          event.preventDefault();
          if (!event.repeat) { back(); }
        } else if (code === 403 || (desktop && event.key.toLowerCase() === 'r')) {
          event.preventDefault();
          if (!event.repeat) { window.TVHome.settings.open(); }
        } else if (code === 9) {
          event.preventDefault();
          window.TVHome.nav.tab(event.shiftKey);
        } else if (code === 10252) {
          window.TVHome.toast('Play / pause received · No media is playing');
        }
      });
      window.addEventListener('focus', function () { window.TVHome.nav.recover(); });
    }
  };
}());
