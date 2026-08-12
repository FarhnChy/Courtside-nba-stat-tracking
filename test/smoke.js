const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const textFiles = ['public/index.html','public/app.js','public/live.css','lib/espn.js','lib/finance.js','server.js'];
for (const file of textFiles) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  for (const marker of ['\u00c2\u00b7','\u00e2\u20ac\u201d','\u00e2\u20ac\u201c','\u00e2\u20ac\u00a6','\u00c3\u2014']) assert.equal(source.includes(marker), false, `${file} should not contain mojibake`);
}
for (const file of ['public/index.html', 'public/styles.css', 'public/app.js', 'public/courtside.png']) {
  assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
}

const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
assert.equal(html.includes('>FM</button>'), false, 'account placeholder should not display developer initials');
for (const id of ['userHubButton','brandAccountImage','brandAccountFallback','userHubDialog','favoriteTeam','profileImageInput']) assert.equal(html.includes(`id="${id}"`), true, `user hub should include ${id}`);
for (const id of ['fantasyHubButton','fantasyDialog','fantasyForm']) assert.equal(html.includes(`id="${id}"`), true, `fantasy hub should include ${id}`);
for (const label of ['Scores', 'Schedule', 'Standings', 'Futures', 'gameCenter']) {
  assert.match(html, new RegExp(label), `app should include ${label}`);
}
assert.equal(html.includes('id="predict"'), true, 'app should still include the playoff predictor view');
assert.equal(html.includes('id="openBracketTool"'), true, 'profile should open the playoff predictor');

const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
assert.equal(serverSource.includes('/api/scoreboard'), true, 'server should expose the live scoreboard adapter');
assert.equal(serverSource.includes('/api/schedule'), true, 'server should expose schedule windows for calendar markers');
assert.equal(serverSource.includes('gameMatch'), true, 'server should expose game summaries');
const adapter = require('../lib/espn');
assert.equal(typeof adapter.normalizeSummary, 'function');
assert.equal(typeof adapter.normalizeStandings, 'function');
assert.equal(typeof adapter.scheduleWindow, 'function');
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
assert.equal(fs.readFileSync(path.join(root, 'lib/finance.js'), 'utf8').includes('reportedTeamFromLabel'), true, 'free-agent signings should prefer reported team labels over stale tracker abbreviations');
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
for (const feature of ['loadScheduleWindow','scheduleMarker','/api/schedule?start=']) assert.equal(appSource.includes(feature), true, `calendar should include ${feature}`);
for (const feature of ['loadScheduleHub','scheduleStatusLabel','schedule-date-jump','scheduleView']) assert.equal(appSource.includes(feature) || html.includes(feature), true, `schedule hub should include ${feature}`);
assert.equal(appSource.includes('win-arrow'), false, 'final score cards should not use a winner arrow');
assert.equal(appSource.includes('winning-score'), true, 'final game details should emphasize the winning score');
assert.equal(appSource.includes("localStorage.getItem('courtsideHub')"), true, 'user hub preferences should persist locally');
assert.equal(appSource.includes('applyTheme'), true, 'user hub should support theme selection');
assert.equal(appSource.includes('profileImage'), true, 'user hub should support custom account pictures');
assert.equal(appSource.includes('#fantasyHubButton'), true, 'fantasy should open from the top bar');
assert.equal(appSource.includes('data-standing-team'), true, 'standings teams should open their roster');
assert.equal(appSource.includes('data-leader-id'), true, 'game leaders should open player profiles');
assert.equal(appSource.includes('real-team-logo'), true, 'score cards should use provider team logos');
assert.equal(appSource.includes('move-contract'), true, 'transaction cards should render contract terms');
assert.equal(appSource.includes('data-score-team'), true, 'score-card logos should open team rosters');
assert.equal(appSource.includes('data-summary-team'), true, 'expanded game logos should open team rosters');
assert.equal(appSource.includes('data-free-agent-id'), true, 'free-agent players should open detailed profiles');
assert.equal(appSource.includes('profileFallbackStats'), true, 'free-agent profiles should fall back to tracker stats');
assert.equal(appSource.includes('injury-toggle'), true, 'injury cards should expose compact expandable details');
assert.equal(appSource.includes('playoff-bracket-layout'), true, 'custom bracket should show East and West around the Finals');
assert.equal(appSource.includes('round-connector'), true, 'custom bracket should render real bracket connector lines');
assert.equal(appSource.includes('id="contractSeason"'), true, 'team finances should allow contract-season selection');
assert.equal(appSource.includes('I want to see projected cap holds'), true, 'cap holds should remain optional until requested');
for (const feature of ['renderFavoriteDashboard','renderTeamDashboard','comparisonState','openTransactionDetail','best-available-rank','fetchApi']) assert.equal(appSource.includes(feature), true, `app should include ${feature}`);
for (const feature of ['loadingState','errorState','data-clear-free-agents','data-empty-view']) assert.equal(appSource.includes(feature), true, `loading and empty states should include ${feature}`);
for (const feature of ['bracketState','conferenceBracket','7–8 game','9–10 game','For No. 8 seed','nba-final']) assert.equal(appSource.includes(feature), true, `custom playoff bracket should include ${feature}`);
assert.equal(html.includes('data-predict-mode="custom"'), true, 'predictor should offer a saved custom bracket mode');
assert.equal(serverSource.includes('/api/search'), true, 'server should expose global player and team search');
for (const id of ['searchDialog','favoriteDashboard','comparisonDialog','transactionDialog','freeAgentSort']) assert.equal(html.includes(`id="${id}"`), true, `app shell should include ${id}`);
assert.equal(html.includes('data-roster-mode="coaches"'), true, 'team pages should offer a coaching staff view');
assert.equal(appSource.includes('coaching-grid'), true, 'team pages should render coaching staff cards');
assert.equal(html.includes('id="calendarDate"'), true, 'date strip should include a calendar picker');
assert.equal(html.includes('brand-logo-image'), true, 'Courtside image logo should be the home link separate from account picture');
assert.equal(html.includes('brand-word'), false, 'topbar should not render a Courtside text wordmark');
assert.equal(html.includes('AWARDS & SEED RACE'), true, 'futures tab should present awards and seed races');
for (const feature of ['awardRaces','seedChanceRows','upcomingScheduleEdge','No. 1 seed chances','Model board, not betting odds']) assert.equal(appSource.includes(feature), true, `race center should include ${feature}`);
assert.equal(html.includes('Boston Celtics'), false, 'published playoff UI should not hard-code Boston as the favorite');

console.log('✓ App shell, assets, and core product surfaces verified');
