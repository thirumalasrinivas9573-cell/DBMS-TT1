/**
 * Member Portal View (Dashboard, My Loans with Alternate-Return Flow, History, Profile)
 */
const MemberView = {
  activeLoans: [],
  allLibraries: [],
  settings: { rate_per_km: 2.0 },

  async render(container, activeTab = 'dashboard') {
    const user = Auth.getUser();
    if (!user) {
      window.location.hash = '#login';
      return;
    }

    container.innerHTML = `
      <div style="margin-bottom: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h1 style="font-size: 2rem; font-weight: 800; margin-bottom: 0.25rem;">Member Portal</h1>
            <p style="color: var(--text-muted); font-size: 0.95rem;">
              Welcome back, <strong>${user.name}</strong>. Manage your loans, due dates, and cross-branch returns.
            </p>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="MemberView.switchTab('dashboard')">Dashboard</button>
            <button class="btn ${activeTab === 'my-books' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="MemberView.switchTab('my-books')">My Active Loans</button>
            <button class="btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="MemberView.switchTab('history')">Borrow History</button>
            <button class="btn ${activeTab === 'profile' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="MemberView.switchTab('profile')">Profile</button>
          </div>
        </div>
      </div>

      <div id="member-tab-content">
        <!-- Rendered based on activeTab -->
      </div>

      <!-- Alternate Return Modal (Section 9.4, 9.5) -->
      <div id="alt-return-modal" class="modal-backdrop">
        <div class="modal-content">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3 style="font-size: 1.3rem; font-weight: 800;">Return Book at Alternate Library</h3>
            <button class="btn btn-secondary btn-sm" onclick="MemberView.closeModal()">✕</button>
          </div>
          <div id="alt-return-body"></div>
        </div>
      </div>
    `;

    // Fetch initial data
    await this.fetchMemberData();
    this.renderCurrentTab(activeTab);
  },

  async fetchMemberData() {
    try {
      const [txData, libData, settData] = await Promise.all([
        API.get('/me/transactions'),
        API.get('/libraries'),
        API.get('/admin/settings').catch(() => ({ settings: { rate_per_km: 2.0 } }))
      ]);

      this.activeLoans = txData.transactions || [];
      this.allLibraries = libData.libraries || [];
      if (settData.settings) this.settings = settData.settings;
    } catch (err) {
      console.error('Failed to fetch member data:', err);
    }
  },

  switchTab(tab) {
    this.renderCurrentTab(tab);
  },

  renderCurrentTab(tab) {
    const container = document.getElementById('member-tab-content');
    if (!container) return;

    if (tab === 'dashboard') {
      const currentlyIssued = this.activeLoans.filter(t => t.status === 'ISSUED');
      const totalDepositHeld = currentlyIssued.reduce((sum, t) => sum + parseFloat(t.deposit_amount || 0), 0);
      const overdueLoans = currentlyIssued.filter(t => new Date(t.due_date) < new Date());

      container.innerHTML = `
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon"><i class="fa-solid fa-book"></i></div>
            <div class="stat-info">
              <div class="stat-value">${currentlyIssued.length}</div>
              <div class="stat-label">Currently Borrowed Books</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="color: var(--emerald-500);"><i class="fa-solid fa-indian-rupee-sign"></i></div>
            <div class="stat-info">
              <div class="stat-value">₹${totalDepositHeld.toFixed(2)}</div>
              <div class="stat-label">Active Security Deposits Held</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="color: ${overdueLoans.length > 0 ? 'var(--rose-500)' : 'var(--emerald-500)'};">
              <i class="fa-solid fa-clock"></i>
            </div>
            <div class="stat-info">
              <div class="stat-value" style="color: ${overdueLoans.length > 0 ? 'var(--rose-500)' : 'inherit'};">
                ${overdueLoans.length}
              </div>
              <div class="stat-label">Overdue Loans</div>
            </div>
          </div>
        </div>

        <div class="card" style="margin-bottom: 2rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="font-size: 1.2rem; font-weight: 700;">Your Current Book Loans</h3>
            <button class="btn btn-secondary btn-sm" onclick="MemberView.switchTab('my-books')">View All</button>
          </div>
          ${this.renderLoansTable(currentlyIssued, true)}
        </div>
      `;
    } else if (tab === 'my-books') {
      const currentlyIssued = this.activeLoans.filter(t => t.status === 'ISSUED');
      container.innerHTML = `
        <div class="card">
          <div style="margin-bottom: 1.25rem;">
            <h3 style="font-size: 1.25rem; font-weight: 700;">My Active Borrowed Books</h3>
            <p style="color: var(--text-muted); font-size: 0.85rem;">
              You can return any of these books at your original library OR at any other branch in Hyderabad.
            </p>
          </div>
          ${this.renderLoansTable(currentlyIssued, true)}
        </div>
      `;
    } else if (tab === 'history') {
      const pastLoans = this.activeLoans.filter(t => t.status !== 'ISSUED');
      container.innerHTML = `
        <div class="card">
          <div style="margin-bottom: 1.25rem;">
            <h3 style="font-size: 1.25rem; font-weight: 700;">Past Borrowing History</h3>
            <p style="color: var(--text-muted); font-size: 0.85rem;">All completed returns, transfer fees, and refunded security deposits.</p>
          </div>
          ${this.renderHistoryTable(pastLoans)}
        </div>
      `;
    } else if (tab === 'profile') {
      const user = Auth.getUser();
      container.innerHTML = `
        <div class="card" style="max-width: 600px;">
          <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1.5rem;">Member Profile</h3>
          <div class="form-group">
            <label class="form-label">Name</label>
            <input type="text" class="form-input" value="${user.name}" readonly>
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-input" value="${user.email}" readonly>
          </div>
          <div class="form-group">
            <label class="form-label">Role</label>
            <input type="text" class="form-input" value="${user.role}" readonly>
          </div>
        </div>
      `;
    }
  },

  renderLoansTable(loans, showAltReturnBtn = true) {
    if (loans.length === 0) {
      return `
        <div class="empty-state" style="padding: 2rem;">
          <div class="empty-state-icon">📚</div>
          <div class="empty-state-title">No books currently borrowed</div>
          <p class="empty-state-text">Explore our catalog and borrow a copy at any connected branch.</p>
          <a href="#books" class="btn btn-primary btn-sm">Explore Catalog</a>
        </div>
      `;
    }

    return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Barcode</th>
              <th>Issued From</th>
              <th>Issue Date</th>
              <th>Due Date</th>
              <th>Deposit</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${loans.map(l => {
              const isOverdue = new Date(l.due_date) < new Date();
              return `
                <tr>
                  <td><strong>${l.title}</strong></td>
                  <td><code style="font-family:var(--font-mono); font-weight:600; color:var(--amber-600);">${l.barcode}</code></td>
                  <td>${l.issue_library}</td>
                  <td>${l.issue_date}</td>
                  <td style="color: ${isOverdue ? 'var(--rose-500)' : 'inherit'}; font-weight: ${isOverdue ? '700' : 'normal'};">
                    ${l.due_date} ${isOverdue ? '<span class="role-tag ADMIN" style="font-size:0.65rem;">OVERDUE</span>' : ''}
                  </td>
                  <td>₹${parseFloat(l.deposit_amount).toFixed(2)}</td>
                  <td>
                    ${showAltReturnBtn ? `
                      <button class="btn btn-secondary btn-sm" onclick="MemberView.openAltReturnModal(${l.transaction_id})">
                        <i class="fa-solid fa-arrow-right-arrow-left"></i> Alternate Return
                      </button>
                    ` : ''}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderHistoryTable(history) {
    if (history.length === 0) {
      return '<div class="empty-state-text" style="padding:2rem; text-align:center;">No past loan records.</div>';
    }

    return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Borrowed At</th>
              <th>Returned At</th>
              <th>Return Date</th>
              <th>Transit Fee</th>
              <th>Late Fee</th>
              <th>Deposit Refunded</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${history.map(h => `
              <tr>
                <td><strong>${h.title}</strong></td>
                <td>${h.issue_library}</td>
                <td>${h.return_library || '—'}</td>
                <td>${h.return_date || '—'}</td>
                <td>${h.transfer_charge > 0 ? `₹${parseFloat(h.transfer_charge).toFixed(2)} (${h.transfer_distance_km} km)` : '₹0.00'}</td>
                <td>₹${parseFloat(h.late_fee || 0).toFixed(2)}</td>
                <td><strong style="color:var(--emerald-500);">₹${parseFloat(h.refund_amount || 0).toFixed(2)}</strong></td>
                <td><span class="badge-stock available">${h.status}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  openAltReturnModal(txId) {
    const tx = this.activeLoans.find(t => t.transaction_id === txId);
    if (!tx) return;

    const modal = document.getElementById('alt-return-modal');
    const body = document.getElementById('alt-return-body');
    if (!modal || !body) return;

    modal.classList.add('open');

    body.innerHTML = `
      <div style="margin-bottom: 1.5rem;">
        <div style="font-weight: 700; font-size: 1.15rem; margin-bottom: 0.25rem;">${tx.title}</div>
        <div style="font-size: 0.85rem; color: var(--text-muted);">
          Barcode: <code>${tx.barcode}</code> | Issued at: <strong>${tx.issue_library}</strong> | Deposit held: <strong>₹${tx.deposit_amount}</strong>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Where do you wish to drop off / return this book?</label>
        <select id="alt-return-target-lib" class="form-select" onchange="MemberView.calculateAltFee(${txId})">
          <option value="">Select an alternate return library branch...</option>
          ${this.allLibraries.map(l => `
            <option value="${l.library_id}">${l.library_name} (${l.address.split(',')[0]})</option>
          `).join('')}
        </select>
      </div>

      <div id="alt-fee-breakdown" style="display: none; background-color: var(--bg-secondary); padding: 1.25rem; border-radius: var(--radius-md); margin-bottom: 1.5rem;">
        <!-- Calculated live fee breakdown -->
      </div>

      <div style="background-color: var(--bg-tertiary); padding: 0.85rem; border-radius: var(--radius-sm); font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.5rem;">
        <i class="fa-solid fa-circle-info" style="color: var(--amber-500);"></i>
        <strong>How it works:</strong> Simply bring this book to the circulation counter of the destination branch.
        The librarian scans your barcode; the system automatically settles the transit fee from your deposit and refunds the remaining balance!
      </div>

      <div style="text-align: right;">
        <button class="btn btn-secondary" onclick="MemberView.closeModal()">Close</button>
      </div>
    `;
  },

  calculateAltFee(txId) {
    const tx = this.activeLoans.find(t => t.transaction_id === txId);
    const select = document.getElementById('alt-return-target-lib');
    const breakdown = document.getElementById('alt-fee-breakdown');
    if (!tx || !select || !breakdown) return;

    const targetLibId = parseInt(select.value, 10);
    if (!targetLibId) {
      breakdown.style.display = 'none';
      return;
    }

    const targetLib = this.allLibraries.find(l => l.library_id === targetLibId);
    if (!targetLib) return;

    // Approximate distance
    const isSameLib = targetLib.library_name === tx.issue_library;
    let distanceKm = 0;
    let charge = 0;
    const ratePerKm = this.settings.rate_per_km || 2.0;

    if (!isSameLib) {
      distanceKm = 14.1; // Central to HITEC City avg
      charge = Math.round(distanceKm * ratePerKm * 100) / 100;
    }

    const deposit = parseFloat(tx.deposit_amount);
    const refund = Math.round((deposit - charge) * 100) / 100;

    breakdown.style.display = 'block';
    breakdown.innerHTML = `
      <h4 style="font-weight: 700; margin-bottom: 0.75rem; color: var(--amber-600);">Calculated Fee Breakdown</h4>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.9rem;">
        <div>Borrow Library:</div><div><strong>${tx.issue_library}</strong></div>
        <div>Return Library:</div><div><strong>${targetLib.library_name}</strong></div>
        <div>Transit Distance:</div><div><strong>${isSameLib ? '0 km (Same Branch)' : `${distanceKm} km`}</strong></div>
        <div>Configured Rate:</div><div>₹${ratePerKm.toFixed(2)} per km</div>
        <div>Transit Handling Charge:</div><div style="color: var(--amber-600); font-weight: 700;">₹${charge.toFixed(2)}</div>
        <div style="border-top: 1px solid var(--border-medium); padding-top: 0.5rem;">Estimated Refund on Return:</div>
        <div style="border-top: 1px solid var(--border-medium); padding-top: 0.5rem; font-weight: 800; color: var(--emerald-500); font-size: 1.1rem;">
          ₹${refund.toFixed(2)}
        </div>
      </div>
    `;
  },

  closeModal() {
    const modal = document.getElementById('alt-return-modal');
    if (modal) modal.classList.remove('open');
  }
};

window.MemberView = MemberView;
