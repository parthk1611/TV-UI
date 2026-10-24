(function () {
  'use strict';
  var mocks = ['Netflix', 'YouTube', 'Prime Video', 'Disney+', 'Plex', 'Spotify'].map(function (name, index) {
    return { id: 'mock.app.' + index, name: name, iconPath: '' };
  });

  function theme(name) {
    var themes = { netflix: 'netflix', youtube: 'youtube', 'prime video': 'prime-video', 'disney+': 'disney', plex: 'plex', spotify: 'spotify' };
    return themes[name.toLowerCase()] || '';
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
        if (app.iconPath) {
          var icon = document.createElement('img');
          icon.className = 'app-icon';
          icon.src = app.iconPath;
          icon.alt = '';
          icon.addEventListener('error', function () { icon.hidden = true; button.classList.remove('has-icon'); });
          button.classList.add('has-icon');
          button.appendChild(icon);
        } else if (theme(app.name) === 'youtube') {
          var play = document.createElement('span');
          play.className = 'play-icon';
          play.setAttribute('aria-hidden', 'true');
          button.appendChild(play);
        }
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
