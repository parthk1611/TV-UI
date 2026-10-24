(function () {
  'use strict';
  var VIEW = 'http://tizen.org/appcontrol/operation/view';
  var BROWSER_ID = 'org.tizen.browser'; // fallback only; TV-unverified

  function host(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (error) { return url; }
  }

  function symbol(site) {
    var h = host(site.url);
    if (/(^|\.)youtube\.com$/.test(h)) { return { text: '▶', className: '' }; }
    if (/(^|\.)wikipedia\.org$/.test(h)) { return { text: 'W', className: 'serif' }; }
    if (/(^|\.)bbc\.(com|co\.uk)$/.test(h)) { return { text: 'BBC', className: 'bbc' }; }
    return { text: site.name.charAt(0).toUpperCase(), className: 'letter' };
  }

  function launchControl(url, appId, onError) {
    var control = new tizen.ApplicationControl(VIEW, url, null, null, null);
    tizen.application.launchAppControl(control, appId, function () {}, onError, null);
  }

  window.TVHome.websites = {
    host: host,
    render: function () {
      var container = document.getElementById('websites');
      var focusedId = document.activeElement && document.activeElement.getAttribute('data-site-id');
      var sites = window.TVHome.store.get().websites;
      container.textContent = '';
      sites.forEach(function (site) {
        var button = document.createElement('button');
        var mark = symbol(site);
        button.className = 'website-tile';
        button.setAttribute('data-focusable', '');
        button.setAttribute('data-site-id', site.id);
        button.setAttribute('data-website', site.name);
        var icon = document.createElement('span');
        icon.className = 'website-symbol ' + mark.className;
        icon.setAttribute('aria-hidden', 'true');
        if (mark.text === '▶') {
          icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          icon.setAttribute('class', 'website-symbol youtube-symbol');
          icon.setAttribute('viewBox', '0 0 32 32');
          icon.setAttribute('aria-hidden', 'true');
          icon.innerHTML = '<rect x="3" y="7" width="26" height="18" rx="5"/><path d="m13 11 8 5-8 5Z"/>';
        } else { icon.textContent = mark.text; }
        var text = document.createElement('span');
        text.className = 'website-text';
        var strong = document.createElement('strong');
        strong.textContent = site.name;
        var small = document.createElement('small');
        small.textContent = host(site.url);
        text.appendChild(strong);
        text.appendChild(small);
        var arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        arrow.setAttribute('class', 'external-mark');
        arrow.setAttribute('viewBox', '0 0 24 24');
        arrow.setAttribute('aria-hidden', 'true');
        arrow.innerHTML = '<path d="M6 18 18 6M6 6h12v12"/>';
        button.appendChild(icon);
        button.appendChild(text);
        button.appendChild(arrow);
        button.addEventListener('click', function () { window.TVHome.websites.open(site); });
        container.appendChild(button);
      });
      document.getElementById('web-caption').textContent = sites.length ? 'Opens in the TV browser' : 'Add websites in Settings';
      if (focusedId) {
        var again = container.querySelector('[data-site-id="' + focusedId.replace(/["\\]/g, '\\$&') + '"]');
        if (again) { window.TVHome.nav.focusElement(again); }
      }
    },
    // Websites open in the TV's own browser (sites generally refuse to be framed, so no iframes).
    open: function (site) {
      var url = window.TVHome.store.validUrl(site.url);
      if (!url) { window.TVHome.toast('Not a valid web address: ' + site.url); return; }
      if (typeof tizen === 'undefined') {
        console.log('[TV Home mock] Open website:', url);
        window.TVHome.toast('Desktop preview · Opening ' + host(url) + ' in a new tab');
        var tab = window.open(url, '_blank');
        if (tab) { try { tab.opener = null; } catch (error) { /* cross-origin */ } }
        return;
      }
      function failed(error) {
        window.TVHome.toast('Could not open ' + site.name + ': ' + (error && error.name ? error.name : 'UnknownError'));
      }
      // One fallback only: if the implicit view request errors or throws, try the browser app once.
      var retried = false;
      function retry(error) {
        if (retried) { failed(error); return; }
        retried = true;
        console.warn('[TV Home] Implicit view app control failed, trying the browser app:', error && error.name);
        try { launchControl(url, BROWSER_ID, failed); } catch (inner) { failed(inner); }
      }
      try { launchControl(url, null, retry); } catch (error) { retry(error); }
    },
    save: function (id, name, rawUrl) {
      var url = window.TVHome.store.validUrl(rawUrl);
      var label = (name || '').trim();
      if (!url) { return { error: 'Enter a web address starting with http:// or https://' }; }
      if (!label) { label = host(url); }
      var sites = window.TVHome.store.get().websites;
      var existing = null;
      sites.forEach(function (site) { if (site.id === id) { existing = site; } });
      if (existing) {
        existing.name = label.slice(0, 40);
        existing.url = url;
      } else {
        if (sites.length >= 12) { return { error: 'You can keep up to 12 websites' }; }
        existing = { id: 'site-' + Date.now().toString(36) + Math.floor(Math.random() * 1000), name: label.slice(0, 40), url: url };
        sites.push(existing);
      }
      window.TVHome.store.set({ websites: sites });
      return { site: existing };
    },
    remove: function (id) {
      var sites = window.TVHome.store.get().websites.filter(function (site) { return site.id !== id; });
      window.TVHome.store.set({ websites: sites });
    }
  };
}());
