(function () {
  'use strict';
  var toastTimer;
  window.TVHome.toast = function (message) {
    var toast = document.getElementById('toast');
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = window.setTimeout(function () { toast.hidden = true; }, 3500);
  };

  function pad(value) { return (value < 10 ? '0' : '') + value; }

  // Time and date use the saved locale and 12/24-hour choice.
  function parts(now, settings) {
    var time = '';
    var period = '';
    try {
      new Intl.DateTimeFormat(settings.locale, { hour: 'numeric', minute: '2-digit', hour12: settings.hour12 })
        .formatToParts(now).forEach(function (part) {
          if (part.type === 'dayPeriod') { period = part.value; }
          else if (part.type === 'hour' || part.type === 'minute' || (part.type === 'literal' && time && !period)) { time += part.value; }
        });
      time = time.trim();
    } catch (error) {
      var hour = now.getHours();
      time = (settings.hour12 ? (hour % 12 || 12) : pad(hour)) + ':' + pad(now.getMinutes());
      period = settings.hour12 ? (hour >= 12 ? 'PM' : 'AM') : '';
    }
    var date;
    try { date = now.toLocaleDateString(settings.locale, { weekday: 'long', month: 'long', day: 'numeric' }); }
    catch (error) { date = now.toDateString(); }
    return { time: time, period: settings.hour12 ? period : '', date: date };
  }

  window.TVHome.clock = {
    format: parts,
    update: function () {
      var now = new Date();
      var text = parts(now, window.TVHome.store.get());
      ['', 'idle-'].forEach(function (prefix) {
        var clock = document.getElementById(prefix + 'clock');
        clock.textContent = text.time;
        clock.setAttribute('datetime', now.toISOString());
        document.getElementById(prefix + 'period').textContent = text.period;
        document.getElementById(prefix + 'date').textContent = text.date;
      });
    }
  };

  function loadApps() {
    var desktop = typeof tizen === 'undefined';
    window.TVHome.apps.load(function (apps, error) {
      window.TVHome.apps.render();
      var shown = document.querySelectorAll('#apps [data-focusable]').length;
      var hiddenCount = apps.length - shown;
      document.getElementById('apps-caption').textContent = (desktop ? 'Sample apps · Launches are simulated' : apps.length + ' installed apps') +
        (hiddenCount > 0 ? ' · ' + hiddenCount + ' hidden' : '');
      var status = document.getElementById('apps-status');
      if (error || !apps.length) {
        status.hidden = false;
        status.textContent = error ? 'Could not read installed apps: ' + error.name : 'No launchable apps found.';
      } else if (!shown) {
        status.hidden = false;
        status.textContent = 'All apps are hidden. Show them again in Settings.';
      } else {
        status.hidden = true;
      }
      if (!window.TVHome.settings.isOpen() && document.activeElement === document.getElementById('open-settings')) {
        var first = document.querySelector('#apps [data-focusable]');
        if (first) { window.TVHome.nav.setScope(document.getElementById('home'), first); }
      }
    });
  }

  function init() {
    var desktop = typeof tizen === 'undefined';
    document.getElementById('environment').textContent = desktop ? 'Desktop preview' : 'Samsung TV';
    window.TVHome.wallpaper.apply();
    window.TVHome.clock.update();
    window.setInterval(window.TVHome.clock.update, 1000);
    window.TVHome.websites.render();
    window.TVHome.weather.init();
    window.TVHome.settings.init();
    window.TVHome.characters.init();
    window.TVHome.nav.setScope(document.getElementById('home'), document.getElementById('open-settings'));
    window.TVHome.idle.init();
    window.TVHome.keys.init();
    window.TVHome.store.onChange(function (settings, changed) {
      if (changed.indexOf('wallpaper') >= 0) { window.TVHome.wallpaper.apply(); }
      if (changed.indexOf('locale') >= 0 || changed.indexOf('hour12') >= 0) { window.TVHome.clock.update(); }
      if (changed.indexOf('websites') >= 0) { window.TVHome.websites.render(); }
      if (changed.indexOf('characters') >= 0) { window.TVHome.characters.render(); }
      if (changed.indexOf('appOrder') >= 0 || changed.indexOf('hiddenApps') >= 0) {
        window.TVHome.apps.render();
        var shown = document.querySelectorAll('#apps [data-focusable]').length;
        var total = window.TVHome.apps.all().length;
        var status = document.getElementById('apps-status');
        status.hidden = !(total && !shown);
        status.textContent = total && !shown ? 'All apps are hidden. Show them again in Settings.' : '';
        var caption = document.getElementById('apps-caption');
        caption.textContent = caption.textContent.replace(/ · \d+ hidden$/, '') + (total - shown > 0 ? ' · ' + (total - shown) + ' hidden' : '');
      }
    });
    loadApps();
  }

  document.addEventListener('DOMContentLoaded', init);
}());
