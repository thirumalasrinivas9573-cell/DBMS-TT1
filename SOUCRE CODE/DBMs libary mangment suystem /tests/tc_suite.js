/**
 * Automated Verification Suite for Section 16 (TC-01 through TC-12)
 * Smart, Connected Multi-Library Book Tracking & Discovery System
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

// Self-contained SQLite configuration for test environment
process.env.DB_CLIENT = 'sqlite';
process.env.NODE_ENV = 'test';

// Initialize clean database state
require('../backend/db/init.js');
const { query } = require('../backend/config/db');
const app = require('../backend/server');

let server;
let baseUrl = '';

function request(method, reqPath, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(reqPath, baseUrl);
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

const testResults = [];

function recordResult(id, title, pass, details = '') {
  const status = pass ? 'PASS' : 'FAIL';
  const icon = pass ? '✅' : '❌';
  console.log(`${icon} [${id}] ${title}: ${status}`);
  if (details) {
    console.log(`    ↳ ${details}`);
  }
  testResults.push({ id, title, status, details });
}

async function runTestSuite() {
  console.log('\n========================================================================');
  console.log(' SECTION 16 TEST SUITE: TC-01 TO TC-12 AUTOMATED VERIFICATION');
  console.log('========================================================================\n');

  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Test server active on ${baseUrl}\n`);

  try {
    // 0. Authenticate test actors
    const adminLogin = await request('POST', '/api/auth/login', { email: 'admin@hydlib.org', password: 'admin123' });
    const adminToken = adminLogin.body.token;

    const lib1Login = await request('POST', '/api/auth/login', { email: 'librarian1@hydlib.org', password: 'lib123' });
    const lib1Token = lib1Login.body.token;

    const lib2Login = await request('POST', '/api/auth/login', { email: 'librarian2@hydlib.org', password: 'lib123' });
    const lib2Token = lib2Login.body.token;

    const memberLogin = await request('POST', '/api/auth/login', { email: 'srinivas@student.edu', password: 'member123' });
    const memberToken = memberLogin.body.token;

    // -------------------------------------------------------------------------
    // TC-01: Register with an email that already exists
    // -------------------------------------------------------------------------
    const tc01Email = `tc01_duplicate_${Date.now()}@student.edu`;
    // First registration -> succeeds (201)
    await request('POST', '/api/auth/register', {
      name: 'Initial Student',
      email: tc01Email,
      password: 'password123',
      phone: '9000000001'
    });
    // Duplicate registration -> rejected (409)
    const tc01DupRes = await request('POST', '/api/auth/register', {
      name: 'Duplicate Student',
      email: tc01Email,
      password: 'password456',
      phone: '9000000002'
    });
    recordResult(
      'TC-01',
      'Register with an email that already exists',
      tc01DupRes.status === 409 && tc01DupRes.body.error && (tc01DupRes.body.error.toLowerCase().includes('already exists') || tc01DupRes.body.error.toLowerCase().includes('already registered')),
      `Status: ${tc01DupRes.status}, Error message: "${tc01DupRes.body.error}"`
    );

    // -------------------------------------------------------------------------
    // TC-02: Insert two copies with the same barcode
    // -------------------------------------------------------------------------
    const tc02Barcode = `TC02-DUP-BARCODE-${Date.now()}`;
    // First insert -> succeeds (201)
    await request('POST', '/api/copies', {
      book_id: 1,
      barcode: tc02Barcode,
      library_id: 1,
      home_rack_id: 1
    }, lib1Token);
    // Second insert with identical barcode -> fails (409)
    const tc02DupRes = await request('POST', '/api/copies', {
      book_id: 1,
      barcode: tc02Barcode,
      library_id: 1,
      home_rack_id: 2
    }, lib1Token);
    recordResult(
      'TC-02',
      'Insert two copies with the same barcode',
      tc02DupRes.status === 409 && tc02DupRes.body.error && tc02DupRes.body.error.toLowerCase().includes('already exists'),
      `Status: ${tc02DupRes.status}, Error message: "${tc02DupRes.body.error}"`
    );

    // -------------------------------------------------------------------------
    // TC-03: Scan copy BC-1023 into its expected rack R12
    // -------------------------------------------------------------------------
    const tc03Res = await request('POST', '/api/scan', {
      book_barcode: 'BC-1023',
      location_barcode: 'R12'
    }, lib1Token);

    // Verify movement logged
    const [tc03Movements] = await query(
      `SELECT * FROM book_movement bm 
       JOIN book_copy bc ON bc.copy_id = bm.copy_id 
       WHERE bc.barcode = 'BC-1023' 
       ORDER BY bm.movement_id DESC LIMIT 1`
    );

    recordResult(
      'TC-03',
      'Scan copy BC-1023 into its expected rack R12',
      tc03Res.status === 200 &&
      tc03Res.body.status === 'AVAILABLE' &&
      tc03Res.body.wrong_rack &&
      tc03Res.body.wrong_rack.is_wrong_rack === false &&
      tc03Movements.length > 0 &&
      tc03Movements[0].movement_type === 'PLACED_RACK',
      `Status: ${tc03Res.body.status}, Wrong rack: ${tc03Res.body.wrong_rack ? tc03Res.body.wrong_rack.is_wrong_rack : 'N/A'}, Movement type: ${tc03Movements[0] ? tc03Movements[0].movement_type : 'None'}`
    );

    // -------------------------------------------------------------------------
    // TC-04: Scan copy BC-1023 into rack R18 (expected R12)
    // -------------------------------------------------------------------------
    const tc04Res = await request('POST', '/api/scan', {
      book_barcode: 'BC-1023',
      location_barcode: 'R18'
    }, lib1Token);

    // Verify notification created
    const [tc04Notif] = await query(
      `SELECT * FROM notification 
       WHERE type = 'WRONG_RACK' AND message LIKE '%BC-1023%' 
       ORDER BY notification_id DESC LIMIT 1`
    );

    recordResult(
      'TC-04',
      'Scan copy BC-1023 into rack R18 (expected R12)',
      tc04Res.status === 200 &&
      tc04Res.body.status === 'AVAILABLE' &&
      tc04Res.body.wrong_rack &&
      tc04Res.body.wrong_rack.is_wrong_rack === true &&
      tc04Notif.length > 0,
      `Status: ${tc04Res.body.status}, Wrong rack alert triggered: ${tc04Res.body.wrong_rack.is_wrong_rack}, Notification id: #${tc04Notif[0] ? tc04Notif[0].notification_id : 'None'}`
    );

    // -------------------------------------------------------------------------
    // TC-05: Search "machine learning books"
    // -------------------------------------------------------------------------
    const tc05Res = await request('GET', '/api/books?q=machine%20learning%20books');
    const mlBooksFound = tc05Res.body && tc05Res.body.books && tc05Res.body.books.length > 0;
    const allAreML = mlBooksFound && tc05Res.body.books.some(b => 
      b.category_name.toLowerCase().includes('machine learning') || 
      b.title.toLowerCase().includes('machine learning')
    );

    recordResult(
      'TC-05',
      'Search "machine learning books"',
      tc05Res.status === 200 && mlBooksFound && allAreML,
      `Returned count: ${tc05Res.body.count || (tc05Res.body.books ? tc05Res.body.books.length : 0)} books matching keyword / category`
    );

    // -------------------------------------------------------------------------
    // TC-06: Open Atomic Habits with libraries having 0, 3 and 1 copies
    // -------------------------------------------------------------------------
    // Atomic Habits is book_id 23
    // Querying with coordinates close to Tech Hub / HITEC City (17.4474, 78.3762)
    const tc06Res = await request('GET', '/api/books/23/availability?lat=17.4474&lng=78.3762');
    const bestMatch = tc06Res.body.best_match;

    recordResult(
      'TC-06',
      'Open Atomic Habits with libraries (Library B 3 copies, nearest best match)',
      tc06Res.status === 200 &&
      bestMatch !== null &&
      bestMatch.library_id === 2 && // Library B (Tech Hub)
      bestMatch.available_copies >= 3 &&
      bestMatch.distance_km < 4.0,
      `Best match: Library #${bestMatch ? bestMatch.library_id : 'None'} (${bestMatch ? bestMatch.library_name : ''}) with ${bestMatch ? bestMatch.available_copies : 0} available copies at ${bestMatch ? bestMatch.distance_km : 0} km`
    );

    // -------------------------------------------------------------------------
    // TC-07: Return a book borrowed at Library A to Library B (200 km, ₹2/km)
    // -------------------------------------------------------------------------
    // Create new copy and issue it at Library A (Central = Library #1)
    const tc07Barcode = `TC07-RETURN-BC-${Date.now()}`;
    await request('POST', '/api/copies', {
      book_id: 2,
      barcode: tc07Barcode,
      library_id: 1,
      home_rack_id: 1
    }, lib1Token);

    const tc07IssueRes = await request('POST', '/api/transactions/issue', {
      barcode: tc07Barcode,
      user_id: 4,
      deposit_amount: 500.00,
      due_days: 14
    }, lib1Token);

    const tc07TxId = tc07IssueRes.body.transaction_id;

    // Return at Library B (Library #2) with 200 km distance
    const tc07ReturnRes = await request('POST', `/api/transactions/${tc07TxId}/return`, {
      distance_km: 200.0
    }, lib2Token);

    // Verify copy is now owned by Library B (#2)
    const [tc07CopyRow] = await query('SELECT library_id, status FROM book_copy WHERE barcode = ?', [tc07Barcode]);

    recordResult(
      'TC-07',
      'Return book borrowed at Library A to Library B (200 km, ₹2/km -> ₹400 charge)',
      tc07ReturnRes.status === 200 &&
      tc07ReturnRes.body.financials.transfer_charge === 400.00 &&
      tc07ReturnRes.body.financials.refund_amount === 100.00 &&
      tc07ReturnRes.body.status === 'RETURNED_ALT_LIBRARY' &&
      tc07CopyRow.length > 0 &&
      tc07CopyRow[0].library_id === 2,
      `Transfer charge: ₹${tc07ReturnRes.body.financials ? tc07ReturnRes.body.financials.transfer_charge : 'N/A'}, Status: ${tc07ReturnRes.body.status}, Copy assigned library: #${tc07CopyRow[0] ? tc07CopyRow[0].library_id : 'N/A'}`
    );

    // -------------------------------------------------------------------------
    // TC-08: Return after the due date
    // -------------------------------------------------------------------------
    // Transaction #2 was issued with due_date 11 days ago
    // We process its return today
    const tc08ReturnRes = await request('POST', '/api/transactions/2/return', {
      return_library_id: 1
    }, lib1Token);

    const tc08LateFee = tc08ReturnRes.body.financials ? tc08ReturnRes.body.financials.lateFee || tc08ReturnRes.body.financials.late_fee : 0;
    const [tc08TxRow] = await query('SELECT late_fee, refund_amount, status FROM borrow_transaction WHERE transaction_id = 2');

    recordResult(
      'TC-08',
      'Return after the due date (late fee calculated and stored separately)',
      tc08ReturnRes.status === 200 &&
      tc08LateFee > 0 &&
      tc08TxRow.length > 0 &&
      tc08TxRow[0].late_fee > 0 &&
      tc08TxRow[0].status === 'RETURNED',
      `Late fee calculated: ₹${tc08LateFee}, Days overdue: ${tc08ReturnRes.body.financials.daysOverdue || tc08ReturnRes.body.financials.days_overdue}, Saved in DB: ₹${tc08TxRow[0].late_fee}`
    );

    // -------------------------------------------------------------------------
    // TC-09: Raise transfer request with source = destination
    // -------------------------------------------------------------------------
    const tc09Res = await request('POST', '/api/transfers', {
      copy_id: 1,
      source_library_id: 1,
      destination_library_id: 1
    }, lib1Token);

    recordResult(
      'TC-09',
      'Raise transfer request with source = destination (CHECK rejection)',
      tc09Res.status === 400 &&
      tc09Res.body.error &&
      tc09Res.body.error.toLowerCase().includes('cannot be the same'),
      `Status: ${tc09Res.status}, Error message: "${tc09Res.body.error}"`
    );

    // -------------------------------------------------------------------------
    // TC-10: Move transfer request PENDING → APPROVED → IN_TRANSIT → RECEIVED
    // -------------------------------------------------------------------------
    // Create new transfer: Copy #3 from Library 1 to Library 3
    const tc10CreateRes = await request('POST', '/api/transfers', {
      copy_id: 3,
      source_library_id: 1,
      destination_library_id: 3
    }, lib1Token);
    const tc10TransferId = tc10CreateRes.body.transfer_id;

    // Step 1: PENDING -> APPROVED
    const tc10ApproveRes = await request('PATCH', `/api/transfers/${tc10TransferId}`, { status: 'APPROVED' }, lib1Token);
    // Step 2: APPROVED -> IN_TRANSIT
    const tc10TransitRes = await request('PATCH', `/api/transfers/${tc10TransferId}`, { status: 'IN_TRANSIT' }, lib1Token);
    // Step 3: IN_TRANSIT -> RECEIVED
    const tc10ReceiveRes = await request('PATCH', `/api/transfers/${tc10TransferId}`, { status: 'RECEIVED' }, lib1Token);

    // Verify copy library updated to Library 3
    const [tc10CopyRow] = await query('SELECT library_id, status FROM book_copy WHERE copy_id = 3');

    recordResult(
      'TC-10',
      'Move transfer request PENDING → APPROVED → IN_TRANSIT → RECEIVED',
      tc10ApproveRes.status === 200 && tc10ApproveRes.body.new_status === 'APPROVED' &&
      tc10TransitRes.status === 200 && tc10TransitRes.body.new_status === 'IN_TRANSIT' &&
      tc10ReceiveRes.status === 200 && tc10ReceiveRes.body.new_status === 'RECEIVED' &&
      tc10CopyRow.length > 0 && tc10CopyRow[0].library_id === 3,
      `Final status: ${tc10ReceiveRes.body.new_status}, Copy library updated to: #${tc10CopyRow[0] ? tc10CopyRow[0].library_id : 'N/A'}`
    );

    // -------------------------------------------------------------------------
    // TC-11: Simulate an error midway through an alternate-library return
    // -------------------------------------------------------------------------
    // Create and issue a copy for TC-11
    const tc11Barcode = `TC11-ROLLBACK-${Date.now()}`;
    await request('POST', '/api/copies', {
      book_id: 1,
      barcode: tc11Barcode,
      library_id: 1,
      home_rack_id: 1
    }, lib1Token);

    const tc11Issue = await request('POST', '/api/transactions/issue', {
      barcode: tc11Barcode,
      user_id: 4,
      deposit_amount: 500.00,
      due_days: 14
    }, lib1Token);
    const tc11TxId = tc11Issue.body.transaction_id;

    // Execute return with simulate_error flag
    const tc11FailRes = await request('POST', `/api/transactions/${tc11TxId}/return`, {
      simulate_error: true,
      distance_km: 15.0
    }, lib2Token);

    // Check database state after simulated failure
    const [tc11TxAfter] = await query('SELECT status, return_date, refund_amount FROM borrow_transaction WHERE transaction_id = ?', [tc11TxId]);
    const [tc11CopyAfter] = await query('SELECT library_id, status FROM book_copy WHERE barcode = ?', [tc11Barcode]);

    recordResult(
      'TC-11',
      'Simulate an error midway through an alternate-library return (Rollback verification)',
      tc11FailRes.status === 500 &&
      tc11TxAfter.length > 0 &&
      tc11TxAfter[0].status === 'ISSUED' &&
      tc11TxAfter[0].return_date === null &&
      tc11CopyAfter.length > 0 &&
      tc11CopyAfter[0].library_id === 1 &&
      tc11CopyAfter[0].status === 'BORROWED',
      `HTTP status: ${tc11FailRes.status}, Tx status maintained: ${tc11TxAfter[0].status}, Copy library maintained: #${tc11CopyAfter[0].library_id}`
    );

    // -------------------------------------------------------------------------
    // TC-12: Member tries to open a librarian page / endpoint
    // -------------------------------------------------------------------------
    const tc12ScanRes = await request('POST', '/api/scan', { book_barcode: 'BC-1023' }, memberToken);
    const tc12IssueRes = await request('POST', '/api/transactions/issue', { barcode: 'BC-1023', user_id: 4 }, memberToken);
    const tc12CopyRes = await request('POST', '/api/copies', { book_id: 1, barcode: 'TC12-FORBIDDEN', library_id: 1 }, memberToken);

    recordResult(
      'TC-12',
      'Member tries to open a librarian page / endpoint (Access Denied 403)',
      tc12ScanRes.status === 403 &&
      tc12IssueRes.status === 403 &&
      tc12CopyRes.status === 403,
      `POST /api/scan -> ${tc12ScanRes.status}, POST /api/transactions/issue -> ${tc12IssueRes.status}, POST /api/copies -> ${tc12CopyRes.status}`
    );

  } catch (err) {
    console.error('Fatal execution error:', err);
  } finally {
    if (server) {
      server.close();
    }
  }

  // Summary
  const passed = testResults.filter(r => r.status === 'PASS').length;
  const failed = testResults.filter(r => r.status === 'FAIL').length;
  console.log('\n========================================================================');
  console.log(` RESULTS SUMMARY: ${passed} PASSED | ${failed} FAILED | TOTAL: ${testResults.length}`);
  console.log('========================================================================\n');

  return { passed, failed, total: testResults.length, results: testResults };
}

if (require.main === module) {
  runTestSuite().then(({ failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  });
}

module.exports = runTestSuite;
