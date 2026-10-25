(function () {
  'use strict';
  var PRESETS = [
    { id: 'heisenberg', name: 'Heisenberg', title: 'Breaking Bad' },
    { id: 'patrick-jane', name: 'Patrick Jane', title: 'The Mentalist' },
    { id: 'flash', name: 'The Flash', title: 'The Flash' }
  ];
  var FIELDS = [
    { key: 'title', label: 'Movie or series', max: 80 },
    { key: 'name', label: 'Character name', max: 60 },
    { key: 'url', label: 'Website link', max: 1000 }
  ];
  var selectedId = null;
  var draft = null;
  var previousFocus = null;
  var editing = null;
  var held = null;
  var removeTimer = null;
  var removeArmed = false;
  var session = 0;
  var importing = false;

  function $(id) { return document.getElementById(id); }
  function list() { return window.TVHome.store.get().characters; }
  function art(item) { return item.image || 'images/characters/' + item.art + '.webp'; }
  function selected() {
    var items = list();
    var match = items[0] || null;
    items.forEach(function (item) { if (item.id === selectedId) { match = item; } });
    return match;
  }
  function button(text, className) {
    var element = document.createElement('button');
    element.type = 'button';
    element.className = className;
    element.textContent = text;
    element.setAttribute('data-focusable', '');
    return element;
  }
  function image(item, className) {
    var element = document.createElement('img');
    element.className = className;
    element.alt = '';
    element.draggable = false;
    element.src = art(item);
    element.addEventListener('error', function () {
      if (element.getAttribute('data-fallback')) { element.hidden = true; return; }
      element.setAttribute('data-fallback', 'true');
      element.src = 'images/characters/' + item.art + '.webp';
    });
    return element;
  }
  function pick(id) {
    selectedId = id;
    var item = selected();
    $('story-title').textContent = item ? item.title : 'Make it yours.';
    $('story-character').textContent = item ? item.name : 'Your favourite characters, one press away.';
    $('story-description').textContent = item ? 'Your characters. Your next watch.' : 'Add a character and a link to your next watch.';
    $('story-destination').textContent = item ? window.TVHome.websites.host(item.url) + ' · ' + (/^https:\/\/net77\.cc\/home\/?$/.test(item.url) ? 'Opens website home · Edit to add a title link' : 'Your saved website link') : '';
    $('characters').querySelectorAll('[data-character-id]').forEach(function (tile) {
      var active = item && tile.getAttribute('data-character-id') === item.id;
      tile.classList.toggle('selected', !!active);
      tile.setAttribute('aria-current', active ? 'true' : 'false');
    });
    $('home').setAttribute('data-character-art', item ? item.art : 'none');
  }
  function cancelHold() {
    if (held) { window.clearTimeout(held.timer); held = null; }
  }
  function showError(text) { $('character-error').textContent = text; $('character-error').hidden = !text; }
  function disarmRemove() {
    window.clearTimeout(removeTimer);
    removeArmed = false;
    $('character-remove').textContent = 'Remove shortcut';
  }
  function renderDraft() {
    $('character-preview').src = art(draft);
    $('character-preview-title').textContent = draft.title;
    FIELDS.forEach(function (field) {
      $('character-field-' + field.key).querySelector('.value').textContent = draft[field.key] || (field.key === 'url' ? 'https://' : '—');
    });
    $('character-presets').querySelectorAll('button').forEach(function (tile) {
      tile.setAttribute('aria-pressed', !draft.image && tile.getAttribute('data-art') === draft.art ? 'true' : 'false');
    });
    var items = list();
    var index = items.map(function (item) { return item.id; }).indexOf(draft.id);
    $('character-order-actions').hidden = index < 0;
    $('character-remove-row').hidden = index < 0;
    $('character-left').disabled = index <= 0;
    $('character-right').disabled = index < 0 || index >= items.length - 1;
    $('character-save').disabled = importing;
  }
  function finishEdit(save) {
    if (!editing) { return; }
    var key = editing;
    var input = $('character-input-' + key);
    var control = $('character-field-' + key);
    editing = null;
    if (save) { draft[key] = input.value.trim(); }
    input.hidden = true;
    control.hidden = false;
    renderDraft();
    window.TVHome.nav.focusElement(control);
  }
  function editField(key) {
    var input = $('character-input-' + key);
    editing = key;
    $('character-field-' + key).hidden = true;
    input.value = draft[key];
    input.hidden = false;
    input.focus();
  }
  function persist(items) {
    var saved = window.TVHome.store.set({ characters: items });
    return JSON.stringify(saved.characters) === JSON.stringify(items);
  }
  function importImage(file) {
    if (!file || !draft) { return; }
    if (['image/png', 'image/jpeg', 'image/webp'].indexOf(file.type) < 0 || file.size > 8 * 1024 * 1024) {
      showError('Choose a PNG, JPEG or WebP smaller than 8 MB.'); return;
    }
    var ownSession = session;
    importing = true;
    $('character-import-status').textContent = 'Preparing your image…';
    renderDraft();
    function failed() {
      if (session !== ownSession) { return; }
      importing = false;
      showError('This image could not be read. Try another PNG, JPEG or WebP.');
      $('character-import-status').textContent = 'Image not imported.';
      renderDraft();
    }
    var reader = new FileReader();
    reader.onerror = failed;
    reader.onload = function () {
      if (session !== ownSession) { return; }
      var picture = new Image();
      picture.onerror = failed;
      picture.onload = function () {
        if (session !== ownSession) { return; }
        var ratio = Math.min(1, 600 / picture.naturalWidth, 800 / picture.naturalHeight);
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(picture.naturalWidth * ratio));
        canvas.height = Math.max(1, Math.round(picture.naturalHeight * ratio));
        try {
          canvas.getContext('2d').drawImage(picture, 0, 0, canvas.width, canvas.height);
          var data = canvas.toDataURL('image/webp', .85);
          if (data.length > 550000) { data = canvas.toDataURL('image/webp', .55); }
          if (data.length > 550000) { failed(); return; }
          draft.image = data;
          importing = false;
          showError('');
          $('character-import-status').textContent = 'Your image is ready. Save shortcut to keep it.';
          renderDraft();
        } catch (error) { failed(); }
      };
      picture.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  window.TVHome.characters = {
    isOpen: function () { return !$('character-editor').hidden; },
    render: function () {
      var focusedId = document.activeElement && document.activeElement.getAttribute('data-character-id');
      var container = $('characters');
      var items = list();
      container.textContent = '';
      items.forEach(function (item) {
        var tile = button('', 'character-tile');
        tile.setAttribute('data-character-id', item.id);
        tile.setAttribute('aria-label', 'Open ' + item.title + ' · ' + item.name);
        tile.setAttribute('aria-describedby', 'story-destination');
        tile.appendChild(image(item, 'character-art'));
        var label = document.createElement('span');
        label.className = 'character-label';
        var name = document.createElement('strong');
        name.textContent = item.name;
        var title = document.createElement('span');
        title.textContent = item.title;
        label.appendChild(name);
        label.appendChild(title);
        tile.appendChild(label);
        tile.addEventListener('focus', function () { pick(item.id); });
        tile.addEventListener('click', function () { pick(item.id); window.TVHome.websites.open({ name: item.title, url: item.url }); });
        tile.addEventListener('contextmenu', function (event) { event.preventDefault(); window.TVHome.characters.open(item.id); });
        container.appendChild(tile);
      });
      var add = button('+', 'character-add');
      add.id = 'character-add';
      add.setAttribute('aria-label', 'Add character shortcut');
      add.disabled = items.length >= 8;
      add.addEventListener('click', function () { window.TVHome.characters.open(null, true); });
      container.appendChild(add);
      $('character-count').textContent = items.length + ' saved ' + (items.length === 1 ? 'shortcut' : 'shortcuts');
      pick(selectedId);
      if (focusedId) {
        var again = container.querySelector('[data-character-id="' + focusedId + '"]');
        if (again) { window.TVHome.nav.focusElement(again); }
      }
    },
    open: function (id, adding) {
      if (this.isOpen() || window.TVHome.settings.isOpen()) { return; }
      cancelHold();
      session += 1;
      importing = false;
      previousFocus = document.activeElement;
      if (id) { selectedId = id; }
      var item = adding ? null : selected();
      if (!item && list().length >= 8) { window.TVHome.toast('You can keep up to 8 character shortcuts.'); return; }
      draft = item ? JSON.parse(JSON.stringify(item)) : { id: null, name: '', title: '', art: 'heisenberg', image: '', url: 'https://net77.cc/home' };
      $('character-editor-title').textContent = item ? 'Edit shortcut' : 'Add a shortcut';
      $('character-import-status').textContent = 'PNG, JPEG or WebP. Transparent artwork works best.';
      $('character-file').value = '';
      showError('');
      disarmRemove();
      renderDraft();
      $('character-editor').hidden = false;
      $('home').setAttribute('aria-hidden', 'true');
      window.TVHome.nav.setScope($('character-editor'), $('character-presets').querySelector('[aria-pressed="true"]') || $('character-presets').querySelector('button'));
      $('character-editor').querySelector('.settings-panel').scrollTop = 0;
    },
    close: function () {
      if (!this.isOpen()) { return; }
      if (editing) { finishEdit(false); }
      session += 1;
      importing = false;
      disarmRemove();
      $('character-editor').hidden = true;
      $('home').removeAttribute('aria-hidden');
      var target = previousFocus && previousFocus.isConnected && previousFocus.getClientRects().length ? previousFocus : $('characters').querySelector('[data-character-id="' + selectedId + '"]') || $('character-add');
      window.TVHome.nav.setScope($('home'), target);
      draft = null;
    },
    textKey: function (event, desktop) {
      var code = event.keyCode;
      if (code === 65376 || desktop && code === 13 || code === 38 || code === 40 || code === 9) {
        event.preventDefault(); finishEdit(true);
      } else if (code === 65385 || code === 10009 || desktop && code === 27) {
        event.preventDefault(); finishEdit(false);
      }
    },
    remoteKey: function (name, event) {
      if (name !== 'ok') { cancelHold(); return false; }
      if (this.isOpen() || !document.activeElement.hasAttribute('data-character-id')) { return false; }
      if (!held && !event.repeat) {
        var tile = document.activeElement;
        held = { tile: tile, timer: window.setTimeout(function () {
          if (held && document.activeElement === tile) { window.TVHome.characters.open(tile.getAttribute('data-character-id')); }
          else { cancelHold(); }
        }, 650) };
      }
      return true;
    },
    init: function () {
      var presets = $('character-presets');
      PRESETS.forEach(function (preset) {
        var tile = button(preset.name, 'setting-button character-preset');
        tile.setAttribute('data-art', preset.id);
        tile.addEventListener('click', function () {
          session += 1;
          importing = false;
          draft.art = preset.id;
          draft.image = '';
          draft.name = preset.name;
          draft.title = preset.title;
          $('character-import-status').textContent = 'Starter artwork selected. Your website link is unchanged.';
          showError('');
          renderDraft();
        });
        presets.appendChild(tile);
      });
      FIELDS.forEach(function (field) {
        var row = document.createElement('div');
        row.className = 'setting-row field';
        row.setAttribute('data-nav-row', '');
        var control = button(field.label, 'setting-button wide');
        control.id = 'character-field-' + field.key;
        var value = document.createElement('span');
        value.className = 'value';
        control.appendChild(value);
        control.addEventListener('click', function () { editField(field.key); });
        var input = document.createElement('input');
        input.id = 'character-input-' + field.key;
        input.className = 'text-field';
        input.type = field.key === 'url' ? 'url' : 'text';
        input.maxLength = field.max;
        input.setAttribute('aria-label', field.label);
        input.autocomplete = 'off';
        input.hidden = true;
        input.addEventListener('blur', function () { if (editing === field.key) { finishEdit(true); } });
        row.appendChild(control);
        row.appendChild(input);
        $('character-fields').appendChild(row);
      });
      $('edit-characters').addEventListener('click', function () { window.TVHome.characters.open(); });
      $('character-cancel').addEventListener('click', function () { window.TVHome.characters.close(); });
      $('character-import').addEventListener('click', function () { $('character-file').click(); });
      $('character-file').addEventListener('change', function () { importImage(this.files[0]); });
      $('character-save').addEventListener('click', function () {
        var url = window.TVHome.store.validUrl(draft.url);
        if (!draft.title.trim() || !draft.name.trim()) { showError('Add a movie or series title and a character name.'); return; }
        if (!url) { showError('Use a valid http:// or https:// website link.'); return; }
        var item = { id: draft.id || 'character-' + Date.now().toString(36) + Math.floor(Math.random() * 1000),
          name: draft.name.trim().slice(0, 60), title: draft.title.trim().slice(0, 80), art: draft.art, image: draft.image, url: url };
        var items = list();
        if (draft.id) { items = items.map(function (existing) { return existing.id === item.id ? item : existing; }); }
        else if (items.length < 8) { items.push(item); }
        else { showError('You can keep up to 8 shortcuts. Remove one to add another.'); return; }
        if (!persist(items)) { showError('The shortcut could not be saved. Storage may be full; try smaller artwork.'); return; }
        selectedId = item.id;
        pick(item.id);
        window.TVHome.characters.close();
        window.TVHome.nav.focusElement($('characters').querySelector('[data-character-id="' + item.id + '"]'));
        window.TVHome.toast('Saved ' + item.title);
      });
      ['left', 'right'].forEach(function (direction) {
        $('character-' + direction).addEventListener('click', function () {
          var items = list();
          var index = items.map(function (item) { return item.id; }).indexOf(draft.id);
          var next = index + (direction === 'left' ? -1 : 1);
          if (index < 0 || !items[next]) { return; }
          var moved = items.splice(index, 1)[0];
          items.splice(next, 0, moved);
          if (!persist(items)) { showError('The order could not be saved.'); return; }
          renderDraft();
          if ($('character-' + direction).disabled) { window.TVHome.nav.focusElement($('character-save')); }
          window.TVHome.toast('Shortcut moved ' + direction);
        });
      });
      $('character-remove').addEventListener('click', function () {
        if (!removeArmed) {
          removeArmed = true;
          this.textContent = 'Press OK again to remove';
          removeTimer = window.setTimeout(disarmRemove, 4000);
          return;
        }
        var items = list().filter(function (item) { return item.id !== draft.id; });
        if (!persist(items)) { showError('The shortcut could not be removed.'); return; }
        selectedId = items.length ? items[0].id : null;
        pick(selectedId);
        window.TVHome.characters.close();
        window.TVHome.nav.focusElement($('characters').querySelector('[data-character-id]') || $('character-add'));
        window.TVHome.toast('Shortcut removed');
      });
      document.addEventListener('keyup', function (event) {
        if (event.keyCode !== 13 || !held) { return; }
        var tile = held.tile;
        cancelHold();
        if (document.activeElement === tile && !window.TVHome.characters.isOpen()) { tile.click(); }
      });
      window.addEventListener('blur', cancelHold);
      document.addEventListener('visibilitychange', function () { if (document.hidden) { cancelHold(); } });
      this.render();
    }
  };
}());
