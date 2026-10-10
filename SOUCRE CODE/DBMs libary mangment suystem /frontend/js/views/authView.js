/**
 * Authentication View (Login / Register)
 */
const AuthView = {
  renderLogin(container) {
    container.innerHTML = `
      <div style="max-width: 440px; margin: 3rem auto;">
        <div class="card card-elevated">
          <div style="text-align: center; margin-bottom: 2rem;">
            <div class="logo-badge" style="width: 50px; height: 50px; margin: 0 auto 1rem; font-size: 1.5rem;">
              <i class="fa-solid fa-book-bookmark"></i>
            </div>
            <h2 style="font-size: 1.75rem; font-weight: 800;">Welcome Back</h2>
            <p style="color: var(--text-muted); font-size: 0.9rem;">Sign in to access your library dashboard</p>
          </div>

          <!-- Quick Fill Demo Accounts -->
          <div style="margin-bottom: 1.5rem; background-color: var(--bg-secondary); padding: 0.85rem; border-radius: var(--radius-md); border: 1px dashed var(--border-medium);">
            <div style="font-size: 0.75rem; font-weight: 700; color: var(--amber-600); text-transform: uppercase; margin-bottom: 0.5rem; text-align: center;">
              ⚡ Quick Fill Demo Accounts
            </div>
            <div style="display: flex; gap: 0.4rem; justify-content: center;">
              <button class="btn btn-secondary btn-sm" onclick="AuthView.fillDemo('admin@hydlib.org', 'admin123')">Admin</button>
              <button class="btn btn-secondary btn-sm" onclick="AuthView.fillDemo('librarian1@hydlib.org', 'lib123')">Librarian 1</button>
              <button class="btn btn-secondary btn-sm" onclick="AuthView.fillDemo('srinivas@student.edu', 'member123')">Member</button>
            </div>
          </div>

          <form id="login-form" onsubmit="AuthView.handleLogin(event)">
            <div class="form-group">
              <label for="login-email" class="form-label">Email Address</label>
              <input type="email" id="login-email" class="form-input" placeholder="e.g. librarian1@hydlib.org" required>
            </div>

            <div class="form-group">
              <label for="login-password" class="form-label">Password</label>
              <input type="password" id="login-password" class="form-input" placeholder="••••••••" required>
            </div>

            <button type="submit" id="login-submit-btn" class="btn btn-primary" style="width: 100%; margin-top: 0.5rem;">
              Sign In to Account
            </button>
          </form>

          <div style="text-align: center; margin-top: 1.5rem; font-size: 0.85rem; color: var(--text-muted);">
            Don't have a member account? <a href="#register" style="color: var(--amber-600); font-weight: 600;">Register here</a>
          </div>
        </div>
      </div>
    `;
  },

  renderRegister(container) {
    container.innerHTML = `
      <div style="max-width: 480px; margin: 2rem auto;">
        <div class="card card-elevated">
          <div style="text-align: center; margin-bottom: 1.75rem;">
            <div class="logo-badge" style="width: 50px; height: 50px; margin: 0 auto 1rem; font-size: 1.5rem;">
              <i class="fa-solid fa-user-plus"></i>
            </div>
            <h2 style="font-size: 1.75rem; font-weight: 800;">Create Member Account</h2>
            <p style="color: var(--text-muted); font-size: 0.9rem;">Join the connected library network in Hyderabad</p>
          </div>

          <form id="register-form" onsubmit="AuthView.handleRegister(event)">
            <div class="form-group">
              <label for="reg-name" class="form-label">Full Name</label>
              <input type="text" id="reg-name" class="form-input" placeholder="e.g. Ananya Sharma" required>
            </div>

            <div class="form-group">
              <label for="reg-email" class="form-label">Email Address</label>
              <input type="email" id="reg-email" class="form-input" placeholder="e.g. ananya@student.edu" required>
            </div>

            <div class="form-group">
              <label for="reg-phone" class="form-label">Phone Number</label>
              <input type="tel" id="reg-phone" class="form-input" placeholder="e.g. 9848012345">
            </div>

            <div class="form-group">
              <label for="reg-address" class="form-label">Address / College Hostel</label>
              <input type="text" id="reg-address" class="form-input" placeholder="e.g. AIML Dept, Hyderabad">
            </div>

            <div class="form-group">
              <label for="reg-password" class="form-label">Password (min 6 chars)</label>
              <input type="password" id="reg-password" class="form-input" placeholder="••••••••" minlength="6" required>
            </div>

            <button type="submit" id="reg-submit-btn" class="btn btn-primary" style="width: 100%; margin-top: 0.5rem;">
              Complete Registration
            </button>
          </form>

          <div style="text-align: center; margin-top: 1.5rem; font-size: 0.85rem; color: var(--text-muted);">
            Already have an account? <a href="#login" style="color: var(--amber-600); font-weight: 600;">Sign in</a>
          </div>
        </div>
      </div>
    `;
  },

  fillDemo(email, pass) {
    document.getElementById('login-email').value = email;
    document.getElementById('login-password').value = pass;
  },

  async handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('login-submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    try {
      const data = await API.post('/auth/login', { email, password });
      Auth.setSession(data.token, data.user);
      Toast.success(`Welcome back, ${data.user.name}!`);

      // Role based redirect
      if (data.user.role === 'ADMIN') {
        window.location.hash = '#admin-dashboard';
      } else if (data.user.role === 'LIBRARIAN') {
        window.location.hash = '#librarian-dashboard';
      } else {
        window.location.hash = '#member-dashboard';
      }
    } catch (err) {
      Toast.error(err.message || 'Login failed.');
      btn.disabled = false;
      btn.textContent = 'Sign In to Account';
    }
  },

  async handleRegister(e) {
    e.preventDefault();
    const btn = document.getElementById('reg-submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registering...';

    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const address = document.getElementById('reg-address').value.trim();
    const password = document.getElementById('reg-password').value;

    try {
      const data = await API.post('/auth/register', { name, email, phone, address, password });
      Auth.setSession(data.token, data.user);
      Toast.success('Account registered successfully!');
      window.location.hash = '#member-dashboard';
    } catch (err) {
      Toast.error(err.message || 'Registration failed.');
      btn.disabled = false;
      btn.textContent = 'Complete Registration';
    }
  }
};

window.AuthView = AuthView;
