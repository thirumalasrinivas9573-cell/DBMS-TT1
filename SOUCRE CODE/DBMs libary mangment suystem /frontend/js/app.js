/**
 * Application Bootstrap & Theme Management
 */
const App = {
  init() {
    this.initTheme();
    Toast.init();
    Auth.renderNav();
    Router.init();

    // Notification polling
    setInterval(() => {
      if (Auth.isAuthenticated()) {
        Auth.updateUnreadCount();
      }
    }, 30000);
  },

  initTheme() {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    this.updateThemeButton(saved);
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    this.updateThemeButton(next);
  },

  updateThemeButton(theme) {
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
      btn.innerHTML = theme === 'dark' 
        ? '<i class="fa-solid fa-sun" style="color:var(--amber-500);"></i>' 
        : '<i class="fa-solid fa-moon"></i>';
    }
  }
};

window.App = App;

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
