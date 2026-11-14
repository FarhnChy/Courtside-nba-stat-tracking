const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const espn = require('../lib/espn');
const finance = require('../lib/finance');
const { requestHandler } = require('../server');
const { createFantasy, secret } = require('../lib/fantasy');

async function run() {
  const originalFetch = global.fetch, originalNow = Date.now;
  let time = originalNow(), offline = false, mismatch = false;
  const optionalRequests = [];
  const date = '2026-11-02';
  const board = { day: { date }, events: [] };
  Date.now = () => time;
  global.fetch = async (url, options) => {
    if (offline) throw new Error('Offline fixture');
    if (url.includes('cdn.espn.com')) return Response.json({ content: { sbData: mismatch ? { ...board, events: [{ id: 'missing-game' }] } : board } });
    if (url.includes('/scoreboard')) return Response.json(board);
    if (url.includes('/injuries')) return Response.json({ injuries: [] });
    if (url.includes('/summary')) return Response.json({});
    if (url.includes('free-agent-tracker')) return new Response('<script id="__NEXT_DATA__" type="application/json">' + JSON.stringify({ props: { pageProps: { players: [
      { playerId: 999, playerDisplayName: 'Matched Player' },
      { playerId: 42, playerDisplayName: 'Unmatched Player' }
    ] } } }) + '</script>');
    if (url.includes('/teams?')) return Response.json({ sports: [{ leagues: [{ teams: [{ team: { id: '1', abbreviation: 'BOS' } }] }] }] });
    if (url.includes('/roster')) return Response.json({ team: { id: '1', abbreviation: 'BOS' }, athletes: [{ id: '42', displayName: 'Matched Player' }] });
    if (url.includes('stats.nba.com')) {
      optionalRequests.push(options.signal);
      return Response.json({ resultSets: [{ name: 'Coaches', headers: [], rowSet: [] }] });
    }
    if (url.includes('/coaches/')) { optionalRequests.push(options.signal); throw new Error('Optional source unavailable'); }
    throw new Error(`Unexpected fixture URL: ${url}`);
  };
  try {
    assert.equal((await espn.scoreboard(date, { verify: true })).coverageComplete, true, 'confirmed off days are valid');
    mismatch = true;
    await assert.rejects(espn.scoreboard(date, { verify: true }), /coverage/, 'disagreeing feeds must not finalize a day');
    mismatch = false;
    await espn.injuries(); await espn.summary('123456789');
    const market = await finance.freeAgents();
    assert.equal(market.players[0].espnId, '42');
    assert.equal(market.players[1].espnId, null, 'an equal number in another namespace is not an identity match');
    time += 1000;
    assert.equal((await finance.freeAgents()).retrievedAt, market.retrievedAt, 'cached finance data retains its original fetch time');
    assert.equal((await espn.roster('1')).players[0].name, 'Matched Player');
    assert.equal(optionalRequests.length, 2);
    assert.ok(optionalRequests.every(signal => signal instanceof AbortSignal), 'optional enrichment must have deadlines');
    offline = true; time += 3600001;
    await assert.rejects(espn.scoreboard(date), /Offline/);
    await assert.rejects(espn.injuries(), /Offline/);
    await assert.rejects(espn.summary('123456789'), /Offline/);
    await assert.rejects(finance.freeAgents(), /Offline/, 'expired finance data must not get a fresh timestamp');
  } finally { global.fetch = originalFetch; Date.now = originalNow; }

  const response = { writeHead(status, headers) { this.status = status; this.headers = headers; }, end(body) { this.body = body; } };
  await requestHandler({ url: '/%zz' }, response);
  assert.equal(response.status, 400);
  const previousSummary = espn.summary;
  espn.summary = async () => ({ game: {} });
  try {
    await requestHandler({ url: '/api/games/123456789' }, response);
    assert.equal(response.headers['Cache-Control'], 'no-store', 'game summaries must bypass the CDN cache');
  } finally { espn.summary = previousSummary; }

  const documents = new Map();
  const store = { mode: 'memory', read: async id => structuredClone(documents.get(id) || null), update: async (id, change) => {
    const value = change(structuredClone(documents.get(id) || null)); documents.set(id, structuredClone(value)); return value;
  } };
  let now = new Date('2026-11-01T17:00:00Z'), confirmed = false, games = [], finalSummary = false, bothTeams = false;
  const section = id => ({ labels: ['PTS', 'REB', 'AST', 'STL', 'BLK', 'TO'], athletes: [{ id, stats: ['10', '0', '0', '0', '0', '0'] }] });
  const fantasy = createFantasy({ store, clock: () => now, catalogLoader: async () => Array.from({ length: 4 }, (_, i) => ({ id: String(i), name: `Player ${i}` })),
    provider: { scoreboard: async (_, options) => { assert.equal(options.verify, true); return { coverageComplete: confirmed, games }; },
      summary: async () => ({ game: { status: { completed: finalSummary } }, boxscore: [
        { team: { id: 'A' }, sections: [section('0')] }, ...(bothTeams ? [{ team: { id: 'B' }, sections: [section('1')] }] : [])
      ] }) } });
  const keys = [secret(), secret()];
  let league = await fantasy.create({ name: 'Reliability', teamName: 'Alpha', rosterSize: 2, starters: 1 }, keys[0]);
  league = await fantasy.join(league.id, { teamName: 'Beta' }, keys[1]);
  const keyFor = Object.fromEntries(league.teams.map((team, i) => [team.id, keys[i]]));
  league = await fantasy.action(league.id, keys[0], { action: 'start' });
  for (let i = 0; i < 4; i++) league = await fantasy.action(league.id, keyFor[league.nextTeam], { action: 'pick', playerId: String(i), pickNumber: i });
  now = new Date('2026-11-03T17:00:00Z');
  await fantasy.sync(league.id, keys[0]);
  assert.deepEqual((await store.read(league.id)).scores, {}, 'unconfirmed empty feeds cannot save zero scores');
  confirmed = true;
  await fantasy.sync(league.id, keys[0]);
  assert.equal((await store.read(league.id)).scores['2026-11-02'].complete, true);
  games = [{ id: '123456789', away: { id: 'A' }, home: { id: 'B' }, status: { state: 'post', completed: true } }];
  now = new Date(+now + 61000);
  league = await fantasy.sync(league.id, keys[0]);
  assert.ok(league.sync.errors.length, 'a one-sided box score is incomplete');
  bothTeams = true;
  now = new Date(+now + 61000);
  league = await fantasy.sync(league.id, keys[0]);
  assert.ok(league.sync.errors.length, 'a completed scoreboard with a live summary is not final');
  finalSummary = true;
  now = new Date(+now + 61000);
  league = await fantasy.sync(league.id, keys[0]);
  assert.equal(league.sync.errors.length, 0);
  assert.equal(Object.values((await store.read(league.id)).scores['2026-11-02'].totals).reduce((a, b) => a + b, 0), 20);

  const app = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  const profileNode = { innerHTML: '', showModal() {} }, fetched = [];
  const context = vm.createContext({ document: { querySelector: () => profileNode }, playerProfileHeader: () => '', profileFallbackStats: () => 'fallback',
    renderAwards: () => '', rosterState: {}, fetchApi: async url => { fetched.push(url); return { ok: true, json: async () => ({ history: [] }) }; } });
  vm.runInContext(app.slice(app.indexOf('async function openPlayerProfile('), app.indexOf("document.querySelector('#closePlayerDialog')")), context);
  await context.openPlayerProfile('42', { name: 'Unmatched', idProvider: 'nba', espnId: null });
  assert.deepEqual(fetched, []);
  await context.openPlayerProfile('999', { name: 'Matched', idProvider: 'nba', espnId: '42' });
  assert.deepEqual(fetched, ['/api/players/42']);

  const fantasySource = fs.readFileSync(path.join(__dirname, '../public/fantasy.js'), 'utf8');
  const manager = { id: 'manager', roster: ['a', 'b'], ir: [], todayLineup: ['a'], nextLineup: ['a'] };
  const content = { innerHTML: '', insertAdjacentHTML(_, html) { this.innerHTML += html; } };
  const renderContext = vm.createContext({ signature: '', html: String, heading() {}, activity: () => '', advancedPanels: () => '',
    renderPool() {}, updateScores() {}, me: () => manager, player: id => ({ name: id }), $: () => content,
    league: { id: 'league', me: manager.id, status: 'active', picks: [], teams: [manager], matchup: { week: 1 }, rules: {}, nextDate: '2026-11-04' } });
  vm.runInContext(fantasySource.slice(fantasySource.indexOf('  function render()'), fantasySource.indexOf('  function updateScores()')), renderContext);
  renderContext.render();
  assert.match(content.innerHTML, /value="a" checked/);
  manager.nextLineup = ['b'];
  renderContext.render();
  assert.match(content.innerHTML, /value="b" checked/, 'remote lineup changes must update the visible controls');
  assert.doesNotMatch(content.innerHTML, /value="a" checked/);
  console.log('✓ Feed completeness, expired caches, identity namespaces, HTTP errors, summary caching, and remote lineups verified');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
