/**
 * Phase 11 E2E smoke test runner.
 * Boots a userspace MySQL 8, runs prisma migrate deploy + seed, starts the
 * NestJS API on a random port, then exercises the notification endpoints.
 */
const { createDB } = require('mysql-memory-server');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const API_DIR = '/home/z/my-project/caffenet/apps/api';

async function main() {
  console.log('⏳ Booting userspace MySQL 8...');
  const db = await createDB({ dbName: 'caffenet' });
  const DATABASE_URL = `mysql://${db.username}@127.0.0.1:${db.port}/${db.dbName}`;
  console.log('✅ MySQL up —', DATABASE_URL);

  const env = { ...process.env, DATABASE_URL };
  try {
    console.log('⏳ Running prisma migrate deploy...');
    execSync('npx prisma migrate deploy', { cwd: API_DIR, env, stdio: 'inherit' });

    console.log('⏳ Running seed...');
    execSync('npx prisma db seed', { cwd: API_DIR, env, stdio: 'inherit' });
    console.log('✅ Migration + seed complete');
  } catch (e) {
    console.error('❌ migrate/seed failed');
    console.error(e.stdout?.toString() || e.message);
    await db.stop();
    process.exit(1);
  }

  // Boot the API
  const API_PORT = 3901 + Math.floor(Math.random() * 500);
  console.log('⏳ Starting API on port', API_PORT, '...');
  const api = spawn('node', ['dist/main.js'], {
    cwd: API_DIR,
    env: {
      ...env,
      NODE_ENV: 'development',
      PORT: String(API_PORT),
      JWT_ACCESS_SECRET: 'e2e-test-jwt-access-secret-0123456789abcdef',
      JWT_REFRESH_SECRET: 'e2e-test-jwt-refresh-secret-0123456789abcdef',
      COOKIE_SECRET: 'e2e-test-cookie-secret-0123456789abcdef',
      ZARINPAL_CALLBACK_URL: 'http://localhost:3000/wallet/payment/callback',
      SMS_DRIVER: 'console',
      VAPID_PUBLIC_KEY:
        'BNUHyoVBdaC8qO53IMdMFoFJp9EES9YBRLeIx_UKGmW6-nZK8BnkYLRtDhRRKZV6ywLAzCXisOMEAqgxpHDLfhc',
      VAPID_PRIVATE_KEY: '2DYwpQBwFE5UDFaMhWsoE7s6Fo45vu8tZ6lhBVxxKMU',
      VAPID_SUBJECT: 'mailto:test@caffenet.local',
      LOG_LEVEL: 'info',
      LOG_PRETTY: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let apiLog = '';
  api.stdout.on('data', (d) => {
    apiLog += d.toString();
  });
  api.stderr.on('data', (d) => {
    apiLog += d.toString();
  });
  const apiLogPath = '/tmp/phase11-api.log';
  setInterval(() => {
    try {
      fs.writeFileSync(apiLogPath, apiLog);
    } catch {}
  }, 500);

  const BASE = `http://127.0.0.1:${API_PORT}/api/v1`;
  // wait for health
  let up = false;
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${API_PORT}/health`);
      if (res.ok) {
        up = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!up) {
    console.error('❌ API did not start. Log tail:');
    console.error(apiLog.slice(-3000));
    await db.stop();
    process.exit(1);
  }
  console.log('✅ API up');

  let failed = 0;
  let passed = 0;
  const check = (name, cond, extra = '') => {
    if (cond) {
      passed++;
      console.log(`  ✅ ${name}`);
    } else {
      failed++;
      console.log(`  ❌ ${name} ${extra}`);
    }
  };

  // Register + login a customer via OTP (console SMS driver logs the OTP)
  console.log('\n— Register + OTP login —');
  const phone = '09120000011';
  await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, fullName: 'تست اعلان', password: 'TestPass!123' }),
  }).then((r) => r.text());
  await new Promise((r) => setTimeout(r, 1500)); // let pino flush
  const otpLog = apiLog;
  // console SMS driver prints the code — extract the 6 digits after the phone number
  const otpMatch = apiLog.match(new RegExp(`OTP for ${phone}: (\\d{6})`));
  const otp = otpMatch ? otpMatch[1] : '000000';
  console.log('  OTP from log:', otp);

  const loginRes = await fetch(`${BASE}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code: otp, type: 'register' }),
  }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const accessToken = loginRes.body?.data?.accessToken;
  if (!accessToken) {
    console.error('❌ Login failed — API log tail:');
    console.error(apiLog.slice(-4000));
    api.kill('SIGTERM');
    await db.stop();
    process.exit(1);
  }
  check(
    'verify-otp returns accessToken',
    Boolean(accessToken),
    JSON.stringify(loginRes.body).slice(0, 300),
  );
  const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` };

  console.log('\n— Notification endpoints (11.3) —');
  // unread count (should be 0)
  let res = await fetch(`${BASE}/notifications/unread-count`, { headers: auth }).then((r) =>
    r.json(),
  );
  check(
    'GET /notifications/unread-count',
    res?.data?.count === 0 || res?.count === 0,
    JSON.stringify(res),
  );

  // list
  res = await fetch(`${BASE}/notifications?page=1&limit=10`, { headers: auth }).then((r) =>
    r.json(),
  );
  const listData = res?.data ?? res;
  check(
    'GET /notifications paginated',
    Array.isArray(listData?.items) && listData?.meta?.total === 0,
    JSON.stringify(res).slice(0, 200),
  );

  // preferences default view
  res = await fetch(`${BASE}/notifications/preferences`, { headers: auth }).then((r) => r.json());
  const prefs = res?.data ?? res;
  check(
    'GET /notifications/preferences grouped view',
    prefs?.requests?.inApp === true && prefs?.pushEnabled === true,
    JSON.stringify(prefs).slice(0, 200),
  );

  // update preferences
  res = await fetch(`${BASE}/notifications/preferences`, {
    method: 'PUT',
    headers: auth,
    body: JSON.stringify({
      wallet: { inApp: false, push: false, email: false, sms: false },
      pushEnabled: false,
    }),
  }).then((r) => r.json());
  const prefs2 = res?.data ?? res;
  check(
    'PUT /notifications/preferences',
    prefs2?.wallet?.inApp === false && prefs2?.pushEnabled === false,
    JSON.stringify(prefs2).slice(0, 200),
  );

  // read-all on empty
  res = await fetch(`${BASE}/notifications/read-all`, { method: 'POST', headers: auth }).then((r) =>
    r.json(),
  );
  check(
    'POST /notifications/read-all',
    (res?.data?.updated ?? res?.updated) === 0,
    JSON.stringify(res),
  );

  // mark non-existent → 404
  const nfRes = await fetch(`${BASE}/notifications/999999/read`, { method: 'POST', headers: auth });
  check(
    'POST /notifications/:id/read → 404 for unknown',
    nfRes.status === 404,
    String(nfRes.status),
  );

  // vapid public key endpoint
  res = await fetch(`${BASE}/notifications/vapid-public-key`, { headers: auth }).then((r) =>
    r.json(),
  );
  const vapid = res?.data ?? res;
  check(
    'GET /notifications/vapid-public-key',
    typeof vapid?.publicKey === 'string' && vapid.enabled === true,
    JSON.stringify(vapid),
  );

  console.log('\n— Push subscription endpoints (11.4.3/11.4.4) —');
  const endpoint = 'https://fcm.googleapis.com/fcm/send/e2e-test-endpoint-1';
  res = await fetch(`${BASE}/push/subscribe`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      endpoint,
      keys: {
        p256dh:
          'BNUHyoVBdaC8qO53IMdMFoFJp9EES9YBRLeIx_UKGmW6-nZK8BnkYLRtDhRRKZV6ywLAzCXisOMEAqgxpHDLfhc',
        auth: 'UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTfKc-ls',
      },
      userAgent: 'E2E',
      deviceType: 'desktop',
    }),
  }).then(async (r) => ({ status: r.status, body: await r.json() }));
  check(
    'POST /push/subscribe',
    res.status === 200 || res.status === 201,
    JSON.stringify(res.body).slice(0, 200),
  );

  // rotation — same endpoint again, updated keys
  res = await fetch(`${BASE}/push/subscribe`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      endpoint,
      keys: { p256dh: 'RotatedKeyP256dh', auth: 'RotatedAuth' },
      userAgent: 'E2E',
      deviceType: 'desktop',
    }),
  }).then((r) => r.status);
  check('POST /push/subscribe rotation (same endpoint)', res === 200 || res === 201, String(res));

  res = await fetch(`${BASE}/push/subscribe`, {
    method: 'DELETE',
    headers: auth,
    body: JSON.stringify({ endpoint }),
  }).then((r) => r.json());
  check('DELETE /push/subscribe', (res?.data?.removed ?? res?.removed) === 1, JSON.stringify(res));

  console.log('\n— Auto-fired notification (11.5.1: RequestCreated → operators) —');
  const { execSync: exec } = require('child_process');
  // 1) register a second user and promote them to operator via SQL
  const phoneOp = '09120000022';
  await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: phoneOp, password: 'TestPass!123' }),
  }).then((r) => r.text());
  const otpOp = (apiLog.match(new RegExp(`OTP for ${phoneOp}: (\\d{6})`)) || [])[1] || '000000';
  const opLogin = await fetch(`${BASE}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: phoneOp, code: otpOp, type: 'register' }),
  }).then((r) => r.json());
  const opToken = opLogin?.data?.accessToken;

  // promote via SQL using the API's own mysql2 package
  const M = require('mysql2/promise');
  const conn = await M.createConnection({
    host: '127.0.0.1',
    port: db.port,
    user: db.username,
    database: db.dbName,
  });
  const [rows] = await conn.query(
    "INSERT INTO user_roles (user_id, role_id) SELECT u.id, r.id FROM users u, roles r WHERE u.phone = ? AND r.name = 'operator'",
    [phoneOp],
  );
  void rows;

  // 2) register an admin and promote
  const phoneAdm = '09120000033';
  await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: phoneAdm, password: 'TestPass!123' }),
  }).then((r) => r.text());
  const otpAdm = (apiLog.match(new RegExp(`OTP for ${phoneAdm}: (\\d{6})`)) || [])[1] || '000000';
  await fetch(`${BASE}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: phoneAdm, code: otpAdm, type: 'register' }),
  }).then((r) => r.json());
  await conn.query(
    "INSERT INTO user_roles (user_id, role_id) SELECT u.id, r.id FROM users u, roles r WHERE u.phone = ? AND r.name = 'admin'",
    [phoneAdm],
  );
  await conn.end();

  // admin login → create service
  const admLogin = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: phoneAdm, password: 'TestPass!123' }),
  }).then((r) => r.json());
  const admToken = admLogin?.data?.accessToken;
  check('admin login with password', Boolean(admToken), JSON.stringify(admLogin).slice(0, 200));

  const cats = await fetch(`${BASE}/categories`).then((r) => r.json());
  const categoryId = cats?.data?.items?.[0]?.id ?? cats?.items?.[0]?.id;
  check('public categories list', Boolean(categoryId), JSON.stringify(cats).slice(0, 200));

  const svc = await fetch(`${BASE}/admin/services`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admToken}` },
    body: JSON.stringify({ name: 'خدمت تست اعلان', categoryId, laborFee: 50000 }),
  }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const serviceId = svc.body?.data?.id ?? svc.body?.id;
  check('admin creates service', Boolean(serviceId), JSON.stringify(svc.body).slice(0, 300));

  // customer creates a request → should auto-notify the operator (11.5.1)
  const reqRes = await fetch(`${BASE}/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ serviceId, description: 'درخواست تستی برای اعلان' }),
  }).then(async (r) => ({ status: r.status, body: await r.json() }));
  check(
    'customer creates request',
    reqRes.status === 200 || reqRes.status === 201,
    JSON.stringify(reqRes.body).slice(0, 300),
  );

  // operator should now have 1 unread notification
  const opNotifs = await fetch(`${BASE}/notifications?limit=10`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opToken}` },
  }).then((r) => r.json());
  const opItems = opNotifs?.data?.items ?? opNotifs?.items ?? [];
  const opUnread = opNotifs?.data?.meta?.unreadCount ?? opNotifs?.meta?.unreadCount ?? 0;
  check(
    'operator received request_created notification (11.5.1)',
    opItems.length >= 1 && opItems[0].type === 'request_created' && opUnread >= 1,
    JSON.stringify(opNotifs).slice(0, 400),
  );

  // mark it read via uuid/numeric id
  if (opItems.length > 0) {
    const nid = opItems[0].uuid ?? opItems[0].id;
    const rd = await fetch(`${BASE}/notifications/${nid}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opToken}` },
    }).then((r) => r.json());
    const rdItem = rd?.data ?? rd;
    check(
      'POST /notifications/:id/read marks read',
      Boolean(rdItem?.readAt),
      JSON.stringify(rd).slice(0, 200),
    );

    // delete it (11.3.5)
    const del = await fetch(`${BASE}/notifications/${nid}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opToken}` },
    }).then((r) => r.json());
    check('DELETE /notifications/:id', (del?.data?.ok ?? del?.ok) === true, JSON.stringify(del));
  }

  console.log(`\n🏁 E2E smoke: ${passed} passed, ${failed} failed`);
  api.kill('SIGTERM');
  await db.stop();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
