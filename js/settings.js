(function () {
  'use strict';
  var previousFocus;
  var editing = null;        // field name currently being typed into
  var draft = { id: null, name: '', url: '' };
  var removeArmed = null;    // { id, timer } for the press-OK-twice remove
  var LOCALE_NAMES = { 'en-CA': 'English (Canada)', 'en-US': 'English (US)', 'en-GB': 'English (UK)', 'fr-CA': 'Français (Canada)' };

  function panel() { return document.getElementById('settings'); }
  function $(id) { return document.getElementById(id); }
  function store() { return window.TVHome.store; }
  function setValue(id, text) { $(id).querySelector('.value').textContent = text; }

  function cycle(list, current) { return list[(list.indexOf(current) + 1) % list.length]; }

  function makeButton(text, className, key) {
    var button = document.createElement('button');
    button.className = className;
    button.setAttribute('data-focusable', '');
    button.setAttribute('data-key', key);
    button.textContent = text;
    return button;
  }

  function row(children) {
    var element = document.createElement('div');
    element.className = 'setting-row';
    element.setAttribute('data-nav-row', '');
    children.forEach(function (child) { element.appendChild(child); });
    return element;
  }

  function refocus(key, fallbackId) {
    var target = key ? panel().querySelector('[data-key="' + key + '"]') : null;
    if (!target && fallbackId) { target = $(fallbackId); }
    if (target && target.getClientRects().length) { window.TVHome.nav.focusElement(target); }
  }

  function renderWallpapers() {
    var container = $('wallpaper-options');
    var selected = store().get().wallpaper;
    container.textContent = '';
    window.TVHome.wallpaper.list().forEach(function (wallpaper) {
      var button = makeButton('', 'swatch', 'wallpaper-' + wallpaper.id);
      button.id = 'wallpaper-' + wallpaper.id;
      button.style.backgroundImage = 'url("' + wallpaper.file + '")';
      button.setAttribute('aria-pressed', wallpaper.id === selected ? 'true' : 'false');
      var label = document.createElement('span');
      label.textContent = wallpaper.name;
      button.appendChild(label);
      button.addEventListener('click', function () {
        store().set({ wallpaper: wallpaper.id });
        renderWallpapers();
        refocus('wallpaper-' + wallpaper.id);
      });
      container.appendChild(button);
    });
  }

  function renderValues() {
    var settings = store().get();
    setValue('setting-locale', LOCALE_NAMES[settings.locale] + ' · ' + settings.locale);
    setValue('setting-hour12', settings.hour12 ? '12-hour' : '24-hour');
    var sample = window.TVHome.clock.format(new Date(), settings);
    $('locale-preview').textContent = 'Preview: ' + sample.time + (sample.period ? ' ' + sample.period : '') + ' · ' + sample.date;
    setValue('setting-city', settings.weatherCity);
    setValue('setting-units', settings.weatherUnits === 'fahrenheit' ? '°F' : '°C');
    setValue('setting-idle', settings.idleMinutes ? settings.idleMinutes + ' min' : 'Off');
    setValue('site-name', draft.name || '—');
    setValue('site-url', draft.url || 'https://');
    $('website-form-title').textContent = draft.id ? 'Edit website' : 'Add a website';
    $('site-save').textContent = draft.id ? 'Save changes' : 'Add website';
    $('site-cancel').hidden = !draft.id;
  }

  function renderApps() {
    var container = $('app-visibility');
    var hidden = store().get().hiddenApps;
    container.textContent = '';
    var apps = window.TVHome.apps.all();
    if (!apps.length) {
      var empty = document.createElement('p');
      empty.className = 'setting-note';
      empty.textContent = 'No apps found.';
      container.appendChild(empty);
      return;
    }
    apps.forEach(function (app) {
      var isHidden = hidden.indexOf(app.id) >= 0;
      var button = makeButton(app.name, 'setting-button wide toggle', 'app-' + app.id);
      button.setAttribute('aria-pressed', isHidden ? 'false' : 'true');
      var state = document.createElement('span');
      state.className = 'value';
      state.textContent = isHidden ? 'Hidden' : 'Shown';
      button.appendChild(state);
      button.addEventListener('click', function () {
        var nowHidden = window.TVHome.apps.toggleHidden(app.id);
        renderApps();
        refocus('app-' + app.id);
        window.TVHome.toast(app.name + (nowHidden ? ' hidden from home' : ' shown on home'));
      });
      container.appendChild(row([button]));
    });
  }

  function disarmRemove() {
    if (removeArmed) { window.clearTimeout(removeArmed.timer); removeArmed = null; }
  }

  function renderSites() {
    var container = $('website-list');
    var sites = store().get().websites;
    container.textContent = '';
    if (!sites.length) {
      var empty = document.createElement('p');
      empty.className = 'setting-note';
      empty.textContent = 'No websites yet.';
      container.appendChild(empty);
    }
    sites.forEach(function (site) {
      var edit = makeButton(site.name, 'setting-button wide', 'site-edit-' + site.id);
      var host = document.createElement('span');
      host.className = 'value';
      host.textContent = window.TVHome.websites.host(site.url) + ' · Edit';
      edit.appendChild(host);
      edit.addEventListener('click', function () {
        draft = { id: site.id, name: site.name, url: site.url };
        hideError();
        renderValues();
        refocus(null, 'site-name');
      });
      var armed = removeArmed && removeArmed.id === site.id;
      var remove = makeButton(armed ? 'Press OK again to remove' : 'Remove', 'setting-button danger' + (armed ? ' armed' : ''), 'site-remove-' + site.id);
      remove.addEventListener('click', function () {
        if (removeArmed && removeArmed.id === site.id) {
          disarmRemove();
          window.TVHome.websites.remove(site.id);
          if (draft.id === site.id) { draft = { id: null, name: '', url: '' }; renderValues(); }
          renderSites();
          window.TVHome.toast(site.name + ' removed');
          refocus(null, 'site-name');
          return;
        }
        disarmRemove();
        removeArmed = { id: site.id, timer: window.setTimeout(function () { disarmRemove(); renderSites(); }, 4000) };
        renderSites();
        refocus('site-remove-' + site.id);
      });
      container.appendChild(row([edit, remove]));
    });
  }

  function showError(text) { $('site-error').textContent = text; $('site-error').hidden = false; }
  function hideError() { $('site-error').hidden = true; $('site-error').textContent = ''; }

  function startEdit(field) {
    var input = $('input-' + field);
    var button = panel().querySelector('[data-edit="' + field + '"]');
    var settings = store().get();
    input.value = field === 'city' ? settings.weatherCity : field === 'siteName' ? draft.name : draft.url;
    editing = field;
    button.parentNode.classList.add('editing');
    input.hidden = false;
    button.hidden = true;
    input.focus();
    try { input.setSelectionRange(input.value.length, input.value.length); } catch (error) { /* type=url has no selection API */ }
  }

  window.TVHome.settings = {
    isOpen: function () { return !panel().hidden; },
    isEditing: function () { return !!editing; },
    open: function () {
      if (this.isOpen()) { return; }
      previousFocus = document.activeElement;
      renderWallpapers();
      renderValues();
      renderApps();
      renderSites();
      hideError();
      panel().hidden = false;
      document.getElementById('home').setAttribute('aria-hidden', 'true');
      window.TVHome.nav.setScope(panel(), panel().querySelector('.swatch[aria-pressed="true"]'));
      panel().querySelector('.settings-panel').scrollTop = 0;
    },
    close: function () {
      if (!this.isOpen()) { return; }
      if (editing) { this.finishEdit(false); }
      disarmRemove();
      panel().hidden = true;
      document.getElementById('home').removeAttribute('aria-hidden');
      var target = previousFocus && document.getElementById('home').contains(previousFocus) && previousFocus.getClientRects().length ? previousFocus : null;
      window.TVHome.nav.setScope(document.getElementById('home'), target);
    },
    back: function () {
      if (draft.id) {
        draft = { id: null, name: '', url: '' };
        hideError();
        renderValues();
        refocus(null, 'site-name');
        return;
      }
      this.close();
    },
    // Leave a text field. save=true keeps what was typed.
    finishEdit: function (save) {
      if (!editing) { return; }
      var field = editing;
      var input = $('input-' + field);
      var button = panel().querySelector('[data-edit="' + field + '"]');
      var value = input.value.trim();
      editing = null;
      button.hidden = false;
      button.parentNode.classList.remove('editing');
      window.TVHome.nav.focusElement(button);
      input.blur();
      input.hidden = true;
      if (!save) { return; }
      if (field === 'city') {
        if (!value) { window.TVHome.toast('City can’t be empty'); return; }
        store().set({ weatherCity: value });
        window.TVHome.toast('Weather city set to ' + value);
      } else if (field === 'siteName') {
        draft.name = value;
      } else if (field === 'siteUrl') {
        draft.url = value;
        if (value && !store().validUrl(value)) { showError('That address won’t open. Use http:// or https:// (for example https://example.com).'); }
        else { hideError(); }
      }
      renderValues();
    },
    init: function () {
      $('open-settings').addEventListener('click', function () { window.TVHome.settings.open(); });
      $('close-settings').addEventListener('click', function () { window.TVHome.settings.close(); });
      $('setting-locale').addEventListener('click', function () {
        store().set({ locale: cycle(store().LOCALES, store().get().locale) });
        renderValues();
      });
      $('setting-hour12').addEventListener('click', function () {
        store().set({ hour12: !store().get().hour12 });
        renderValues();
      });
      $('setting-units').addEventListener('click', function () {
        store().set({ weatherUnits: store().get().weatherUnits === 'celsius' ? 'fahrenheit' : 'celsius' });
        renderValues();
      });
      $('weather-refresh').addEventListener('click', function () {
        window.TVHome.toast('Refreshing weather…');
        window.TVHome.weather.refresh(true);
      });
      $('setting-idle').addEventListener('click', function () {
        store().set({ idleMinutes: cycle(store().IDLE_OPTIONS, store().get().idleMinutes) });
        renderValues();
      });
      $('idle-preview').addEventListener('click', function () { window.TVHome.idle.show(); });
      $('arrange-apps').addEventListener('click', function () {
        window.TVHome.settings.close();
        window.TVHome.apps.startArranging();
      });
      Array.prototype.forEach.call(panel().querySelectorAll('[data-edit]'), function (button) {
        button.addEventListener('click', function () { startEdit(button.getAttribute('data-edit')); });
      });
      Array.prototype.forEach.call(panel().querySelectorAll('.text-field'), function (input) {
        // The TV can also close its keyboard by itself (blur); keep what was typed.
        input.addEventListener('blur', function () {
          if (editing && $('input-' + editing) === input) { window.TVHome.settings.finishEdit(true); }
        });
      });
      $('site-save').addEventListener('click', function () {
        var result = window.TVHome.websites.save(draft.id, draft.name, draft.url);
        if (result.error) { showError(result.error); return; }
        var wasEdit = !!draft.id;
        draft = { id: null, name: '', url: '' };
        hideError();
        renderValues();
        renderSites();
        window.TVHome.toast((wasEdit ? 'Saved ' : 'Added ') + result.site.name);
        refocus('site-edit-' + result.site.id);
      });
      $('site-cancel').addEventListener('click', function () { window.TVHome.settings.back(); });
    }
  };
}());
