/**
 * Authentication and Session Management Module
 */
const Auth = {
  getUser() {
    const raw = localStorage.getItem('user');
    try {
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  },

  getToken() {
    return localStorage.getItem('token');
  },

  isAuthenticated() {
    return !!this.getToken() && !!this.getUser();
  },

  getRole() {
    const user = this.getUser();
    return user ? user.role : 'GUEST';
  },

  getLibraryId() {
    const user = this.getUser();
    return user ? user.library_id : null;
  },

  setSession(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    this.renderNav();
  },

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    Toast.info('You have been logged out.');
    this.renderNav();
    window.location.hash = '#home';
  },

  /**
   * Render dynamic navigation links based on user role
   */
  async renderNav() {
    const navLinks = document.getElementById('nav-links');
    const userActions = document.getElementById('user-actions');
    if (!navLinks || !userActions) return;

    const user = this.getUser();
    const role = this.getRole();

    // 1. Navigation links
    let linksHtml = `
      <li><a href="#home" class="nav-link"><i class="fa-solid fa-house"></i> Home</a></li>
      <li><a href="#books" class="nav-link"><i class="fa-solid fa-book-open"></i> Search Catalog</a></li>
      <li><a href="#libraries" class="nav-link"><i class="fa-solid fa-building-columns"></i> Libraries</a></li>
    `;

    if (role === 'MEMBER') {
      linksHtml += `
        <li><a href="#member-dashboard" class="nav-link"><i class="fa-solid fa-chart-line"></i> Dashboard</a></li>
        <li><a href="#my-books" class="nav-link"><i class="fa-solid fa-bookmark"></i> My Loans</a></li>
        <li><a href="#notifications" class="nav-link"><i class="fa-solid fa-bell"></i> Alerts <span id="notif-badge" class="badge-stock low-stock" style="display:none; padding: 2px 6px; font-size: 0.65rem;"></span></a></li>
      `;
    } else if (role === 'LIBRARIAN') {
      linksHtml += `
        <li><a href="#librarian-dashboard" class="nav-link"><i class="fa-solid fa-gauge-high"></i> Dashboard</a></li>
        <li><a href="#scan" class="nav-link" style="color: var(--amber-600); font-weight: 700;"><i class="fa-solid fa-barcode"></i> Scan Book</a></li>
        <li><a href="#counter" class="nav-link"><i class="fa-solid fa-hand-holding-hand"></i> Counter</a></li>
        <li><a href="#copies" class="nav-link"><i class="fa-solid fa-boxes-stacked"></i> Copies</a></li>
        <li><a href="#copy-tracker" class="nav-link"><i class="fa-solid fa-timeline"></i> Tracker</a></li>
        <li><a href="#wrong-rack" class="nav-link"><i class="fa-solid fa-triangle-exclamation"></i> Misplaced</a></li>
        <li><a href="#transfers" class="nav-link"><i class="fa-solid fa-truck-ramp-box"></i> Transfers</a></li>
        <li><a href="#reports" class="nav-link"><i class="fa-solid fa-file-invoice"></i> Reports</a></li>
      `;
    } else if (role === 'ADMIN') {
      linksHtml += `
        <li><a href="#admin-dashboard" class="nav-link"><i class="fa-solid fa-shield-halved"></i> Overview</a></li>
        <li><a href="#manage-libraries" class="nav-link"><i class="fa-solid fa-city"></i> Libraries</a></li>
        <li><a href="#manage-users" class="nav-link"><i class="fa-solid fa-users-gear"></i> Users</a></li>
        <li><a href="#admin-settings" class="nav-link"><i class="fa-solid fa-sliders"></i> Settings</a></li>
        <li><a href="#admin-reports" class="nav-link"><i class="fa-solid fa-chart-pie"></i> Network Analytics</a></li>
        <li><a href="#admin-dbms-concepts" class="nav-link" style="color: var(--amber-600); font-weight: 700;"><i class="fa-solid fa-database"></i> DBMS Concepts</a></li>
      `;
    }

    navLinks.innerHTML = linksHtml;

    // 2. User profile pill or Login/Register buttons
    if (user) {
      userActions.innerHTML = `
        <div class="user-menu-pill">
          <span>${user.name.split(' ')[0]}</span>
          <span class="role-tag ${user.role}">${user.role}</span>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="Auth.logout()" title="Logout">
          <i class="fa-solid fa-right-from-bracket"></i>
        </button>
      `;

      // Update notifications badge count
      this.updateUnreadCount();
    } else {
      userActions.innerHTML = `
        <a href="#login" class="btn btn-secondary btn-sm">Login</a>
        <a href="#register" class="btn btn-primary btn-sm">Register</a>
      `;
    }

    // Highlight current active link
    const currentHash = window.location.hash || '#home';
    const activeLink = navLinks.querySelector(`a[href="${currentHash.split('?')[0]}"]`);
    if (activeLink) activeLink.classList.add('active');
  },

  async updateUnreadCount() {
    try {
      const data = await API.get('/notifications');
      const badge = document.getElementById('notif-badge');
      if (badge && data && data.unread_count > 0) {
        badge.textContent = data.unread_count;
        badge.style.display = 'inline-block';
      }
    } catch (_) {}
  }
};

window.Auth = Auth;
