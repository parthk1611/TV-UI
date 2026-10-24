(function () {
  'use strict';
  var previousFocus;
  function panel() { return document.getElementById('settings'); }

  window.TVHome.settings = {
    isOpen: function () { return !panel().hidden; },
    open: function () {
      if (this.isOpen()) { return; }
      previousFocus = document.activeElement;
      panel().hidden = false;
      document.getElementById('home').setAttribute('aria-hidden', 'true');
      window.TVHome.nav.setScope(panel(), document.getElementById('test-remote'));
    },
    close: function () {
      if (!this.isOpen()) { return; }
      panel().hidden = true;
      document.getElementById('home').removeAttribute('aria-hidden');
      window.TVHome.nav.setScope(document.getElementById('home'), previousFocus);
    },
    init: function () {
      document.getElementById('open-settings').addEventListener('click', function () { window.TVHome.settings.open(); });
      document.getElementById('close-settings').addEventListener('click', function () { window.TVHome.settings.close(); });
      document.getElementById('test-remote').addEventListener('click', function () { window.TVHome.toast('OK received · Use ↓ then OK, or Back, to return'); });
    }
  };
}());
