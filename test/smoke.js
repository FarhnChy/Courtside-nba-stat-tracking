const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.join(__dirname, '..');

for (const file of [
  'public/index.html',
  'public/styles.css',
  'public/app.js',
  'data/demoData.js',
  'data/manualOverrides.js',
  'providers/provider.js',
  'providers/demoProvider.js',
  'providers/espnProvider.js',
  'providers/balldontlieProvider.js',
  'providers/overrides.js',
  '.env.example'
]) {
  assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
}

const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
for (const label of ['Scores', 'Standings', 'Moves', 'Predict', 'Futures', 'gameCenter', 'transactionBoard']) {
  assert.match(html, new RegExp(label), `app should include ${label}`);
}

const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
assert.match(app, /\/api\/bootstrap\?date=/, 'frontend should load data from the API');
assert.match(app, /\/api\/games\?date=/, 'frontend should refetch games by selected date');
assert.match(app, /renderError/, 'frontend should handle API errors');

async function startServer(port, env = {}) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, ...env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server did not start in time')), 5000);
    child.stdout.on('data', (chunk) => {
      if (chunk.toString().includes(`http://localhost:${port}`)) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.stderr.on('data', (chunk) => {
      clearTimeout(timer);
      reject(new Error(chunk.toString()));
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`server exited with code ${code}`));
    });
  });

  return child;
}

async function getJson(baseUrl, route) {
  const response = await fetch(`${baseUrl}${route}`, { headers: { Accept: 'application/json' } });
  assert.equal(response.headers.get('content-type').includes('application/json'), true, `${route} should return JSON`);
  return { response, body: await response.json() };
}

(async () => {
  const port = 37100 + Math.floor(Math.random() * 1000);
  const baseUrl = `http://localhost:${port}`;
  const server = await startServer(port, { NBA_DATA_PROVIDER: 'demo' });

  try {
    const health = await getJson(baseUrl, '/api/health');
    assert.equal(health.response.status, 200);
    assert.equal(health.body.ok, true);
    assert.equal(health.body.configuredProvider, 'demo');

    const bootstrap = await getJson(baseUrl, '/api/bootstrap');
    assert.equal(bootstrap.response.status, 200);
    assert.equal(bootstrap.body.meta.source, 'demo');
    assert.equal(Object.keys(bootstrap.body.teams).length >= 12, true);
    assert.equal(bootstrap.body.games.length >= 3, true);
    assert.equal(bootstrap.body.meta.manualOverrides.injuries >= 1, true);
    assert.equal(Array.isArray(bootstrap.body.standings.East), true);
    assert.equal(Array.isArray(bootstrap.body.futures), true);
    assert.equal(Array.isArray(bootstrap.body.transactions), true);
    assert.equal(bootstrap.body.transactions.some((move) => move.team === 'DEN' && /Spencer Jones/.test(move.text)), true);

    const datedGames = await getJson(baseUrl, '/api/games?date=2026-02-20');
    assert.equal(datedGames.response.status, 200);
    assert.equal(datedGames.body.games.length >= 3, true);

    const teams = await getJson(baseUrl, '/api/teams');
    assert.equal(teams.response.status, 200);
    assert.equal(Object.keys(teams.body.teams).length >= 12, true);

    const players = await getJson(baseUrl, '/api/players?search=tatum');
    assert.equal(players.response.status, 200);
    assert.equal(Array.isArray(players.body.players), true);
    assert.equal(players.body.players.length >= 1, true);

    const injuries = await getJson(baseUrl, '/api/injuries?team=BOS');
    assert.equal(injuries.response.status, 200);
    assert.equal(Array.isArray(injuries.body.injuries), true);
    assert.equal(injuries.body.injuries.some((injury) => injury.team === 'BOS'), true);

    const game = await getJson(baseUrl, `/api/games/${bootstrap.body.games[0].id}`);
    assert.equal(game.response.status, 200);
    assert.equal(game.body.game.id, bootstrap.body.games[0].id);
    assert.equal(game.body.game.injuries.length >= 1, true);

    const missing = await getJson(baseUrl, '/api/games/not-real');
    assert.equal(missing.response.status, 404);
    assert.equal(missing.body.error, 'game_not_found');

    const transactions = await getJson(baseUrl, '/api/transactions');
    assert.equal(transactions.response.status, 200);
    assert.equal(Array.isArray(transactions.body.transactions), true);
    assert.equal(transactions.body.transactions.length >= 1, true);

    const nuggetsTransactions = await getJson(baseUrl, '/api/transactions?team=DEN');
    assert.equal(nuggetsTransactions.response.status, 200);
    assert.equal(nuggetsTransactions.body.transactions.every((move) => move.team === 'DEN'), true);
    assert.equal(nuggetsTransactions.body.transactions.some((move) => /Spencer Jones/.test(move.text)), true);

    const coaches = await getJson(baseUrl, '/api/coaches');
    assert.equal(coaches.response.status, 200);
    assert.equal(Array.isArray(coaches.body.coaches), true);

    const page = await fetch(baseUrl);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Courtside - NBA scores/);
  } finally {
    server.kill();
  }

  const fallbackPort = port + 1;
  const fallbackBaseUrl = `http://localhost:${fallbackPort}`;
  const fallbackServer = await startServer(fallbackPort, {
    NBA_DATA_PROVIDER: 'balldontlie',
    BALLDONTLIE_API_KEY: ''
  });

  try {
    const health = await getJson(fallbackBaseUrl, '/api/health');
    assert.equal(health.response.status, 200);
    assert.equal(health.body.configuredProvider, 'balldontlie');
    assert.equal(health.body.hasApiKey, false);

    const bootstrap = await getJson(fallbackBaseUrl, '/api/bootstrap');
    assert.equal(bootstrap.response.status, 200);
    assert.equal(bootstrap.body.meta.configuredProvider, 'balldontlie');
    assert.equal(bootstrap.body.meta.fallbackReason, 'missing_api_key');
    assert.equal(bootstrap.body.games.length >= 3, true);
  } finally {
    fallbackServer.kill();
  }

  const espnPort = port + 2;
  const espnBaseUrl = `http://localhost:${espnPort}`;
  const espnServer = await startServer(espnPort, { NBA_DATA_PROVIDER: 'espn' });

  try {
    const health = await getJson(espnBaseUrl, '/api/health');
    assert.equal(health.response.status, 200);
    assert.equal(health.body.configuredProvider, 'espn');
    assert.equal(health.body.requiresApiKey, false);
  } finally {
    espnServer.kill();
  }

  console.log('OK App shell, API routes, and provider-shaped demo data verified');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
