const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { TEAMS, MOVEMENT_URL, normalizeMovement, normalizeAnnouncements, announcements, mergeMoves, moveType, contractType, createMoveFeed } = require('../lib/nba-moves');
const espn = require('../lib/espn');

async function run() {
  const knicks = TEAMS.find(team => team.slug === 'knicks');
  const since = '2026-01-01';
  const rawMove = { Transaction_Type: 'Waive', TRANSACTION_DATE: '2026-09-30T00:00:00', TRANSACTION_DESCRIPTION: 'New York Knicks waived guard John Konchar.', TEAM_ID: knicks.nbaId, PLAYER_ID: 1629723, PLAYER_SLUG: 'john-konchar', GroupSort: 'Waive 123' };
  const nba = { NBA_Player_Movement: { rows: [rawMove, { ...rawMove, TRANSACTION_DATE: '2025-01-01T00:00:00' }] } };
  const rows = normalizeMovement(nba, since);
  assert.equal(rows.length, 1); assert.equal(rows[0].team.id, '18'); assert.equal(rows[0].verification.status, 'official');
  assert.equal(rows[0].date, '2026-09-30T12:00:00Z'); assert.equal(rows[0].dateOnly, true);
  assert.throws(() => normalizeMovement({}, since), /shape/);
  assert.equal(moveType('Assigned a player signed earlier to the G League.'), 'Assigned');
  assert.equal(moveType('Claimed John Doe off waivers.'), 'Claimed off waivers');
  assert.equal(moveType('Converted a two-way contract.'), 'Converted');
  assert.equal(contractType('Signed a player to an Exhibit 9 contract.'), 'Exhibit 9');
  assert.equal(contractType('Signed a player to an Exhibit 10 contract.'), 'Exhibit 10');
  assert.equal(contractType('Signed a player to a two-way contract.'), 'Two-way');
  assert.equal(contractType('Signed a player to a 10-day contract.'), '10-day');
  const posts = ['BRUCE BROWN','JAMES WISEMAN','UNLISTED CAMP PLAYER'].map((name, i) => ({ type: 'article', id: i + 1, title: `NEW YORK KNICKS SIGN ${name} TO AN EXHIBIT 9 CONTRACT`, date: '2026-09-16T17:40:00Z', permalink: `https://www.nba.com/knicks/news/sign-${i}` }));
  const official = normalizeAnnouncements([...posts, { ...posts[0], id: 5, title: 'Knicks Sign Partnership With Sponsor' }, { ...posts[0], id: 6, title: 'Could Knicks Sign A New Center?' }, { ...posts[0], id: 7, permalink: 'javascript:alert(1)' }, { ...posts[0], id: 8, date: '2025-01-01' }], knicks, since);
  assert.equal(official.length, 3, 'camp signings survive without a free-agent match or player taxonomy');
  assert.equal(official[0].player, null); assert.equal(official[0].contractType, 'Exhibit 9');
  assert.equal(official[0].contract, undefined, 'do not invent guarantees or salary amounts');
  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { pageObject: { posts: [...posts, ...posts] } } } })}</script>`;
  assert.equal(announcements(html, knicks, since).length, 3, 'repeated page components do not duplicate moves');
  const sign = { ...rows[0], id: 'signed-konchar', type: 'Signed' };
  const otherTeam = { ...rows[0], id: 'other-team', team: TEAMS[0] };
  const earlierTrade = { ...rows[0], id: 'old-trade', type: 'Trade', date: '2026-08-01T12:00:00Z' };
  const laterTrade = { ...earlierTrade, id: 'new-trade', date: '2026-09-01T12:00:00Z' };
  assert.equal(mergeMoves([...rows, ...rows, sign, otherTeam, earlierTrade, laterTrade]).length, 5, 'keep a signing, waiver, another team, and distinct trades for the same player');
  const grouped = { ...sign, id: 'grouped-signings', eventKey: 'Signed John Konchar and Another Prospect.', description: 'Signed John Konchar and Another Prospect.' };
  assert.equal(mergeMoves([sign, grouped]).length, 2, 'a matching player must not discard a grouped transaction containing another player');
  const rawEspn = { date: '2026-09-16', description: 'Signed F Small Prospect to an Exhibit 10 deal.', team: { id: '18', abbreviation: 'NY' } };
  const firstId = espn.normalizeTransactions({ transactions: [rawEspn] }).transactions[0].id;
  assert.equal(espn.normalizeTransactions({ transactions: [{ ...rawEspn, description: 'Another move' }, rawEspn] }).transactions[1].id, firstId, 'IDs do not depend on upstream position');

  let now = new Date('2026-10-02T12:00:00Z'); let offline = false, publish = true, calls = 0; let saved;
  const archive = { available: true, mode: 'test', update: async (_id, change) => { saved = change(saved); return saved; } };
  const fetcher = async url => {
    calls++;
    if (offline) throw new Error('offline');
    if (url === MOVEMENT_URL) return new Response(JSON.stringify(nba));
    assert.ok(url.includes('content-api-prod.nba.com'), 'use the public team feed, including custom team sites');
    return new Response(JSON.stringify({ results: { items: publish ? posts : [] } }));
  };
  const feed = createMoveFeed({ teams: [knicks], fetcher, archive, clock: () => now });
  const [a, b] = await Promise.all([feed.load(), feed.load()]);
  assert.equal(calls, 2, 'overlapping calls share the same source requests'); assert.deepEqual(a, b);
  assert.equal(a.coverage.teamFeedsFresh, 1); assert.equal(a.transactions.length, 4);
  offline = true; now = new Date('2026-10-02T12:06:00Z');
  const stale = await feed.load(); assert.equal(stale.stale, true); assert.deepEqual(stale.coverage.failedTeams, ['NY']);
  assert.equal(stale.transactions.length, 4, 'failed feeds retain known moves');
  assert.equal(stale.coverage.officialFeedCheckedAt, a.coverage.officialFeedCheckedAt, 'failed checks do not relabel stale data as fresh');
  offline = false; publish = false; now = new Date('2026-10-02T12:12:00Z');
  const restarted = createMoveFeed({ teams: [knicks], fetcher, archive, clock: () => now });
  assert.equal((await restarted.load()).transactions.length, 4, 'collected announcements survive leaving the latest-news window and restarting');

  // Verify the browser searches the full data, not just the first visible page,
  // and retains filters while refreshing.
  const nodes = new Map();
  function node(id) { if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', value: 'all', classList: { contains: () => true } }); return nodes.get(id); }
  const data = Array.from({ length: 105 }, (_, i) => ({ ...official[0], id: String(i), description: `Knicks signed player ${i}`, team: knicks }));
  data.push({ ...official[1], id: 'wiseman', description: 'Knicks signed James Wiseman to an Exhibit 9 contract.' });
  const context = vm.createContext({
    document: { hidden: false, querySelector: node, querySelectorAll: () => [] }, window: {}, setInterval: () => {}, Date, Set, Map,
    escapeHtml: String, loadingState: () => '', errorState: () => '', money: String, openTransactionDetail: () => {},
    fetchApi: async () => ({ ok: true, headers: { get: () => null }, json: async () => ({ transactions: data, coverage: a.coverage }) })
  });
  const source = fs.readFileSync(require('node:path').join(__dirname, '../public/app.js'), 'utf8');
  vm.runInContext(source.slice(source.indexOf('const transactionState ='), source.indexOf('const money =')), context);
  await new Promise(resolve => setImmediate(resolve));
  vm.runInContext("transactionState.team = '18'; transactionState.contract = 'Exhibit 9'; transactionState.query = 'wiseman'; renderTransactions()", context);
  assert.match(node('#transactionList').innerHTML, /James Wiseman/);
  assert.match(node('#transactionList').innerHTML, /roster spot not assured/);
  await context.loadTransactions(true);
  assert.equal(node('#transactionTeam').value, '18'); assert.equal(node('#transactionContract').value, 'Exhibit 9');
  assert.match(node('#transactionCoverage').textContent, /1\/1 team announcement feeds/);

  // ESPN pagination must collect more than the first page of transactions.
  const originalFetch = global.fetch; const urls = [];
  global.fetch = async url => {
    urls.push(url);
    return new Response(JSON.stringify({ pageIndex: url.includes('page=2') ? 2 : 1, pageCount: 2, transactions: [{ ...rawEspn, description: url.includes('page=2') ? 'Waived F Other Prospect.' : rawEspn.description }] }));
  };
  try { const pages = await espn.transactions(); assert.equal(pages.transactions.length, 2); assert.equal(pages.coverageComplete, true); assert.equal(urls.length, 2); }
  finally { global.fetch = originalFetch; }
  console.log('✓ Minor roster moves, official announcements, all-team coverage, source failures, archive retention, pagination, stable IDs, and tracker filters verified');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
