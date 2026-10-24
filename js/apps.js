(function () {
  'use strict';
  var mocks = ['Netflix', 'YouTube', 'Prime Video', 'Disney+', 'Plex', 'Spotify'].map(function (name, index) {
    return { id: 'mock.app.' + index, name: name, iconPath: '' };
  });

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

  window.TVHome.apps = {
    load: function (done) {
      if (typeof tizen === 'undefined') { done(mocks); return; }
      try {
        tizen.application.getAppsInfo(function (apps) {
          done(apps.filter(function (app) { return app.id !== 'TvHome0001.TVHome' && app.show !== false; }));
        }, function (error) { done([], error); });
      } catch (error) { done([], error); }
    },
    render: function (apps) {
      var container = document.getElementById('apps');
      container.textContent = '';
      apps.forEach(function (app) {
        var button = document.createElement('button');
        button.className = 'app-tile ' + theme(app.name);
        button.setAttribute('data-focusable', '');
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
        button.addEventListener('click', function () { window.TVHome.apps.launch(app); });
        container.appendChild(button);
      });
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
    }
  };
}());
