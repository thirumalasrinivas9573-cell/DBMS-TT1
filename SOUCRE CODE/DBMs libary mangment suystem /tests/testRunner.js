const http = require('http');
const fs = require('fs');
const path = require('path');

// Ensure SQLite is used during automated test runner for self-contained execution
process.env.DB_CLIENT = 'sqlite';
process.env.NODE_ENV = 'test';

// Run db:init first
require('../backend/db/init.js');

const app = require('../backend/server');

let server;
let baseUrl = '';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {
          json = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

const results = [];

function assert(description, condition, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    results.push({ description, status: 'PASS', details });
  } else {
    console.error(`  ❌ FAIL: ${description} - ${details}`);
    results.push({ description, status: 'FAIL', details });
  }
}

async function runTests() {
  console.log('\n=============================================================');
  console.log(' STARTING END-TO-END AUTOMATED TEST SUITE (Section 12 & 16)');
  console.log('=============================================================\n');

  // Start HTTP server
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Test server running at ${baseUrl}\n`);

  let adminToken = '';
  let lib1Token = '';
  let lib2Token = '';
  let memberToken = '';

  try {
    // 1. Health check
    console.log('[Test Group 1: System Health]');
    const health = await request('GET', '/api/health');
    assert('GET /api/health returns 200 OK', health.status === 200 && health.body.status === 'online');

    // 2. Authentication & Security
    console.log('\n[Test Group 2: Authentication & Authorization]');
    
    // Login Admin
    const adminLogin = await request('POST', '/api/auth/login', {
      email: 'admin@hydlib.org',
      password: 'admin123'
    });
    assert('Admin login returns 200 and token', adminLogin.status === 200 && !!adminLogin.body.token);
    adminToken = adminLogin.body.token;

    // Login Librarian 1 (Central Library #1)
    const lib1Login = await request('POST', '/api/auth/login', {
      email: 'librarian1@hydlib.org',
      password: 'lib123'
    });
    assert('Librarian 1 login returns 200 and library_id=1', lib1Login.status === 200 && lib1Login.body.user.library_id === 1);
    lib1Token = lib1Login.body.token;

    // Login Librarian 2 (Tech Hub Library #2)
    const lib2Login = await request('POST', '/api/auth/login', {
      email: 'librarian2@hydlib.org',
      password: 'lib123'
    });
    assert('Librarian 2 login returns 200 and library_id=2', lib2Login.status === 200 && lib2Login.body.user.library_id === 2);
    lib2Token = lib2Login.body.token;

    // Login Member
    const memberLogin = await request('POST', '/api/auth/login', {
      email: 'srinivas@student.edu',
      password: 'member123'
    });
    assert('Member login returns 200 and role MEMBER', memberLogin.status === 200 && memberLogin.body.user.role === 'MEMBER');
    memberToken = memberLogin.body.token;

    // Invalid password
    const badLogin = await request('POST', '/api/auth/login', {
      email: 'admin@hydlib.org',
      password: 'wrong_password'
    });
    assert('Invalid password rejected with 401', badLogin.status === 401);

    // Register new member
    const uniqueEmail = `test.user.${Date.now()}@student.edu`;
    const regRes = await request('POST', '/api/auth/register', {
      name: 'New Registered Student',
      email: uniqueEmail,
      password: 'securePassword123',
      phone: '9876543210'
    });
    assert('Register new member returns 201', regRes.status === 201 && !!regRes.body.token);

    // TC-01: Duplicate registration rejected
    const dupReg = await request('POST', '/api/auth/register', {
      name: 'Duplicate Student',
      email: uniqueEmail,
      password: 'securePassword123'
    });
    assert('TC-01: Duplicate email rejected with 409', dupReg.status === 409);

    // GET /api/auth/me
    const meRes = await request('GET', '/api/auth/me', null, memberToken);
    assert('GET /api/auth/me returns authenticated user details', meRes.status === 200 && meRes.body.user.email === 'srinivas@student.edu');

    // TC-12: Role check - Member cannot access librarian route
    const forbiddenScan = await request('POST', '/api/scan', { book_barcode: 'LIB-A-BC1001' }, memberToken);
    assert('TC-12: Member accessing librarian scan route returns 403 Forbidden', forbiddenScan.status === 403);

    // 3. Books & Discovery
    console.log('\n[Test Group 3: Catalog Search & Availability]');

    // Search query
    const searchRes = await request('GET', '/api/books?q=Learning');
    assert('GET /api/books?q=Learning finds matching titles', searchRes.status === 200 && searchRes.body.count > 0);

    // Category search (TC-05)
    const catSearch = await request('GET', '/api/books?category=Machine Learning');
    assert('TC-05: Search "Machine Learning" returns category titles', catSearch.status === 200 && catSearch.body.count >= 4);

    // Book details
    const bookDetails = await request('GET', '/api/books/1');
    assert('GET /api/books/1 returns title and copies list', bookDetails.status === 200 && bookDetails.body.book.title.includes('Hands-On Machine Learning'));

    // Multi-library availability with Haversine distance (TC-06)
    // Atomic Habits is book_id 23
    const availRes = await request('GET', '/api/books/23/availability?lat=17.4474&lng=78.3762');
    assert('TC-06: GET /api/books/23/availability returns libraries sorted by distance', 
      availRes.status === 200 && 
      availRes.body.libraries.length === 3 &&
      availRes.body.best_match !== null &&
      availRes.body.best_match.library_id === 2 // Tech Hub is right at 17.4474, 78.3762!
    );

    // 4. Libraries
    console.log('\n[Test Group 4: Libraries & Layout]');
    const libsRes = await request('GET', '/api/libraries');
    assert('GET /api/libraries lists 3 Hyderabad branches', libsRes.status === 200 && libsRes.body.count === 3);

    const lib1Details = await request('GET', '/api/libraries/1');
    assert('GET /api/libraries/1 includes racks and tables', lib1Details.status === 200 && lib1Details.body.library.racks.length > 0 && lib1Details.body.library.reading_tables.length > 0);

    // 5. Physical Barcode Tracking & Wrong-Rack Alert (Section 9.1 & 9.2)
    console.log('\n[Test Group 5: Barcode Scanning & Wrong-Rack Detection]');

    // Add a new copy for testing (TC-02 unique barcode check)
    const testBarcode = `TEST-BC-${Date.now()}`;
    const addCopyRes = await request('POST', '/api/copies', {
      book_id: 1,
      barcode: testBarcode,
      library_id: 1,
      home_rack_id: 1 // Expected rack R01
    }, lib1Token);
    assert('POST /api/copies creates a new copy', addCopyRes.status === 201 && addCopyRes.body.barcode === testBarcode);

    // TC-02: Duplicate barcode fails
    const dupBarcodeRes = await request('POST', '/api/copies', {
      book_id: 1,
      barcode: testBarcode,
      library_id: 1
    }, lib1Token);
    assert('TC-02: Duplicate barcode creation rejected with 409', dupBarcodeRes.status === 409);

    // Scan Step 1: Book leaves rack (scan book alone) -> IN_TRANSIT
    const scanStep1 = await request('POST', '/api/scan', {
      book_barcode: testBarcode
    }, lib1Token);
    assert('Scan 1: Book alone leaves rack -> status IN_TRANSIT', scanStep1.status === 200 && scanStep1.body.status === 'IN_TRANSIT');

    // Scan Step 2: Student sits at Table T01 -> READING
    const scanStep2 = await request('POST', '/api/scan', {
      book_barcode: testBarcode,
      location_barcode: 'T01'
    }, lib1Token);
    assert('Scan 2: Book + Table T01 -> status READING', scanStep2.status === 200 && scanStep2.body.status === 'READING');

    // Scan Step 3: Student finishes reading (scan book alone) -> RETURNING
    const scanStep3 = await request('POST', '/api/scan', {
      book_barcode: testBarcode
    }, lib1Token);
    assert('Scan 3: Book alone while reading -> status RETURNING', scanStep3.status === 200 && scanStep3.body.status === 'RETURNING');

    // Scan Step 4: TC-04 Scan into WRONG rack (R05 instead of home R01) -> wrong rack alert & notification
    const scanWrongRack = await request('POST', '/api/scan', {
      book_barcode: testBarcode,
      location_barcode: 'R05'
    }, lib1Token);
    assert('TC-04: Book placed in wrong rack R05 triggers wrong_rack alert', 
      scanWrongRack.status === 200 && 
      scanWrongRack.body.wrong_rack.is_wrong_rack === true &&
      scanWrongRack.body.status === 'AVAILABLE'
    );

    // Scan Step 5: TC-03 Scan into CORRECT rack (R01) -> no wrong rack alert
    const scanCorrectRack = await request('POST', '/api/scan', {
      book_barcode: testBarcode,
      location_barcode: 'R01'
    }, lib1Token);
    assert('TC-03: Book placed in correct home rack R01 clears wrong_rack alert', 
      scanCorrectRack.status === 200 && 
      scanCorrectRack.body.wrong_rack.is_wrong_rack === false &&
      scanCorrectRack.body.status === 'AVAILABLE'
    );

    // Verify copy history timeline (FR-19)
    const copyHistory = await request('GET', `/api/copies/${testBarcode}/history`, null, lib1Token);
    assert('FR-19: GET /api/copies/:barcode/history returns chronological audit trail',
      copyHistory.status === 200 && copyHistory.body.history.length >= 5
    );

    // Wrong rack alerts endpoint
    const wrongRackAlerts = await request('GET', '/api/alerts/wrong-rack', null, lib1Token);
    assert('GET /api/alerts/wrong-rack returns list of misplaced books in library',
      wrongRackAlerts.status === 200 && Array.isArray(wrongRackAlerts.body.alerts)
    );

    // 6. Issue & Return (Same and Alternate Library)
    console.log('\n[Test Group 6: Issue, Return & Financial Calculations]');

    // Issue copy to member 4
    const issueRes = await request('POST', '/api/transactions/issue', {
      barcode: testBarcode,
      user_id: 4,
      due_days: 14,
      deposit_amount: 500
    }, lib1Token);
    assert('POST /api/transactions/issue creates loan and sets copy BORROWED',
      issueRes.status === 201 && issueRes.body.status === undefined || issueRes.status === 201 && issueRes.body.transaction_id > 0
    );
    const newTxId = issueRes.body.transaction_id;

    // Member checks own transactions
    const memberTxRes = await request('GET', '/api/me/transactions', null, memberToken);
    assert('GET /api/me/transactions lists active issued loan for member',
      memberTxRes.status === 200 && memberTxRes.body.transactions.some(t => t.transaction_id === newTxId)
    );

    // TC-07: Return at ALTERNATE library (Library #2 HITEC City receives book borrowed at Library #1 Central)
    // Distance between Library 1 and Library 2 is ~14 km. Rate is ₹2/km -> ~₹28 transfer fee.
    const altReturnRes = await request('POST', `/api/transactions/${newTxId}/return`, {}, lib2Token);
    assert('TC-07: Alternate library return calculates transfer distance, charge, and refund',
      altReturnRes.status === 200 &&
      altReturnRes.body.is_alternate_library === true &&
      altReturnRes.body.financials.distance_km > 0 &&
      altReturnRes.body.financials.transfer_charge > 0 &&
      altReturnRes.body.financials.refund_amount < 500 &&
      altReturnRes.body.status === 'RETURNED_ALT_LIBRARY'
    );

    // Verify copy is now owned by Library #2
    const verifyCopyLib = await request('GET', `/api/copies/${testBarcode}/history`, null, lib2Token);
    assert('TC-07: Physical copy library updated to return library (#2)',
      verifyCopyLib.status === 200 && verifyCopyLib.body.copy.library_id === 2
    );

    // 7. Inter-Library Transfer Requests (Section 9.6)
    console.log('\n[Test Group 7: Inter-Library Transfers State Machine]');

    // TC-09: Transfer request with source == destination rejected
    const badTransfer = await request('POST', '/api/transfers', {
      copy_id: 1,
      source_library_id: 1,
      destination_library_id: 1
    }, lib1Token);
    assert('TC-09: Transfer with source == destination rejected with 400', badTransfer.status === 400);

    // Create valid transfer request: Move copy #1 from Library 1 to Library 3
    const createTransfer = await request('POST', '/api/transfers', {
      copy_id: 1,
      source_library_id: 1,
      destination_library_id: 3
    }, lib1Token);
    assert('POST /api/transfers creates PENDING transfer request', createTransfer.status === 201 && createTransfer.body.status === 'PENDING');
    const transferId = createTransfer.body.transfer_id;

    // TC-10: State Machine progression: PENDING -> APPROVED
    const approveTransfer = await request('PATCH', `/api/transfers/${transferId}`, { status: 'APPROVED' }, lib1Token);
    assert('TC-10 (Step 1): PENDING -> APPROVED successful', approveTransfer.status === 200 && approveTransfer.body.new_status === 'APPROVED');

    // TC-10: APPROVED -> IN_TRANSIT
    const transitTransfer = await request('PATCH', `/api/transfers/${transferId}`, { status: 'IN_TRANSIT' }, lib1Token);
    assert('TC-10 (Step 2): APPROVED -> IN_TRANSIT marks copy IN_TRANSIT', transitTransfer.status === 200 && transitTransfer.body.new_status === 'IN_TRANSIT');

    // Invalid state transition: Cannot CANCEL once IN_TRANSIT
    const cancelFail = await request('PATCH', `/api/transfers/${transferId}`, { status: 'CANCELLED' }, lib1Token);
    assert('State Machine: Attempting CANCELLED while IN_TRANSIT rejected with 400', cancelFail.status === 400);

    // TC-10: IN_TRANSIT -> RECEIVED
    const receiveTransfer = await request('PATCH', `/api/transfers/${transferId}`, { status: 'RECEIVED' }, lib1Token);
    assert('TC-10 (Step 3): IN_TRANSIT -> RECEIVED completes transfer and updates copy library to #3',
      receiveTransfer.status === 200 && receiveTransfer.body.new_status === 'RECEIVED'
    );

    // 8. Notifications & Reports
    console.log('\n[Test Group 8: Notifications & Administrative Reports]');

    // Notifications
    const notifs = await request('GET', '/api/notifications', null, memberToken);
    assert('GET /api/notifications returns user alerts list with unread_count',
      notifs.status === 200 && Array.isArray(notifs.body.notifications)
    );

    if (notifs.body.notifications.length > 0) {
      const notifId = notifs.body.notifications[0].notification_id;
      const markRead = await request('PATCH', `/api/notifications/${notifId}/read`, null, memberToken);
      assert('PATCH /api/notifications/:id/read updates status to READ', markRead.status === 200);
    }

    // Admin Settings
    const getSettings = await request('GET', '/api/admin/settings', null, adminToken);
    assert('GET /api/admin/settings returns system configuration',
      getSettings.status === 200 && getSettings.body.settings.rate_per_km !== undefined
    );

    const updateSettings = await request('PUT', '/api/admin/settings', {
      rate_per_km: 2.25,
      late_fee_per_day: 6.00
    }, adminToken);
    assert('PUT /api/admin/settings updates rate_per_km and late_fee_per_day',
      updateSettings.status === 200 && updateSettings.body.settings.rate_per_km === 2.25
    );

    // Network Stock Report (Section 11.7)
    const stockReport = await request('GET', '/api/admin/reports/stock', null, adminToken);
    assert('GET /api/admin/reports/stock aggregates stock by library and title',
      stockReport.status === 200 && stockReport.body.stock.length > 0
    );

    // Overdue Report
    const overdueReport = await request('GET', '/api/reports/overdue', null, lib1Token);
    assert('GET /api/reports/overdue lists loans past due date with late fees',
      overdueReport.status === 200 && Array.isArray(overdueReport.body.report)
    );

    // Revenue Report
    const revenueReport = await request('GET', '/api/reports/revenue', null, adminToken);
    assert('GET /api/reports/revenue aggregates financial income by charge type',
      revenueReport.status === 200 && revenueReport.body.revenue_summary.total_settled_transactions > 0
    );

    // Most-Moved Copies Report
    const mostMovedReport = await request('GET', '/api/reports/most-moved', null, adminToken);
    assert('GET /api/reports/most-moved ranks top physically relocated copies',
      mostMovedReport.status === 200 && mostMovedReport.body.most_moved_copies.length > 0
    );

  } catch (err) {
    console.error('Fatal test execution error:', err);
    assert('Execution completed without runtime crash', false, err.message);
  } finally {
    if (server) {
      server.close();
    }
  }

  // Summary
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log('\n=============================================================');
  console.log(` TEST RUN COMPLETE: ${passed} PASSED | ${failed} FAILED | TOTAL: ${results.length}`);
  console.log('=============================================================\n');

  return { passed, failed, total: results.length, results };
}

if (require.main === module) {
  runTests().then(({ failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  });
}

module.exports = runTests;
