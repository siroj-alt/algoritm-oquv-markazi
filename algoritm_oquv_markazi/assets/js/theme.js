(function () {
  'use strict';
  var STORAGE_KEY = 'algoritm-theme';
  var root = document.documentElement;
  function readTheme() {
    try { var saved = window.localStorage.getItem(STORAGE_KEY); if (saved === 'light' || saved === 'dark') return saved; } catch (e) {}
    return 'dark';
  }
  function applyTheme(theme) {
    theme = theme === 'light' ? 'light' : 'dark';
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
    try { window.localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
    var button = document.getElementById('theme-toggle');
    if (button) {
      var light = theme === 'light';
      button.setAttribute('aria-label', light ? 'Tungi rejimga o‘tish' : 'Kunduzgi rejimga o‘tish');
      button.setAttribute('aria-pressed', light ? 'true' : 'false');
      button.innerHTML = light
        ? '<span class="theme-toggle-icon" aria-hidden="true">☾</span><span class="theme-toggle-label">Tungi rejim</span>'
        : '<span class="theme-toggle-icon" aria-hidden="true">☀</span><span class="theme-toggle-label">Kunduzgi rejim</span>';
    }
  }
  function installToggle() {
    var button = document.getElementById('theme-toggle');
    if (!button) {
      button = document.createElement('button');
      button.id = 'theme-toggle';
      button.type = 'button';
      button.className = 'theme-toggle';
      var nav = document.querySelector('.site-header nav');
      if (nav) nav.appendChild(button);
      else { button.classList.add('theme-toggle-floating'); document.body.appendChild(button); }
    }
    if (!button.dataset.themeBound) {
      button.addEventListener('click', function () {
        applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
      });
      button.dataset.themeBound = '1';
    }
    applyTheme(root.getAttribute('data-theme') || readTheme());
  }
  applyTheme(readTheme());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installToggle, { once: true });
  else installToggle();
})();
