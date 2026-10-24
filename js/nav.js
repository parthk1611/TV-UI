(function () {
  'use strict';
  var scope;
  var preferredX = null;

  function items(root) {
    return Array.prototype.slice.call(root.querySelectorAll('[data-focusable]')).filter(function (element) {
      return !element.disabled && element.getClientRects().length > 0;
    });
  }

  function center(element) {
    var rect = element.getBoundingClientRect();
    return rect.left + rect.width / 2;
  }

  function focus(element, keepColumn) {
    if (!element) { return; }
    element.focus();
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (!keepColumn) { preferredX = center(element); }
  }

  window.TVHome = window.TVHome || {};
  window.TVHome.nav = {
    setScope: function (element, initial) {
      scope = element;
      preferredX = null;
      focus(initial || items(scope)[0]);
    },
    move: function (direction) {
      var current = document.activeElement;
      var rows = Array.prototype.slice.call(scope.querySelectorAll('[data-nav-row]')).filter(function (row) {
        return items(row).length > 0;
      });
      var row = current.closest('[data-nav-row]');
      var rowIndex = rows.indexOf(row);
      if (rowIndex < 0) { focus(items(scope)[0]); return; }
      var buttons = items(row);
      var index = buttons.indexOf(current);
      if (direction === 'left' || direction === 'right') {
        focus(buttons[index + (direction === 'left' ? -1 : 1)]);
        return;
      }
      var next = rows[rowIndex + (direction === 'up' ? -1 : 1)];
      if (!next) { return; }
      var targetX = preferredX === null ? center(current) : preferredX;
      var candidates = items(next);
      candidates.sort(function (a, b) { return Math.abs(center(a) - targetX) - Math.abs(center(b) - targetX); });
      focus(candidates[0], true);
    },
    tab: function (backward) {
      var buttons = items(scope);
      var index = buttons.indexOf(document.activeElement);
      focus(buttons[(index + (backward ? -1 : 1) + buttons.length) % buttons.length]);
    },
    recover: function () {
      if (!scope.contains(document.activeElement)) { focus(items(scope)[0]); }
    }
  };
}());
