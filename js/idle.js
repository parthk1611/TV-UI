(function () {
  'use strict';
  // Idle screen: big clock over a slow photo frame of the bundled wallpapers.
  // Any key dismisses it, and that key is swallowed so it never acts on the home screen.
  var PHOTO_EVERY = 45 * 1000;
  var DRIFT_EVERY = 60 * 1000;
  var timer = null;
  var photoTimer = null;
  var driftTimer = null;
  var photoIndex = 0;
  var driftStep = 0;
  // Small offsets (px) cycled to avoid static burn-in on the clock text.
  var DRIFT = [[0, 0], [-36, 18], [28, -22], [40, 26], [-24, -30], [12, 34], [-40, -6], [30, 8]];

  function overlay() { return document.getElementById('idle'); }

  function showPhoto(index) {
    var list = window.TVHome.wallpaper.list();
    var layers = overlay().querySelectorAll('.idle-photo');
    var front = layers[index % 2];
    var back = layers[(index + 1) % 2];
    front.style.backgroundImage = 'url("' + list[index % list.length].file + '")';
    front.classList.add('visible');
    back.classList.remove('visible');
  }

  function drift() {
    driftStep = (driftStep + 1) % DRIFT.length;
    var offset = DRIFT[driftStep];
    document.getElementById('idle-clock-block').style.transform = 'translate(' + offset[0] + 'px, ' + offset[1] + 'px)';
  }

  function schedule() {
    window.clearTimeout(timer);
    timer = null;
    var minutes = window.TVHome.store.get().idleMinutes;
    if (!minutes || window.TVHome.idle.isActive()) { return; }
    timer = window.setTimeout(function () { window.TVHome.idle.show(); }, minutes * 60 * 1000);
  }

  window.TVHome.idle = {
    isActive: function () { return !overlay().hidden; },
    show: function () {
      if (this.isActive()) { return; }
      window.clearTimeout(timer);
      var list = window.TVHome.wallpaper.list();
      var currentId = window.TVHome.store.get().wallpaper;
      list.forEach(function (wallpaper, i) { if (wallpaper.id === currentId) { photoIndex = i; } });
      overlay().hidden = false;
      document.body.classList.add('idle-on');
      window.TVHome.clock.update();
      showPhoto(photoIndex);
      driftStep = 0;
      document.getElementById('idle-clock-block').style.transform = 'translate(0px, 0px)';
      photoTimer = window.setInterval(function () { photoIndex += 1; showPhoto(photoIndex); }, PHOTO_EVERY);
      driftTimer = window.setInterval(drift, DRIFT_EVERY);
    },
    hide: function () {
      if (!this.isActive()) { return; }
      overlay().hidden = true;
      document.body.classList.remove('idle-on');
      window.clearInterval(photoTimer);
      window.clearInterval(driftTimer);
      schedule();
    },
    activity: schedule,
    init: function () {
      // Capture phase on window runs before the app's own keydown handler on document.
      window.addEventListener('keydown', function (event) {
        if (window.TVHome.idle.isActive()) {
          event.preventDefault();
          event.stopImmediatePropagation();
          window.TVHome.idle.hide();
          return;
        }
        schedule();
      }, true);
      var swallowClick = false;
      window.addEventListener('mousedown', function (event) {
        if (window.TVHome.idle.isActive()) {
          event.preventDefault();
          event.stopImmediatePropagation();
          swallowClick = true;
          window.TVHome.idle.hide();
          return;
        }
        schedule();
      }, true);
      window.addEventListener('click', function (event) {
        if (swallowClick && event.isTrusted) {
          swallowClick = false;
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      }, true);
      window.TVHome.store.onChange(function (settings, changed) {
        if (changed.indexOf('idleMinutes') >= 0) { schedule(); }
      });
      schedule();
    }
  };
}());
