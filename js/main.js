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

  function updateClock() {
    var now = new Date();
    var hour = now.getHours();
    document.getElementById('clock').textContent = (hour % 12 || 12) + ':' + String(now.getMinutes()).padStart(2, '0');
    document.getElementById('clock').dateTime = now.toISOString();
    document.getElementById('period').textContent = hour >= 12 ? 'PM' : 'AM';
    document.getElementById('date').textContent = now.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  function init() {
    var desktop = typeof tizen === 'undefined';
    document.getElementById('environment').textContent = desktop ? 'Desktop preview' : 'Samsung TV';
    updateClock();
    window.setInterval(updateClock, 1000);
    window.TVHome.weather.init();
    window.TVHome.settings.init();
    window.TVHome.nav.setScope(document.getElementById('home'));
    window.TVHome.keys.init();
    Array.prototype.forEach.call(document.querySelectorAll('[data-website]'), function (button) {
      button.addEventListener('click', function () {
        window.TVHome.toast(button.getAttribute('data-website') + ' · Website opening comes in Step 3');
      });
    });
    window.TVHome.apps.load(function (apps, error) {
      window.TVHome.apps.render(apps);
      document.getElementById('apps-caption').textContent = desktop ? 'Sample apps · Launches are simulated' : apps.length + ' installed apps';
      if (error || !apps.length) {
        var status = document.getElementById('apps-status');
        status.hidden = false;
        status.textContent = error ? 'Could not read installed apps: ' + error.name : 'No launchable apps found.';
      }
      if (!window.TVHome.settings.isOpen() && document.activeElement === document.getElementById('open-settings')) {
        window.TVHome.nav.setScope(document.getElementById('home'), document.querySelector('#apps [data-focusable]'));
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
}());
