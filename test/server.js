const assert = require('node:assert/strict');
const { server } = require('../server');

async function run() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true, provider: 'espn-site-api' });
    assert.equal(health.headers.get('x-content-type-options'), 'nosniff');

    const vercelRewrite = await fetch(`${base}/api?__route=health`);
    assert.equal(vercelRewrite.status, 200);
    assert.deepEqual(await vercelRewrite.json(), { ok: true, provider: 'espn-site-api' });

    const badDate = await fetch(`${base}/api/scoreboard?date=not-a-date`);
    assert.equal(badDate.status, 400);
    const badSchedule = await fetch(`${base}/api/schedule?start=not-a-date`);
    assert.equal(badSchedule.status, 400);
    const tooWideSchedule = await fetch(`${base}/api/schedule?start=2026-10-20&days=30`);
    assert.equal(tooWideSchedule.status, 400);
    const shortSearch = await fetch(`${base}/api/search?q=a`);
    assert.equal(shortSearch.status, 400);
    assert.equal(shortSearch.headers.get('cache-control'), 'no-store');

    const home = await fetch(base);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /COURTSIDE/);
    assert.equal(home.headers.get('x-frame-options'), 'SAMEORIGIN');

    const logo = await fetch(`${base}/courtside.png`);
    assert.equal(logo.status, 200);
    assert.equal(logo.headers.get('content-type'), 'image/png');
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  console.log('✓ HTTP health, validation, security headers, and static serving verified');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
