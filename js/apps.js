(function () {
  'use strict';
  var mocks = ['Netflix', 'YouTube', 'Prime Video', 'Disney+', 'Plex', 'Spotify'].map(function (name, index) {
    return { id: 'mock.app.' + index, name: name, iconPath: '' };
  });
  var installed = [];
  var arranging = null; // { held: appId|null, heldBefore: [ids] while a tile is held }

  function theme(name) {
    var themes = { netflix: 'netflix', youtube: 'youtube', 'prime video': 'prime-video', 'disney+': 'disney', plex: 'plex', spotify: 'spotify' };
    return themes[name.toLowerCase()] || '';
  }

  function artwork(name) {
    var logos = {
      netflix: '<path fill="currentColor" d="M12 7h9v50h-9zm31 0h9v50h-9z"/><path fill="currentColor" d="m12 7 9 0 31 50h-9Z"/>',
      youtube: '<rect x="3" y="12" width="58" height="40" rx="12" fill="currentColor"/><path fill="#fafaf8" d="m26 22 18 10-18 10Z"/>',
      spotify: '<circle cx="32" cy="32" r="28" fill="currentColor"/><g fill="none" stroke="#17251d" stroke-width="4" stroke-linecap="round"><path d="M16 25q17-7 33 2M18 34q15-6 28 2M21 43q11-4 22 1"/></g>'
    };
    var kind = theme(name);
    if (logos[kind]) {
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 64 64');
      svg.setAttribute('class', 'app-logo');
      svg.setAttribute('aria-hidden', 'true');
      svg.innerHTML = logos[kind];
      return svg;
    }
    var word = document.createElement('span');
    word.className = 'logo-word';
    word.setAttribute('aria-hidden', 'true');
    word.textContent = kind === 'prime-video' ? 'prime video' : name;
    return word;
  }

  // Installed apps in the saved order; apps not in the saved order keep discovery order at the end.
  function ordered() {
    var order = window.TVHome.store.get().appOrder;
    return installed.slice().sort(function (a, b) {
      var ia = order.indexOf(a.id);
      var ib = order.indexOf(b.id);
      if (ia < 0 && ib < 0) { return installed.indexOf(a) - installed.indexOf(b); }
      if (ia < 0) { return 1; }
      if (ib < 0) { return -1; }
      return ia - ib;
    });
  }

  function visible() {
    var hidden = window.TVHome.store.get().hiddenApps;
    return ordered().filter(function (app) { return hidden.indexOf(app.id) < 0; });
  }

  function tile(app) {
    var button = document.createElement('button');
    button.className = 'app-tile ' + theme(app.name);
    button.setAttribute('data-focusable', '');
    button.setAttribute('data-app-id', app.id);
    button.setAttribute('aria-label', 'Open ' + app.name);
    var art = document.createElement('span');
    art.className = 'app-art';
    if (app.iconPath) {
      var icon = document.createElement('img');
      icon.className = 'app-icon';
      icon.src = app.iconPath;
      icon.alt = '';
      icon.addEventListener('error', function () { icon.hidden = true; art.appendChild(artwork(app.name)); });
      button.classList.add('has-icon');
      art.appendChild(icon);
    } else {
      art.appendChild(artwork(app.name));
    }
    button.appendChild(art);
    var label = document.createElement('span');
    label.className = 'app-name';
    label.textContent = app.name;
    button.appendChild(label);
    button.addEventListener('click', function () {
      if (arranging) { return; }
      window.TVHome.apps.launch(app);
    });
    return button;
  }

  function focusApp(id) {
    var button = document.querySelector('#apps [data-app-id="' + String(id).replace(/["\\]/g, '\\$&') + '"]');
    if (button) { window.TVHome.nav.focusElement(button); }
  }

  function setBanner(text) {
    var banner = document.getElementById('arrange-banner');
    banner.hidden = !text;
    banner.textContent = text || '';
  }

  // Move the held app one visible slot left/right inside the full saved order (hidden apps keep their place).
  function shift(direction) {
    var list = visible();
    var index = -1;
    list.forEach(function (app, i) { if (app.id === arranging.held) { index = i; } });
    var target = list[index + direction];
    if (index < 0 || !target) { return; }
    var full = ordered().map(function (app) { return app.id; });
    full.splice(full.indexOf(arranging.held), 1);
    var at = full.indexOf(target.id);
    full.splice(direction > 0 ? at + 1 : at, 0, arranging.held);
    window.TVHome.store.set({ appOrder: full });
  }

  window.TVHome.apps = {
    all: function () { return ordered(); },
    load: function (done) {
      function finish(apps, error) {
        installed = apps;
        done(apps, error);
      }
      if (typeof tizen === 'undefined') { finish(mocks.slice()); return; }
      try {
        tizen.application.getAppsInfo(function (apps) {
          finish(apps.filter(function (app) { return app.id !== 'TvHome0001.TVHome' && app.show !== false; }));
        }, function (error) { finish([], error); });
      } catch (error) { finish([], error); }
    },
    render: function () {
      var container = document.getElementById('apps');
      var focusedId = document.activeElement && document.activeElement.getAttribute('data-app-id');
      container.textContent = '';
      visible().forEach(function (app) {
        var button = tile(app);
        if (arranging && arranging.held === app.id) { button.classList.add('held'); }
        container.appendChild(button);
      });
      if (focusedId) { focusApp(focusedId); }
    },
    launch: function (app) {
      if (typeof tizen === 'undefined') {
        console.log('[TV Home mock] Launch:', app.id, app.name);
        window.TVHome.toast('Desktop preview · Would open ' + app.name);
        return;
      }
      try {
        tizen.application.launch(app.id, function () {}, function (error) {
          window.TVHome.toast('Could not open ' + app.name + ': ' + error.name);
        });
      } catch (error) { window.TVHome.toast('Could not open ' + app.name + ': ' + error.name); }
    },
    isArranging: function () { return !!arranging; },
    startArranging: function () {
      if (!visible().length) { window.TVHome.toast('No apps to arrange'); return false; }
      arranging = { held: null, heldBefore: null };
      document.body.classList.add('arranging');
      setBanner('Arrange apps · OK picks up a tile · ← → move it · OK drops · Back when done');
      window.TVHome.nav.setScope(document.getElementById('home'), document.querySelector('#apps [data-focusable]'));
      return true;
    },
    stopArranging: function () {
      arranging = null;
      document.body.classList.remove('arranging');
      setBanner('');
      this.render();
      window.TVHome.toast('App order saved');
    },
    // Keys while arranging: returns nothing; every key is consumed here.
    arrangeKey: function (action) {
      var current = document.activeElement && document.activeElement.getAttribute('data-app-id');
      if (action === 'ok') {
        if (arranging.held) {
          arranging.held = null;
          setBanner('Arrange apps · OK picks up a tile · ← → move it · OK drops · Back when done');
        } else if (current) {
          arranging.held = current;
          arranging.heldBefore = ordered().map(function (app) { return app.id; });
          setBanner('Moving · ← → to move · OK to drop here · Back cancels this move');
        }
        this.render();
      } else if (action === 'left' || action === 'right') {
        if (arranging.held) {
          shift(action === 'left' ? -1 : 1);
          this.render();
          focusApp(arranging.held);
        } else {
          window.TVHome.nav.move(action);
        }
      } else if (action === 'back') {
        if (arranging.held) {
          var held = arranging.held;
          window.TVHome.store.set({ appOrder: arranging.heldBefore });
          arranging.held = null;
          setBanner('Arrange apps · OK picks up a tile · ← → move it · OK drops · Back when done');
          this.render();
          focusApp(held);
        } else {
          this.stopArranging();
        }
      }
    },
    toggleHidden: function (id) {
      var hidden = window.TVHome.store.get().hiddenApps;
      var index = hidden.indexOf(id);
      if (index >= 0) { hidden.splice(index, 1); } else { hidden.push(id); }
      window.TVHome.store.set({ hiddenApps: hidden });
      return index < 0;
    }
  };
}());
