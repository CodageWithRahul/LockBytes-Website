(function () {
  const STORAGE_KEY = 'lockbytes-theme';
  const root = document.documentElement;
  const toggleButtons = document.querySelectorAll('[data-theme-toggle]');

  function getPreferredTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEY);
    if (savedTheme === 'dark' || savedTheme === 'light') {
      return savedTheme;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    const isDark = theme === 'dark';

    toggleButtons.forEach((button) => {
      const icon = button.querySelector('.theme-icon');
      const label = button.querySelector('.theme-label');

      if (icon) {
        icon.textContent = isDark ? '🌙' : '☀️';
      }

      if (label) {
        label.textContent = isDark ? 'Dark mode' : 'Light mode';
      }

      button.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      button.setAttribute('aria-pressed', String(isDark));
    });
  }

  function initTheme() {
    const activeTheme = getPreferredTheme();
    applyTheme(activeTheme);
  }

  function handleToggle() {
    const currentTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, currentTheme);
    applyTheme(currentTheme);
  }

  initTheme();

  toggleButtons.forEach((button) => {
    button.addEventListener('click', handleToggle);
  });
})();
