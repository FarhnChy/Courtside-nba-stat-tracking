const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
for (const file of ['public/index.html', 'public/styles.css', 'public/app.js', 'public/courtside-logo.webp']) {
  assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
}

const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
for (const label of ['Scores', 'Standings', 'Predict', 'Futures', 'gameCenter']) {
  assert.match(html, new RegExp(label), `app should include ${label}`);
}

const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
assert.equal(serverSource.includes('/api/scoreboard'), true, 'server should expose the live scoreboard adapter');
assert.equal(serverSource.includes('gameMatch'), true, 'server should expose game summaries');
const adapter = require('../lib/espn');
assert.equal(typeof adapter.normalizeSummary, 'function');
assert.equal(typeof adapter.normalizeStandings, 'function');
assert.equal(serverSource.includes('/api/standings'), true, 'server should expose live standings');
for (const method of ['normalizeTeams', 'normalizeRoster', 'normalizeInjuries']) assert.equal(typeof adapter[method], 'function');
for (const route of ['/api/teams', '/api/injuries']) assert.equal(serverSource.includes(route), true, `server should expose ${route}`);
assert.equal(serverSource.includes('playerMatch'), true, 'server should expose player profiles');
assert.equal(typeof adapter.normalizeTransactions, 'function');
assert.equal(serverSource.includes('/api/transactions'), true, 'server should expose transactions');
assert.equal(serverSource.includes('/api/finance/cap'), true, 'server should expose official cap thresholds');
const finance = require('../lib/finance');
assert.equal(finance.capOverview('2026-27').cap, 164961000);
assert.equal(typeof finance.payrolls, 'function');
assert.equal(typeof finance.teamContracts, 'function');
assert.equal(typeof finance.freeAgents, 'function');
assert.equal(typeof finance.capHolds, 'function');
assert.equal(serverSource.includes('/api/free-agents'), true, 'server should expose official free agents');
assert.equal(serverSource.includes('cap-holds'), true, 'server should expose team cap holds');
const appSource = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
assert.equal(appSource.includes('viewRoutes'), true, 'primary screens should have shareable routes');
assert.equal(appSource.includes('.box-player[data-player-id]'), true, 'box-score players should open profiles');

console.log('✓ App shell, assets, and core product surfaces verified');
