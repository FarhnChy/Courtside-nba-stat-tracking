const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const textFiles = ['public/index.html','public/app.js','public/live.css','lib/espn.js','lib/finance.js','server.js'];
for (const file of textFiles) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  for (const marker of ['\u00c2\u00b7','\u00e2\u20ac\u201d','\u00e2\u20ac\u201c','\u00e2\u20ac\u00a6','\u00c3\u2014']) assert.equal(source.includes(marker), false, `${file} should not contain mojibake`);
}
for (const file of ['public/index.html', 'public/styles.css', 'public/app.js', 'public/courtside-logo.webp']) {
  assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
}

const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
assert.equal(html.includes('>FM</button>'), false, 'account placeholder should not display developer initials');
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
assert.equal(typeof adapter.normalizePlayerHistory, 'function');
for (const route of ['/api/teams', '/api/injuries']) assert.equal(serverSource.includes(route), true, `server should expose ${route}`);
assert.equal(serverSource.includes('playerMatch'), true, 'server should expose player profiles');
assert.equal(typeof adapter.normalizeTransactions, 'function');
assert.equal(serverSource.includes('/api/transactions'), true, 'server should expose transactions');
assert.equal(serverSource.includes('transactionsWithRosterReconciliation'), true, 'moves should reconcile stale transactions with current rosters');
assert.equal(serverSource.includes('offseasonContracts'), true, 'moves should include reported offseason contract terms');
const offseasonContracts = require('../data/offseasonContracts');
assert.equal(offseasonContracts.some(move => move.player === 'LeBron James' && move.contract.value === 8000000), true, 'reported contracts should retain structured terms');
const offseasonTrades = require('../data/offseasonTrades');
assert.equal(offseasonTrades.some(move => move.player.name === 'Giannis Antetokounmpo'), true, 'confirmed trades should retain structured player data');
assert.equal(serverSource.includes('/api/finance/cap'), true, 'server should expose official cap thresholds');
const finance = require('../lib/finance');
assert.equal(finance.capOverview('2026-27').cap, 164961000);
assert.equal(typeof finance.payrolls, 'function');
assert.equal(typeof finance.teamContracts, 'function');
assert.equal(typeof finance.freeAgents, 'function');
const offseasonFreeAgents = require('../data/offseasonFreeAgents');
assert.deepEqual(offseasonFreeAgents.map(player => player.name), ['DeMar DeRozan', 'Russell Westbrook']);
assert.equal(typeof finance.capHolds, 'function');
assert.equal(serverSource.includes('/api/free-agents'), true, 'server should expose official free agents');
assert.equal(serverSource.includes('cap-holds'), true, 'server should expose team cap holds');
const appSource = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
assert.equal(appSource.includes('viewRoutes'), true, 'primary screens should have shareable routes');
assert.equal(appSource.includes('.box-player[data-player-id]'), true, 'box-score players should open profiles');
assert.equal(appSource.includes('selectScoreDate'), true, 'scoreboard dates should be directly selectable');
assert.equal(appSource.includes('player.headshot'), true, 'game leaders should render available player photos');
assert.equal(appSource.includes('NBA season history'), true, 'player profiles should include career season tables');
assert.equal(appSource.includes('Career accolades'), true, 'player profiles should include awards and honors');
assert.equal(appSource.includes("picker.showPicker()"), true, 'calendar button should explicitly open one date picker');
assert.equal(appSource.includes('win-arrow'), false, 'final score cards should not use a winner arrow');
assert.equal(appSource.includes('winning-score'), true, 'final game details should emphasize the winning score');
assert.equal(appSource.includes('data-standing-team'), true, 'standings teams should open their roster');
assert.equal(appSource.includes('data-leader-id'), true, 'game leaders should open player profiles');
assert.equal(appSource.includes('real-team-logo'), true, 'score cards should use provider team logos');
assert.equal(appSource.includes('move-contract'), true, 'transaction cards should render contract terms');
assert.equal(appSource.includes('data-score-team'), true, 'score-card logos should open team rosters');
assert.equal(appSource.includes('data-summary-team'), true, 'expanded game logos should open team rosters');
assert.equal(html.includes('data-roster-mode="coaches"'), true, 'team pages should offer a coaching staff view');
assert.equal(appSource.includes('coaching-grid'), true, 'team pages should render coaching staff cards');
assert.equal(html.includes('id="calendarDate"'), true, 'date strip should include a calendar picker');
assert.equal(html.includes('Boston Celtics'), false, 'published playoff UI should not hard-code Boston as the favorite');

console.log('✓ App shell, assets, and core product surfaces verified');
