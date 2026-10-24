(function () {
  'use strict';
  // Bundled photograph and original vector presets (no network needed).
  var WALLPAPERS = [
    { id: 'lake', name: 'Mountain lake', file: 'images/lago-di-braies.jpg' },
    { id: 'ridge', name: 'Misty ridge', file: 'images/wallpaper.svg' },
    { id: 'dusk', name: 'Sea at dusk', file: 'images/wallpaper-dusk.svg' },
    { id: 'aurora', name: 'Northern lights', file: 'images/wallpaper-aurora.svg' },
    { id: 'coast', name: 'Quiet coast', file: 'images/wallpaper-coast.svg' }
  ];

  function find(id) {
    var match = WALLPAPERS[0];
    WALLPAPERS.forEach(function (wallpaper) { if (wallpaper.id === id) { match = wallpaper; } });
    return match;
  }

  window.TVHome.wallpaper = {
    list: function () { return WALLPAPERS.slice(); },
    find: find,
    apply: function () {
      var wallpaper = find(window.TVHome.store.get().wallpaper);
      var element = document.getElementById('wallpaper');
      element.style.backgroundImage = 'url("' + wallpaper.file + '")';
      element.setAttribute('data-wallpaper', wallpaper.id);
      document.getElementById('wallpaper-caption').textContent = wallpaper.id === 'lake' ? 'Lago di Braies, Italy' : wallpaper.name;
    }
  };
}());
