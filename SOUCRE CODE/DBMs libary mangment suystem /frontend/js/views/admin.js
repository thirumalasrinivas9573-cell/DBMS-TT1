/**
 * Admin Portal View (Section 8.4, 12)
 * Features: Settings, Manage Libraries, Manage Users, Network Reports with Chart.js
 */
const AdminView = {
  charts: {},

  async render(container, activeSubView = 'dashboard') {
    const user = Auth.getUser();
    if (!user || user.role !== 'ADMIN') {
      Toast.error('Access restricted to System Administrators.');
      window.location.hash = '#home';
      return;
    }

    container.innerHTML = `
      <div style="margin-bottom: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
              <h1 style="font-size: 2rem; font-weight: 800;">Administrator Console</h1>
              <span class="role-tag ADMIN">Network HQ</span>
            </div>
            <p style="color: var(--text-muted); font-size: 0.95rem;">
              Network-wide configuration, financial rules, branch setup, staff management, and analytics.
            </p>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
            <button class="btn ${activeSubView === 'dashboard' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="AdminView.switchView('dashboard')"><i class="fa-solid fa-chart-pie"></i> Analytics</button>
            <button class="btn ${activeSubView === 'settings' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="AdminView.switchView('settings')"><i class="fa-solid fa-sliders"></i> System Settings</button>
            <button class="btn ${activeSubView === 'libraries' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="AdminView.switchView('libraries')"><i class="fa-solid fa-city"></i> Manage Branches</button>
            <button class="btn ${activeSubView === 'users' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="AdminView.switchView('users')"><i class="fa-solid fa-users-gear"></i> Staff & Users</button>
            <button class="btn ${activeSubView === 'dbms-concepts' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="AdminView.switchView('dbms-concepts')"><i class="fa-solid fa-database"></i> DBMS Concepts</button>
          </div>
        </div>
      </div>

      <div id="admin-view-content"></div>
    `;

    this.renderSubView(activeSubView);
  },

  switchView(viewName) {
    this.renderSubView(viewName);
  },

  async renderSubView(view) {
    const container = document.getElementById('admin-view-content');
    if (!container) return;

    if (view === 'dashboard') {
      this.renderAnalytics(container);
    } else if (view === 'settings') {
      this.renderSettings(container);
    } else if (view === 'libraries') {
      this.renderLibraries(container);
    } else if (view === 'users') {
      this.renderUsers(container);
    } else if (view === 'dbms-concepts') {
      this.renderDBMSConcepts(container);
    }
  },

  // =========================================================================
  // 1. ANALYTICS & REPORTS WITH CHART.JS
  // =========================================================================
  async renderAnalytics(container) {
    container.innerHTML = `
      <div id="admin-stats-summary" class="stats-grid">
        <div class="stat-card skeleton" style="height: 90px;"></div>
        <div class="stat-card skeleton" style="height: 90px;"></div>
        <div class="stat-card skeleton" style="height: 90px;"></div>
      </div>

      <!-- Charts Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
        <div class="card card-elevated">
          <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 1rem;">Stock Distribution Across Branches</h3>
          <div style="height: 280px; position: relative;">
            <canvas id="chart-branch-stock"></canvas>
          </div>
        </div>

        <div class="card card-elevated">
          <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 1rem;">Revenue Breakdown by Charge Type</h3>
          <div style="height: 280px; position: relative;">
            <canvas id="chart-revenue-breakdown"></canvas>
          </div>
        </div>
      </div>

      <!-- Most Moved Physical Copies -->
      <div class="card card-elevated">
        <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 1rem;">Most Physically Relocated Copies (Circulation Hotspots)</h3>
        <div id="admin-most-moved-table" class="table-container">Loading movement report...</div>
      </div>
    `;

    try {
      const [stockData, revData, movedData] = await Promise.all([
        API.get('/admin/reports/stock'),
        API.get('/reports/revenue'),
        API.get('/reports/most-moved')
      ]);

      const rev = revData.revenue_summary || {};
      const stock = stockData.stock || [];

      // Render stats summary
      const totalCopies = stock.reduce((s, r) => s + (r.total_copies || 0), 0);
      const availableCopies = stock.reduce((s, r) => s + (r.available_copies || 0), 0);

      document.getElementById('admin-stats-summary').innerHTML = `
        <div class="stat-card">
          <div class="stat-icon"><i class="fa-solid fa-layer-group"></i></div>
          <div class="stat-info">
            <div class="stat-value">${totalCopies}</div>
            <div class="stat-label">Total Network Copies</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="color:var(--emerald-500);"><i class="fa-solid fa-circle-check"></i></div>
          <div class="stat-info">
            <div class="stat-value">${availableCopies}</div>
            <div class="stat-label">Available on Shelf</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="color:var(--amber-500);"><i class="fa-solid fa-coins"></i></div>
          <div class="stat-info">
            <div class="stat-value">₹${parseFloat(rev.net_revenue || 0).toFixed(2)}</div>
            <div class="stat-label">Net System Revenue</div>
          </div>
        </div>
      `;

      // Render Chart 1: Stock by branch
      const branchCounts = {};
      stock.forEach(r => {
        branchCounts[r.library_name] = (branchCounts[r.library_name] || 0) + (r.total_copies || 0);
      });

      if (window.Chart) {
        const ctx1 = document.getElementById('chart-branch-stock').getContext('2d');
        new Chart(ctx1, {
          type: 'bar',
          data: {
            labels: Object.keys(branchCounts),
            datasets: [{
              label: 'Total Copies',
              data: Object.values(branchCounts),
              backgroundColor: ['#1C2541', '#FF9F1C', '#059669'],
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
          }
        });

        // Render Chart 2: Revenue
        const ctx2 = document.getElementById('chart-revenue-breakdown').getContext('2d');
        new Chart(ctx2, {
          type: 'doughnut',
          data: {
            labels: ['Transit Charges', 'Late Return Fines', 'Refunds Issued'],
            datasets: [{
              data: [
                parseFloat(rev.total_transfer_charges || 0),
                parseFloat(rev.total_late_fees || 0),
                parseFloat(rev.total_refunded_to_members || 0)
              ],
              backgroundColor: ['#FF9F1C', '#EF4444', '#10B981']
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false
          }
        });
      }

      // Render Most Moved table
      const movedTable = document.getElementById('admin-most-moved-table');
      const mostMoved = movedData.most_moved_copies || [];
      movedTable.innerHTML = `
        <table class="table">
          <thead>
            <tr>
              <th>Barcode</th>
              <th>Book Title</th>
              <th>Current Branch</th>
              <th>Total Physical Relocations</th>
              <th>Last Scanned</th>
            </tr>
          </thead>
          <tbody>
            ${mostMoved.map(m => `
              <tr>
                <td><code style="font-weight:700; color:var(--amber-600);">${m.barcode}</code></td>
                <td><strong>${m.title}</strong></td>
                <td>${m.current_library}</td>
                <td><span class="role-tag LIBRARIAN">${m.total_movements} Movements</span></td>
                <td>${m.last_scanned_at}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

    } catch (err) {
      console.error('Analytics load error:', err);
    }
  },

  // =========================================================================
  // 2. SETTINGS
  // =========================================================================
  async renderSettings(container) {
    container.innerHTML = `
      <div class="card card-elevated" style="max-width: 650px;">
        <h2 style="font-size: 1.35rem; font-weight: 800; margin-bottom: 0.5rem;">System Operational Parameters</h2>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1.5rem;">
          Configure global transfer charges per kilometer, mandatory security deposit, and late return fees.
        </p>

        <form id="settings-form" onsubmit="AdminView.handleSaveSettings(event)">
          <div class="form-group">
            <label class="form-label">Inter-Library Transit Rate (₹ per kilometer)</label>
            <input type="number" step="0.25" id="set-rate-km" class="form-input" required>
            <div class="form-help">Applied when a book borrowed at Library A is returned at Library B (Haversine distance × rate).</div>
          </div>

          <div class="form-group">
            <label class="form-label">Security Deposit Amount (₹)</label>
            <input type="number" step="10" id="set-deposit" class="form-input" required>
            <div class="form-help">Standard deposit held when issuing copies to members.</div>
          </div>

          <div class="form-group">
            <label class="form-label">Late Return Fine (₹ per day)</label>
            <input type="number" step="0.5" id="set-late-fee" class="form-input" required>
            <div class="form-help">Accumulated daily fine when returned past the due date.</div>
          </div>

          <button type="submit" id="save-settings-btn" class="btn btn-primary" style="margin-top: 0.5rem;">
            Save Global Settings
          </button>
        </form>
      </div>
    `;

    try {
      const data = await API.get('/admin/settings');
      const s = data.settings || {};
      document.getElementById('set-rate-km').value = s.rate_per_km || 2.0;
      document.getElementById('set-deposit').value = s.deposit_amount || 500.0;
      document.getElementById('set-late-fee').value = s.late_fee_per_day || 5.0;
    } catch (err) {
      Toast.error('Failed to load settings.');
    }
  },

  async handleSaveSettings(e) {
    e.preventDefault();
    const btn = document.getElementById('save-settings-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    const rate = parseFloat(document.getElementById('set-rate-km').value);
    const deposit = parseFloat(document.getElementById('set-deposit').value);
    const late = parseFloat(document.getElementById('set-late-fee').value);

    try {
      const res = await API.put('/admin/settings', {
        rate_per_km: rate,
        deposit_amount: deposit,
        late_fee_per_day: late
      });
      Toast.success(res.message);
    } catch (err) {
      Toast.error(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Global Settings';
    }
  },

  // =========================================================================
  // 3. MANAGE LIBRARIES
  // =========================================================================
  async renderLibraries(container) {
    container.innerHTML = `
      <div class="card" style="margin-bottom: 2rem;">
        <h2 style="font-size: 1.3rem; font-weight: 800; margin-bottom: 0.5rem;">Add New Library Branch</h2>
        <form onsubmit="AdminView.handleAddLibrary(event)" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)) 120px; gap: 1rem; align-items: flex-end;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Branch Name</label>
            <input type="text" id="new-lib-name" class="form-input" placeholder="e.g. Kondapur Tech Branch" required>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Address</label>
            <input type="text" id="new-lib-addr" class="form-input" placeholder="e.g. Main Road, Kondapur" required>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Latitude</label>
            <input type="number" step="0.000001" id="new-lib-lat" class="form-input" placeholder="17.4623" required>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Longitude</label>
            <input type="number" step="0.000001" id="new-lib-lng" class="form-input" placeholder="78.3582" required>
          </div>
          <button type="submit" class="btn btn-primary" style="height:44px;">Add Branch</button>
        </form>
      </div>

      <div class="card">
        <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 1rem;">Registered Library Branches</h3>
        <div id="admin-libs-table-wrapper" class="table-container">Loading libraries...</div>
      </div>
    `;

    try {
      const data = await API.get('/libraries');
      const libs = data.libraries || [];
      const wrapper = document.getElementById('admin-libs-table-wrapper');

      wrapper.innerHTML = `
        <table class="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Branch Name</th>
              <th>Address</th>
              <th>Latitude</th>
              <th>Longitude</th>
              <th>Copies Stock</th>
            </tr>
          </thead>
          <tbody>
            ${libs.map(l => `
              <tr>
                <td>#${l.library_id}</td>
                <td><strong>${l.library_name}</strong></td>
                <td>${l.address}</td>
                <td>${l.latitude}</td>
                <td>${l.longitude}</td>
                <td><span class="badge-stock available">${l.available_copies} / ${l.total_copies}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      document.getElementById('admin-libs-table-wrapper').innerHTML = `<div style="color:var(--rose-500)">${err.message}</div>`;
    }
  },

  async handleAddLibrary(e) {
    e.preventDefault();
    const name = document.getElementById('new-lib-name').value.trim();
    const addr = document.getElementById('new-lib-addr').value.trim();
    const lat = parseFloat(document.getElementById('new-lib-lat').value);
    const lng = parseFloat(document.getElementById('new-lib-lng').value);

    try {
      const res = await API.post('/libraries', {
        library_name: name,
        address: addr,
        latitude: lat,
        longitude: lng
      });
      Toast.success(res.message);
      this.renderLibraries(document.getElementById('admin-view-content'));
    } catch (err) {
      Toast.error(err.message);
    }
  },

  // =========================================================================
  // 4. MANAGE USERS & STAFF
  // =========================================================================
  async renderUsers(container) {
    container.innerHTML = `
      <div class="card" style="margin-bottom: 2rem;">
        <h2 style="font-size: 1.3rem; font-weight: 800; margin-bottom: 0.5rem;">Create Staff / User Account</h2>
        <form onsubmit="AdminView.handleCreateUser(event)" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)) 120px; gap: 1rem; align-items: flex-end;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Full Name</label>
            <input type="text" id="new-u-name" class="form-input" placeholder="Staff Name" required>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Email</label>
            <input type="email" id="new-u-email" class="form-input" placeholder="staff@hydlib.org" required>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Password</label>
            <input type="password" id="new-u-pass" class="form-input" placeholder="••••••••" required>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Role</label>
            <select id="new-u-role" class="form-select" required>
              <option value="LIBRARIAN">LIBRARIAN</option>
              <option value="ADMIN">ADMIN</option>
              <option value="MEMBER">MEMBER</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Library Branch ID</label>
            <input type="number" id="new-u-lib" class="form-input" placeholder="e.g. 1">
          </div>
          <button type="submit" class="btn btn-primary" style="height:44px;">Create</button>
        </form>
      </div>

      <div class="card">
        <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 1rem;">System Accounts</h3>
        <div id="admin-users-table-wrapper" class="table-container">Loading users...</div>
      </div>
    `;

    try {
      const data = await API.get('/admin/users');
      const users = data.users || [];
      const wrapper = document.getElementById('admin-users-table-wrapper');

      wrapper.innerHTML = `
        <table class="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Branch</th>
              <th>Phone</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => `
              <tr>
                <td>#${u.user_id}</td>
                <td><strong>${u.name}</strong></td>
                <td>${u.email}</td>
                <td><span class="role-tag ${u.role}">${u.role}</span></td>
                <td>${u.library_name || (u.library_id ? 'Branch #' + u.library_id : 'HQ / None')}</td>
                <td>${u.phone || '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      document.getElementById('admin-users-table-wrapper').innerHTML = `<div style="color:var(--rose-500)">${err.message}</div>`;
    }
  },

  async handleCreateUser(e) {
    e.preventDefault();
    const name = document.getElementById('new-u-name').value.trim();
    const email = document.getElementById('new-u-email').value.trim();
    const password = document.getElementById('new-u-pass').value;
    const role = document.getElementById('new-u-role').value;
    const libId = document.getElementById('new-u-lib').value ? parseInt(document.getElementById('new-u-lib').value, 10) : null;

    try {
      const res = await API.post('/admin/users', {
        name,
        email,
        password,
        role,
        library_id: libId
      });
      Toast.success(res.message);
      this.renderUsers(document.getElementById('admin-view-content'));
    } catch (err) {
      Toast.error(err.message);
    }
  },

  // =========================================================================
  // 5. DBMS CONCEPTS LIVE RUNNER (Section 10.6)
  // =========================================================================
  async renderDBMSConcepts(container) {
    container.innerHTML = `
      <div class="card card-elevated" style="margin-bottom: 1.5rem; background: linear-gradient(135deg, rgba(11, 19, 43, 0.05) 0%, rgba(255, 159, 28, 0.08) 100%);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h2 style="font-size: 1.35rem; font-weight: 800; display: flex; align-items: center; gap: 0.5rem;">
              <i class="fa-solid fa-database" style="color: var(--amber-500);"></i>
              Core DBMS Concepts Demonstration (Section 10.6)
            </h2>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.25rem;">
              Live verification engine executing relational queries, multi-table JOINs, GROUP BY aggregations, material views, check constraints, and B-Tree indexes.
            </p>
          </div>
          <button class="btn btn-primary" onclick="AdminView.runAllDBMSQueries()" id="btn-run-all-dbms">
            <i class="fa-solid fa-play"></i> Run All Queries
          </button>
        </div>
      </div>

      <div id="dbms-queries-list">
        <div class="card skeleton" style="height: 120px; margin-bottom: 1rem;"></div>
        <div class="card skeleton" style="height: 120px; margin-bottom: 1rem;"></div>
        <div class="card skeleton" style="height: 120px;"></div>
      </div>
    `;

    try {
      const data = await API.get('/admin/dbms-demo');
      const queries = data.queries || [];
      const listContainer = document.getElementById('dbms-queries-list');

      if (!listContainer) return;

      if (queries.length === 0) {
        listContainer.innerHTML = `<div class="card empty-state"><p>No demo queries configured.</p></div>`;
        return;
      }

      listContainer.innerHTML = queries.map(q => `
        <div class="card card-elevated" style="margin-bottom: 1.5rem;" id="dbms-card-${q.key}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.75rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <h3 style="font-size: 1.15rem; font-weight: 700;">${q.title}</h3>
                <span class="badge" style="background: rgba(255, 159, 28, 0.15); color: var(--amber-600); font-weight: 600; font-size: 0.75rem; padding: 2px 8px; border-radius: var(--radius-full);">
                  ${q.concept}
                </span>
              </div>
              <p style="color: var(--text-muted); font-size: 0.88rem; margin-top: 0.35rem;">
                ${q.explanation}
              </p>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="AdminView.runDBMSQuery('${q.key}')" id="btn-run-${q.key}">
              <i class="fa-solid fa-bolt"></i> Run Live Query
            </button>
          </div>

          <!-- SQL Block -->
          <div style="background: var(--navy-900); color: #E2E8F0; padding: 1rem; border-radius: var(--radius-md); font-family: 'JetBrains Mono', monospace; font-size: 0.82rem; overflow-x: auto; margin-bottom: 1rem; border: 1px solid rgba(255, 255, 255, 0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 0.35rem;">
              <span style="color: var(--amber-500); font-size: 0.75rem; text-transform: uppercase; font-weight: 600;">SQL Query</span>
              <button class="btn btn-sm" style="color: #94A3B8; padding: 2px 6px; font-size: 0.7rem; background: transparent; border: none; cursor: pointer;" onclick="navigator.clipboard.writeText(this.getAttribute('data-sql')); Toast.info('SQL copied to clipboard');" data-sql="${q.sql.replace(/"/g, '&quot;')}">
                <i class="fa-regular fa-copy"></i> Copy
              </button>
            </div>
            <pre style="margin: 0; white-space: pre-wrap; line-height: 1.45;">${q.sql}</pre>
          </div>

          <!-- Query Result Output -->
          <div id="dbms-result-${q.key}" style="display: none;"></div>
        </div>
      `).join('');

    } catch (err) {
      document.getElementById('dbms-queries-list').innerHTML = `
        <div class="card" style="border-left: 4px solid var(--rose-500); color: var(--rose-500);">
          Failed to load DBMS demo queries: ${err.message}
        </div>
      `;
    }
  },

  async runDBMSQuery(queryKey) {
    const btn = document.getElementById(`btn-run-${queryKey}`);
    const out = document.getElementById(`dbms-result-${queryKey}`);
    if (!out) return;

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Running...`;
    }

    out.style.display = 'block';
    out.innerHTML = `<div style="padding: 1rem; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Executing against live database...</div>`;

    try {
      const res = await API.post('/admin/dbms-demo/run', { query_key: queryKey });
      
      let tableHtml = '';
      if (!res.rows || res.rows.length === 0) {
        tableHtml = `<p style="padding: 0.75rem; color: var(--text-muted); font-size: 0.85rem;">Query executed successfully. 0 rows returned.</p>`;
      } else {
        const columns = res.columns || Object.keys(res.rows[0]);
        tableHtml = `
          <div class="table-container" style="max-height: 320px; overflow-y: auto;">
            <table class="table" style="font-size: 0.82rem;">
              <thead>
                <tr>
                  ${columns.map(c => `<th>${c}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${res.rows.map(row => `
                  <tr>
                    ${columns.map(c => `
                      <td>${row[c] !== null && row[c] !== undefined ? (typeof row[c] === 'number' ? row[c] : String(row[c])) : '<span style="color:var(--text-muted)">NULL</span>'}</td>
                    `).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      out.innerHTML = `
        <div style="margin-top: 0.75rem; border-top: 1px dashed var(--border-light); padding-top: 0.75rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
            <span class="badge" style="background: rgba(16, 185, 129, 0.12); color: var(--emerald-600); font-weight: 600; font-size: 0.75rem; padding: 3px 8px; border-radius: var(--radius-full);">
              <i class="fa-solid fa-circle-check"></i> Executed in ${res.execution_time_ms} ms &bull; ${res.row_count} row(s) returned
            </span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Timestamp: ${new Date().toLocaleTimeString()}</span>
          </div>
          ${tableHtml}
        </div>
      `;

      Toast.success(`Query "${res.title}" executed (${res.execution_time_ms} ms)`);
    } catch (err) {
      out.innerHTML = `
        <div style="margin-top: 0.75rem; padding: 0.75rem; background: var(--rose-100); color: var(--rose-600); border-radius: var(--radius-md); font-size: 0.85rem;">
          <i class="fa-solid fa-circle-xmark"></i> Execution Error: ${err.message}
        </div>
      `;
      Toast.error(`Execution failed: ${err.message}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-bolt"></i> Run Live Query`;
      }
    }
  },

  async runAllDBMSQueries() {
    const runAllBtn = document.getElementById('btn-run-all-dbms');
    if (runAllBtn) {
      runAllBtn.disabled = true;
      runAllBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Executing All Queries...`;
    }

    try {
      const data = await API.get('/admin/dbms-demo');
      const queries = data.queries || [];
      for (const q of queries) {
        await this.runDBMSQuery(q.key);
      }
      Toast.success('All DBMS demonstration queries successfully executed!');
    } catch (err) {
      Toast.error(`Batch run error: ${err.message}`);
    } finally {
      if (runAllBtn) {
        runAllBtn.disabled = false;
        runAllBtn.innerHTML = `<i class="fa-solid fa-play"></i> Run All Queries`;
      }
    }
  }
};

window.AdminView = AdminView;
