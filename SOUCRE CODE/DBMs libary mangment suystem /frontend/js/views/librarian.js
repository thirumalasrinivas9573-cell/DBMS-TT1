/**
 * Librarian Portal View (Section 8.3, 9.1, 9.2, 9.4, 9.6, 13)
 * Full suite: Two-Step Scan, Issue/Return Counter, Copy Tracker, Transfers, Alerts, Reports
 */
const LibrarianView = {
  lastScans: [],
  scanStep: 1,
  scannedBookBarcode: '',
  html5QrCode: null,
  isCameraActive: false,

  async render(container, activeSubView = 'scan') {
    const user = Auth.getUser();
    if (!user || (user.role !== 'LIBRARIAN' && user.role !== 'ADMIN')) {
      Toast.error('Access restricted to library staff.');
      window.location.hash = '#home';
      return;
    }

    container.innerHTML = `
      <div style="margin-bottom: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
              <h1 style="font-size: 2rem; font-weight: 800;">Librarian Operations</h1>
              <span class="role-tag LIBRARIAN">Branch #${user.library_id || 1}</span>
            </div>
            <p style="color: var(--text-muted); font-size: 0.95rem;">
              Two-step physical barcode tracking, circulation desk, misplaced alerts, and stock balancing.
            </p>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
            <button class="btn ${activeSubView === 'dashboard' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="LibrarianView.switchView('dashboard')"><i class="fa-solid fa-gauge"></i> Overview</button>
            <button class="btn ${activeSubView === 'scan' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="LibrarianView.switchView('scan')"><i class="fa-solid fa-barcode"></i> Scan Screen</button>
            <button class="btn ${activeSubView === 'counter' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="LibrarianView.switchView('counter')"><i class="fa-solid fa-cash-register"></i> Issue/Return</button>
            <button class="btn ${activeSubView === 'tracker' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="LibrarianView.switchView('tracker')"><i class="fa-solid fa-timeline"></i> Copy Tracker</button>
            <button class="btn ${activeSubView === 'wrong-rack' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="LibrarianView.switchView('wrong-rack')"><i class="fa-solid fa-triangle-exclamation"></i> Misplaced</button>
            <button class="btn ${activeSubView === 'transfers' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="LibrarianView.switchView('transfers')"><i class="fa-solid fa-truck"></i> Transfers</button>
            <button class="btn ${activeSubView === 'copies' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="LibrarianView.switchView('copies')"><i class="fa-solid fa-boxes-stacked"></i> Copies</button>
          </div>
        </div>
      </div>

      <div id="librarian-view-content"></div>
    `;

    this.renderSubView(activeSubView);
  },

  switchView(viewName) {
    if (this.isCameraActive) this.stopCamera();
    this.renderSubView(viewName);
  },

  async renderSubView(view) {
    const container = document.getElementById('librarian-view-content');
    if (!container) return;

    if (view === 'scan') {
      this.renderScanScreen(container);
    } else if (view === 'dashboard') {
      this.renderDashboard(container);
    } else if (view === 'counter') {
      this.renderCounter(container);
    } else if (view === 'tracker') {
      this.renderTracker(container);
    } else if (view === 'wrong-rack') {
      this.renderWrongRack(container);
    } else if (view === 'transfers') {
      this.renderTransfers(container);
    } else if (view === 'copies') {
      this.renderCopies(container);
    }
  },

  // =========================================================================
  // 1. SCAN SCREEN (Two-Step Scan, Wrong-Rack Detection, Audio Feedback)
  // =========================================================================
  renderScanScreen(container) {
    this.scanStep = 1;
    this.scannedBookBarcode = '';

    container.innerHTML = `
      <div class="scan-container">
        <div class="scan-box-card">
          <!-- Step Indicator -->
          <div class="scan-step-indicator">
            <div id="step-1-indicator" class="scan-step active">
              <div class="scan-step-circle">1</div>
              <span>Scan Book Copy</span>
            </div>
            <i class="fa-solid fa-arrow-right" style="color: var(--border-medium);"></i>
            <div id="step-2-indicator" class="scan-step">
              <div class="scan-step-circle">2</div>
              <span>Scan Rack / Table</span>
            </div>
          </div>

          <div style="text-align: center; margin-bottom: 1.5rem;">
            <h2 id="scan-step-title" style="font-size: 1.5rem; font-weight: 800; margin-bottom: 0.35rem;">
              Step 1: Scan Book Barcode
            </h2>
            <p id="scan-step-desc" style="color: var(--text-muted); font-size: 0.9rem;">
              Point hardware barcode scanner or type barcode and press Enter (e.g. <code>LIB-A-BC1023</code>)
            </p>
          </div>

          <form id="scan-form" onsubmit="LibrarianView.handleBarcodeSubmit(event)">
            <input 
              type="text" 
              id="barcode-input" 
              class="giant-barcode-input" 
              placeholder="Waiting for scan..." 
              autocomplete="off" 
              autofocus
            />
            <div style="display: flex; gap: 0.75rem; justify-content: center; margin-top: 1rem;">
              <button type="submit" class="btn btn-primary">
                <i class="fa-solid fa-barcode"></i> Process Scan
              </button>
              <button type="button" class="btn btn-secondary" onclick="LibrarianView.toggleCamera()">
                <i class="fa-solid fa-camera"></i> <span id="camera-btn-text">Camera Scan</span>
              </button>
              <button type="button" class="btn btn-secondary" onclick="LibrarianView.resetScanStep()">
                <i class="fa-solid fa-rotate-left"></i> Reset
              </button>
            </div>
          </form>

          <!-- Camera Scanner Viewfinder -->
          <div id="camera-reader-box" class="camera-preview-box"></div>

          <!-- Live Result Banner -->
          <div id="scan-result-banner" style="display: none;"></div>
        </div>

        <!-- Recent Scans Audit Log Card -->
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="font-size: 1.15rem; font-weight: 700;">Live Session Scan History</h3>
            <span style="font-size: 0.8rem; color: var(--text-muted);">${this.lastScans.length} scans logged</span>
          </div>
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Barcode</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Movement Type</th>
                  <th>Alert</th>
                </tr>
              </thead>
              <tbody id="scans-history-body">
                ${this.renderRecentScansRows()}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      const input = document.getElementById('barcode-input');
      if (input) input.focus();
    }, 100);
  },

  renderRecentScansRows() {
    if (this.lastScans.length === 0) {
      return '<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding: 1.5rem;">No scans recorded in this session yet.</td></tr>';
    }

    return this.lastScans.map(s => `
      <tr>
        <td style="font-size: 0.8rem; color: var(--text-muted);">${s.time}</td>
        <td><code style="font-family: var(--font-mono); font-weight: 700; color: var(--amber-600);">${s.barcode}</code></td>
        <td><strong>${s.title}</strong></td>
        <td><span class="badge-stock available">${s.status}</span></td>
        <td>${s.location}</td>
        <td><span class="role-tag LIBRARIAN">${s.movement_type}</span></td>
        <td>
          ${s.wrong_rack ? '<span class="role-tag ADMIN" style="font-size:0.7rem;"><i class="fa-solid fa-triangle-exclamation"></i> WRONG RACK</span>' : '<span style="color:var(--emerald-500); font-size:0.8rem;">✓ OK</span>'}
        </td>
      </tr>
    `).join('');
  },

  async handleBarcodeSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('barcode-input');
    const banner = document.getElementById('scan-result-banner');
    if (!input || !banner) return;

    const value = input.value.trim();
    if (!value) return;

    this.playBeepSound();

    if (this.scanStep === 1) {
      // Step 1: Book barcode captured
      this.scannedBookBarcode = value;
      input.value = '';

      // Ask if this is single pickup scan or two-step placement scan
      this.scanStep = 2;
      document.getElementById('step-1-indicator').className = 'scan-step completed';
      document.getElementById('step-2-indicator').className = 'scan-step active';
      document.getElementById('scan-step-title').textContent = `Step 2: Scan Rack / Table for [${this.scannedBookBarcode}]`;
      document.getElementById('scan-step-desc').innerHTML = `
        Scan a Rack (e.g. <code>R01</code>) or Reading Table (e.g. <code>T01</code>).<br>
        <em>Or press Process Scan with empty field to register single-step Book Pickup (leaves rack/table).</em>
      `;
      input.placeholder = 'Scan Rack or Table barcode (optional)...';
      input.focus();
    } else {
      // Step 2: Location barcode captured (or submitted empty for pickup)
      const locationBarcode = value;
      await this.executeScanApi(this.scannedBookBarcode, locationBarcode);
    }
  },

  async executeScanApi(bookBarcode, locationBarcode) {
    const banner = document.getElementById('scan-result-banner');
    try {
      const res = await API.post('/scan', {
        book_barcode: bookBarcode,
        location_barcode: locationBarcode || undefined
      });

      this.resetScanStep();

      // Check if wrong rack alert
      const isWrongRack = res.wrong_rack && res.wrong_rack.is_wrong_rack;

      if (isWrongRack) {
        banner.className = 'alert-banner danger';
        banner.style.display = 'flex';
        banner.innerHTML = `
          <div style="font-size: 2rem;"><i class="fa-solid fa-triangle-exclamation"></i></div>
          <div style="flex: 1;">
            <h3 style="font-size: 1.25rem; font-weight: 800; margin-bottom: 0.25rem;">WRONG RACK ALERT!</h3>
            <p style="font-weight: 600; margin-bottom: 0.25rem;">${res.wrong_rack.message}</p>
            <div style="font-size: 0.85rem; opacity: 0.9;">
              Expected Rack: <strong>${res.wrong_rack.expected_rack || 'N/A'}</strong> | Scanned Rack: <strong>${res.wrong_rack.actual_rack}</strong>
            </div>
            <div style="font-size: 0.8rem; margin-top: 0.5rem; background: rgba(0,0,0,0.1); padding: 0.35rem 0.65rem; border-radius: 4px; display: inline-block;">
              🔔 System alert notification sent to branch librarians.
            </div>
          </div>
        `;
        Toast.error('MISPLACED BOOK DETECTED: Placed on wrong rack!');
      } else {
        banner.className = 'alert-banner success';
        banner.style.display = 'flex';
        banner.innerHTML = `
          <div style="font-size: 2rem;"><i class="fa-solid fa-circle-check"></i></div>
          <div style="flex: 1;">
            <h3 style="font-size: 1.25rem; font-weight: 800; margin-bottom: 0.25rem;">Scan Processed Successfully</h3>
            <p style="font-weight: 600;">${res.message}</p>
            <div style="font-size: 0.85rem; opacity: 0.9;">
              Book: <strong>${res.book_title}</strong> (<code>${res.barcode}</code>) | Status: <strong>${res.status}</strong>
            </div>
          </div>
        `;
        Toast.success(res.message);
      }

      // Add to session scans history
      this.lastScans.unshift({
        time: new Date().toLocaleTimeString(),
        barcode: res.barcode,
        title: res.book_title,
        status: res.status,
        location: `${res.location.type} ${res.location.id || 'None'}`,
        movement_type: res.movement_type,
        wrong_rack: isWrongRack
      });

      const tbody = document.getElementById('scans-history-body');
      if (tbody) tbody.innerHTML = this.renderRecentScansRows();

    } catch (err) {
      banner.className = 'alert-banner danger';
      banner.style.display = 'flex';
      banner.innerHTML = `
        <div style="font-size: 2rem;"><i class="fa-solid fa-circle-xmark"></i></div>
        <div style="flex: 1;">
          <h3 style="font-size: 1.25rem; font-weight: 800; margin-bottom: 0.25rem;">Scan Failed</h3>
          <p>${err.message}</p>
        </div>
      `;
      Toast.error(err.message);
      this.resetScanStep();
    }
  },

  resetScanStep() {
    this.scanStep = 1;
    this.scannedBookBarcode = '';
    const input = document.getElementById('barcode-input');
    const s1 = document.getElementById('step-1-indicator');
    const s2 = document.getElementById('step-2-indicator');
    const t = document.getElementById('scan-step-title');
    const d = document.getElementById('scan-step-desc');

    if (s1 && s2 && t && d && input) {
      s1.className = 'scan-step active';
      s2.className = 'scan-step';
      t.textContent = 'Step 1: Scan Book Barcode';
      d.innerHTML = 'Point hardware barcode scanner or type barcode and press Enter (e.g. <code>LIB-A-BC1023</code>)';
      input.value = '';
      input.placeholder = 'Waiting for scan...';
      input.focus();
    }
  },

  playBeepSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // 880 Hz beep
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.08); // 80ms short beep
    } catch (_) {}
  },

  toggleCamera() {
    const box = document.getElementById('camera-reader-box');
    const btnText = document.getElementById('camera-btn-text');
    if (!box) return;

    if (this.isCameraActive) {
      this.stopCamera();
      box.style.display = 'none';
      if (btnText) btnText.textContent = 'Camera Scan';
    } else {
      box.style.display = 'block';
      if (btnText) btnText.textContent = 'Stop Camera';
      this.startCamera();
    }
  },

  startCamera() {
    if (typeof Html5Qrcode === 'undefined') {
      Toast.warning('Loading HTML5 QR/Barcode scanner library...');
      return;
    }

    try {
      this.html5QrCode = new Html5Qrcode('camera-reader-box');
      this.isCameraActive = true;
      this.html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
          const input = document.getElementById('barcode-input');
          if (input) {
            input.value = decodedText;
            document.getElementById('scan-form').dispatchEvent(new Event('submit'));
          }
        },
        () => {}
      ).catch(err => {
        Toast.error('Camera access denied or unavailable: ' + err);
        this.stopCamera();
      });
    } catch (e) {
      Toast.error('Camera initialization failed.');
    }
  },

  stopCamera() {
    if (this.html5QrCode && this.isCameraActive) {
      this.html5QrCode.stop().then(() => {
        this.html5QrCode.clear();
        this.isCameraActive = false;
      }).catch(() => {});
    }
  },

  // =========================================================================
  // 2. DASHBOARD
  // =========================================================================
  async renderDashboard(container) {
    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon"><i class="fa-solid fa-barcode"></i></div>
          <div class="stat-info">
            <div id="stat-scans-count" class="stat-value">0</div>
            <div class="stat-label">Session Physical Scans</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="color:var(--rose-500);"><i class="fa-solid fa-triangle-exclamation"></i></div>
          <div class="stat-info">
            <div id="stat-wrong-count" class="stat-value">...</div>
            <div class="stat-label">Misplaced Copies (Wrong Rack)</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="color:var(--amber-500);"><i class="fa-solid fa-truck"></i></div>
          <div class="stat-info">
            <div id="stat-transfers-count" class="stat-value">...</div>
            <div class="stat-label">Pending Inter-Library Transfers</div>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
        <div class="card">
          <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 1rem;">Quick Circulation Actions</h3>
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <button class="btn btn-primary" onclick="LibrarianView.switchView('scan')">
              <i class="fa-solid fa-barcode"></i> Launch Two-Step Physical Scanner
            </button>
            <button class="btn btn-secondary" onclick="LibrarianView.switchView('counter')">
              <i class="fa-solid fa-hand-holding-hand"></i> Issue New Book Loan
            </button>
            <button class="btn btn-secondary" onclick="LibrarianView.switchView('counter')">
              <i class="fa-solid fa-rotate-left"></i> Receive Returned Book (Own/Alternate)
            </button>
            <button class="btn btn-secondary" onclick="LibrarianView.switchView('tracker')">
              <i class="fa-solid fa-timeline"></i> Track Physical Movement Timeline
            </button>
          </div>
        </div>

        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="font-size: 1.2rem; font-weight: 700; color: var(--rose-500);">
              <i class="fa-solid fa-triangle-exclamation"></i> Misplaced Rack Alerts
            </h3>
            <button class="btn btn-secondary btn-sm" onclick="LibrarianView.switchView('wrong-rack')">View All</button>
          </div>
          <div id="dashboard-wrong-racks-preview">Loading alerts...</div>
        </div>
      </div>
    `;

    document.getElementById('stat-scans-count').textContent = this.lastScans.length;

    try {
      const [wrongData, transData] = await Promise.all([
        API.get('/alerts/wrong-rack'),
        API.get('/transfers')
      ]);

      const wrongEl = document.getElementById('stat-wrong-count');
      if (wrongEl) wrongEl.textContent = (wrongData.alerts || []).length;

      const transEl = document.getElementById('stat-transfers-count');
      if (transEl) transEl.textContent = (transData.transfers || []).filter(t => t.status === 'PENDING').length;

      const previewEl = document.getElementById('dashboard-wrong-racks-preview');
      if (previewEl) {
        const alerts = wrongData.alerts || [];
        if (alerts.length === 0) {
          previewEl.innerHTML = '<div style="color:var(--emerald-500); font-weight:600;">✓ All copies are on their correct home racks!</div>';
        } else {
          previewEl.innerHTML = alerts.slice(0, 3).map(a => `
            <div style="background-color: var(--bg-secondary); padding: 0.75rem; border-radius: var(--radius-sm); margin-bottom: 0.5rem; border-left: 3px solid var(--rose-500);">
              <div style="font-weight: 700;">${a.title} (<code>${a.barcode}</code>)</div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">
                Found on Rack <strong>${a.actual_rack}</strong>, Expected on Rack <strong>${a.expected_rack}</strong>
              </div>
            </div>
          `).join('');
        }
      }
    } catch (_) {}
  },

  // =========================================================================
  // 3. ISSUE / RETURN COUNTER (Same & Alternate Library Returns)
  // =========================================================================
  renderCounter(container) {
    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 2rem;">
        <!-- Issue Book Column -->
        <div class="card card-elevated">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem;">
            <div class="logo-badge" style="background: linear-gradient(135deg, var(--emerald-600), var(--emerald-500)); color: white;">
              <i class="fa-solid fa-arrow-up-from-bracket"></i>
            </div>
            <div>
              <h2 style="font-size: 1.3rem; font-weight: 800;">Issue Book to Member</h2>
              <p style="font-size: 0.8rem; color: var(--text-muted);">Hold security deposit and record loan</p>
            </div>
          </div>

          <form id="issue-form" onsubmit="LibrarianView.handleIssue(event)">
            <div class="form-group">
              <label class="form-label">Book Copy Barcode</label>
              <input type="text" id="issue-barcode" class="form-input" placeholder="e.g. LIB-A-BC1001" required>
            </div>

            <div class="form-group">
              <label class="form-label">Member User ID</label>
              <input type="number" id="issue-user-id" class="form-input" placeholder="e.g. 4 (D. Srinivas)" required>
              <div class="form-help">Default seeded student user IDs: 4 (Srinivas), 5 (Sashank), 6 (Praveen)</div>
            </div>

            <div class="form-group">
              <label class="form-label">Loan Duration (Days)</label>
              <input type="number" id="issue-due-days" class="form-input" value="14" required>
            </div>

            <div class="form-group">
              <label class="form-label">Security Deposit (₹)</label>
              <input type="number" id="issue-deposit" class="form-input" value="500" required>
            </div>

            <button type="submit" id="issue-submit-btn" class="btn btn-primary" style="width: 100%;">
              Issue Copy & Record Loan
            </button>
          </form>
        </div>

        <!-- Return Book Column -->
        <div class="card card-elevated">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem;">
            <div class="logo-badge" style="background: linear-gradient(135deg, #2563EB, #3B82F6); color: white;">
              <i class="fa-solid fa-arrow-down-to-bracket"></i>
            </div>
            <div>
              <h2 style="font-size: 1.3rem; font-weight: 800;">Receive Return at Counter</h2>
              <p style="font-size: 0.8rem; color: var(--text-muted);">Own library or Alternate-Library return</p>
            </div>
          </div>

          <form id="return-form" onsubmit="LibrarianView.handleReturn(event)">
            <div class="form-group">
              <label class="form-label">Borrow Transaction ID</label>
              <input type="number" id="return-trans-id" class="form-input" placeholder="e.g. 1" required>
              <div class="form-help">Enter transaction ID from member's slip or search list below</div>
            </div>

            <button type="submit" id="return-submit-btn" class="btn btn-secondary" style="width: 100%; border-color: #3B82F6; color: #3B82F6;">
              Calculate Settlement & Process Return
            </button>
          </form>

          <div id="return-result-card" style="display: none; margin-top: 1.5rem; background-color: var(--bg-secondary); padding: 1.25rem; border-radius: var(--radius-md);"></div>
        </div>
      </div>
    `;
  },

  async handleIssue(e) {
    e.preventDefault();
    const btn = document.getElementById('issue-submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Issuing...';

    const barcode = document.getElementById('issue-barcode').value.trim();
    const userId = parseInt(document.getElementById('issue-user-id').value, 10);
    const dueDays = parseInt(document.getElementById('issue-due-days').value, 10);
    const deposit = parseFloat(document.getElementById('issue-deposit').value);

    try {
      const res = await API.post('/transactions/issue', {
        barcode,
        user_id: userId,
        due_days: dueDays,
        deposit_amount: deposit
      });

      Toast.success(res.message);
      document.getElementById('issue-form').reset();
    } catch (err) {
      Toast.error(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Issue Copy & Record Loan';
    }
  },

  async handleReturn(e) {
    e.preventDefault();
    const btn = document.getElementById('return-submit-btn');
    const resCard = document.getElementById('return-result-card');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

    const txId = parseInt(document.getElementById('return-trans-id').value, 10);

    try {
      const res = await API.post(`/transactions/${txId}/return`, {});
      Toast.success(res.message);

      resCard.style.display = 'block';
      resCard.innerHTML = `
        <h4 style="font-weight: 800; margin-bottom: 0.5rem; color: var(--emerald-500);">Return Complete (Tx #${res.transaction_id})</h4>
        <div style="font-size: 0.85rem; line-height: 1.6;">
          <div>Title: <strong>${res.book_title}</strong> (<code>${res.barcode}</code>)</div>
          <div>Issue Branch: <strong>${res.issue_library}</strong></div>
          <div>Return Branch: <strong>${res.return_library}</strong></div>
          <div>Transit Distance: <strong>${res.financials.distance_km} km</strong> (Fee: ₹${res.financials.transfer_charge})</div>
          <div>Overdue Days: <strong>${res.financials.days_overdue}</strong> (Late Fee: ₹${res.financials.late_fee})</div>
          <div style="border-top: 1px solid var(--border-medium); margin-top: 0.5rem; padding-top: 0.5rem; font-size: 1.05rem; font-weight: 800; color: var(--emerald-500);">
            Refund to Member: ₹${res.financials.refund_amount.toFixed(2)}
          </div>
        </div>
      `;
    } catch (err) {
      Toast.error(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Calculate Settlement & Process Return';
    }
  },

  // =========================================================================
  // 4. COPY TRACKER (Timeline of physical movements)
  // =========================================================================
  renderTracker(container) {
    container.innerHTML = `
      <div class="card" style="margin-bottom: 2rem;">
        <h2 style="font-size: 1.3rem; font-weight: 800; margin-bottom: 0.5rem;">Physical Copy Tracker Timeline</h2>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1.5rem;">
          Query the append-only BOOK_MOVEMENT audit trail for any physical barcode.
        </p>

        <form onsubmit="LibrarianView.searchHistory(event)" style="display: flex; gap: 0.75rem; max-width: 500px;">
          <input type="text" id="tracker-barcode-input" class="form-input" placeholder="Enter barcode (e.g. LIB-A-BC1023)" required>
          <button type="submit" class="btn btn-primary">Track</button>
        </form>
      </div>

      <div id="tracker-result-area"></div>
    `;
  },

  async searchHistory(e) {
    e.preventDefault();
    const barcode = document.getElementById('tracker-barcode-input').value.trim();
    const area = document.getElementById('tracker-result-area');
    if (!barcode || !area) return;

    area.innerHTML = '<div style="padding:2rem; text-align:center;">Retrieving audit trail...</div>';

    try {
      const data = await API.get(`/copies/${encodeURIComponent(barcode)}/history`);
      const copy = data.copy;
      const history = data.history || [];

      area.innerHTML = `
        <div class="card" style="margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <span class="book-card-category">Copy Overview</span>
              <h3 style="font-size: 1.4rem; font-weight: 800;">${copy.title}</h3>
              <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">
                Barcode: <code style="font-family:var(--font-mono); font-weight:700; color:var(--amber-600);">${copy.barcode}</code> | 
                Current Branch: <strong>${copy.library_name}</strong> | Home Rack: <strong>Rack ${copy.home_rack_number || 'N/A'}</strong>
              </div>
            </div>
            <span class="badge-stock available">${copy.status}</span>
          </div>
        </div>

        <div class="card">
          <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 1rem;">Movement Timeline (${history.length} Events)</h3>
          <div class="timeline">
            ${history.map(m => `
              <div class="timeline-item">
                <div class="timeline-dot ${m.movement_type}"></div>
                <div class="timeline-content">
                  <div class="timeline-time">${m.scan_time}</div>
                  <div class="timeline-title">${m.movement_type}</div>
                  <div style="font-size: 0.85rem; color: var(--text-secondary);">
                    From: <strong>${m.from_location_type} ${m.from_location_id || ''}</strong> → 
                    To: <strong>${m.to_location_type} ${m.to_location_id || ''}</strong>
                  </div>
                  <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
                    Scanned by: <strong>${m.scanned_by || 'Staff'}</strong> (${m.user_role || 'Staff'})
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } catch (err) {
      area.innerHTML = `<div class="card" style="color:var(--rose-500); padding:2rem; text-align:center;">Failed to find copy: ${err.message}</div>`;
    }
  },

  // =========================================================================
  // 5. WRONG-RACK ALERTS
  // =========================================================================
  async renderWrongRack(container) {
    container.innerHTML = `
      <div class="card">
        <div style="margin-bottom: 1.5rem;">
          <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--rose-500);">
            <i class="fa-solid fa-triangle-exclamation"></i> Misplaced Copies (Wrong Rack)
          </h2>
          <p style="color: var(--text-muted); font-size: 0.85rem;">
            Live records from view <code>v_wrong_rack</code> where current physical rack differs from designated home rack.
          </p>
        </div>

        <div id="wrong-rack-table-wrapper" class="table-container">
          <div style="padding: 2rem; text-align: center;">Scanning misplaced copies...</div>
        </div>
      </div>
    `;

    try {
      const data = await API.get('/alerts/wrong-rack');
      const alerts = data.alerts || [];
      const wrapper = document.getElementById('wrong-rack-table-wrapper');

      if (alerts.length === 0) {
        wrapper.innerHTML = '<div style="padding: 3rem; text-align: center; color: var(--emerald-500); font-weight: 700;">✓ No misplaced copies detected in your library branch!</div>';
        return;
      }

      wrapper.innerHTML = `
        <table class="table">
          <thead>
            <tr>
              <th>Barcode</th>
              <th>Book Title</th>
              <th>Expected Home Rack</th>
              <th>Current Placed Rack</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${alerts.map(a => `
              <tr>
                <td><code style="font-family:var(--font-mono); font-weight:700; color:var(--amber-600);">${a.barcode}</code></td>
                <td><strong>${a.title}</strong></td>
                <td><span class="badge-stock available">Rack ${a.expected_rack}</span></td>
                <td><span class="badge-stock" style="background-color: var(--rose-100); color: var(--rose-600);">Rack ${a.actual_rack}</span></td>
                <td>${a.status}</td>
                <td>
                  <button class="btn btn-primary btn-sm" onclick="LibrarianView.switchView('scan')">
                    Re-shelf / Scan
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      document.getElementById('wrong-rack-table-wrapper').innerHTML = `<div style="color:var(--rose-500); padding:2rem;">Failed to load alerts: ${err.message}</div>`;
    }
  },

  // =========================================================================
  // 6. INTER-LIBRARY TRANSFERS
  // =========================================================================
  async renderTransfers(container) {
    container.innerHTML = `
      <div class="card" style="margin-bottom: 2rem;">
        <h2 style="font-size: 1.3rem; font-weight: 800; margin-bottom: 0.5rem;">Raise Inter-Library Transfer</h2>
        <form onsubmit="LibrarianView.handleCreateTransfer(event)" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) 120px; gap: 1rem; align-items: flex-end;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Copy ID</label>
            <input type="number" id="tr-copy-id" class="form-input" placeholder="e.g. 20" required>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Source Branch</label>
            <select id="tr-source-lib" class="form-select" required>
              <option value="1">Central Library (#1)</option>
              <option value="2">Tech Hub Library (#2)</option>
              <option value="3">Heritage Library (#3)</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Destination Branch</label>
            <select id="tr-dest-lib" class="form-select" required>
              <option value="2">Tech Hub Library (#2)</option>
              <option value="1">Central Library (#1)</option>
              <option value="3">Heritage Library (#3)</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary" style="height:44px;">Submit</button>
        </form>
      </div>

      <div class="card">
        <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 1rem;">Active Inter-Library Transfers</h3>
        <div id="transfers-table-wrapper" class="table-container">Loading transfers...</div>
      </div>
    `;

    this.loadTransfersTable();
  },

  async loadTransfersTable() {
    const wrapper = document.getElementById('transfers-table-wrapper');
    if (!wrapper) return;

    try {
      const data = await API.get('/transfers');
      const transfers = data.transfers || [];

      if (transfers.length === 0) {
        wrapper.innerHTML = '<div style="padding:2rem; text-align:center;">No active transfer requests.</div>';
        return;
      }

      wrapper.innerHTML = `
        <table class="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Book Title</th>
              <th>Barcode</th>
              <th>From</th>
              <th>To</th>
              <th>Date</th>
              <th>Status</th>
              <th>Advance State</th>
            </tr>
          </thead>
          <tbody>
            ${transfers.map(t => {
              let actionBtn = '—';
              if (t.status === 'PENDING') {
                actionBtn = `<button class="btn btn-secondary btn-sm" onclick="LibrarianView.advanceTransfer(${t.transfer_id}, 'APPROVED')">Approve</button>`;
              } else if (t.status === 'APPROVED') {
                actionBtn = `<button class="btn btn-primary btn-sm" onclick="LibrarianView.advanceTransfer(${t.transfer_id}, 'IN_TRANSIT')">Dispatch Transit</button>`;
              } else if (t.status === 'IN_TRANSIT') {
                actionBtn = `<button class="btn btn-primary btn-sm" onclick="LibrarianView.advanceTransfer(${t.transfer_id}, 'RECEIVED')">Mark Received</button>`;
              }

              return `
                <tr>
                  <td>#${t.transfer_id}</td>
                  <td><strong>${t.title}</strong></td>
                  <td><code>${t.barcode}</code></td>
                  <td>${t.source_library}</td>
                  <td>${t.destination_library}</td>
                  <td>${t.request_date}</td>
                  <td><span class="role-tag LIBRARIAN">${t.status}</span></td>
                  <td>${actionBtn}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      wrapper.innerHTML = `<div style="color:var(--rose-500)">Failed to load transfers: ${err.message}</div>`;
    }
  },

  async handleCreateTransfer(e) {
    e.preventDefault();
    const copyId = parseInt(document.getElementById('tr-copy-id').value, 10);
    const src = parseInt(document.getElementById('tr-source-lib').value, 10);
    const dst = parseInt(document.getElementById('tr-dest-lib').value, 10);

    if (src === dst) {
      Toast.error('Source and destination library cannot be the same!');
      return;
    }

    try {
      const res = await API.post('/transfers', {
        copy_id: copyId,
        source_library_id: src,
        destination_library_id: dst
      });
      Toast.success(res.message);
      this.loadTransfersTable();
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async advanceTransfer(id, newStatus) {
    try {
      const res = await API.patch(`/transfers/${id}`, { status: newStatus });
      Toast.success(res.message);
      this.loadTransfersTable();
    } catch (err) {
      Toast.error(err.message);
    }
  },

  // =========================================================================
  // 7. COPIES MANAGEMENT
  // =========================================================================
  async renderCopies(container) {
    container.innerHTML = `
      <div class="card" style="margin-bottom: 2rem;">
        <h2 style="font-size: 1.3rem; font-weight: 800; margin-bottom: 0.5rem;">Add New Physical Book Copy</h2>
        <form onsubmit="LibrarianView.handleAddCopy(event)" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) 120px; gap: 1rem; align-items: flex-end;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Book ID</label>
            <input type="number" id="copy-book-id" class="form-input" placeholder="e.g. 1" required>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Barcode</label>
            <input type="text" id="copy-barcode" class="form-input" placeholder="e.g. LIB-A-BC9999" required>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Home Rack ID</label>
            <input type="number" id="copy-rack-id" class="form-input" placeholder="e.g. 1 (R01)" required>
          </div>
          <button type="submit" class="btn btn-primary" style="height:44px;">Register Copy</button>
        </form>
      </div>

      <div class="card">
        <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 1rem;">Branch Copies Inventory</h3>
        <div id="branch-copies-table-wrapper" class="table-container">Loading copies...</div>
      </div>
    `;

    try {
      const data = await API.get('/copies');
      const copies = data.copies || [];
      const wrapper = document.getElementById('branch-copies-table-wrapper');

      wrapper.innerHTML = `
        <table class="table">
          <thead>
            <tr>
              <th>Copy ID</th>
              <th>Barcode</th>
              <th>Title</th>
              <th>Status</th>
              <th>Location</th>
              <th>Home Rack</th>
            </tr>
          </thead>
          <tbody>
            ${copies.map(c => `
              <tr>
                <td>#${c.copy_id}</td>
                <td><code style="font-weight:700; color:var(--amber-600);">${c.barcode}</code></td>
                <td><strong>${c.title}</strong></td>
                <td><span class="badge-stock available">${c.status}</span></td>
                <td>${c.current_location_type} ${c.current_location_id || ''}</td>
                <td>Rack ${c.home_rack_number || 'N/A'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      document.getElementById('branch-copies-table-wrapper').innerHTML = `<div style="color:var(--rose-500)">${err.message}</div>`;
    }
  },

  async handleAddCopy(e) {
    e.preventDefault();
    const bookId = parseInt(document.getElementById('copy-book-id').value, 10);
    const barcode = document.getElementById('copy-barcode').value.trim();
    const rackId = parseInt(document.getElementById('copy-rack-id').value, 10);

    try {
      const res = await API.post('/copies', {
        book_id: bookId,
        barcode,
        home_rack_id: rackId
      });
      Toast.success(res.message);
      this.renderCopies(document.getElementById('librarian-view-content'));
    } catch (err) {
      Toast.error(err.message);
    }
  }
};

window.LibrarianView = LibrarianView;
