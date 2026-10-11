const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { createStore } = require('../lib/fantasy-store');
const { createFantasy, secret, offset } = require('../lib/fantasy');
const { createBackgroundJobs } = require('../lib/background-jobs');

async function run() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'courtside-advanced-'));
  const store = createStore({ FANTASY_DATA_DIR: directory });
  let now = new Date('2026-10-01T16:00:00Z'), injuryDown = false;
  const players = Array.from({ length: 30 }, (_, i) => ({ id: String(i + 1), name: `Player ${String(i + 1).padStart(2, '0')}` }));
  const provider = { scoreboard: async () => ({ games: [] }), injuries: async () => { if (injuryDown) throw new Error('offline'); return { teams: [{ injuries: [{ athleteId: '1', status: 'Out' }] }] }; } };
  const options = { store, provider, clock: () => now, catalogLoader: async () => players };
  let fantasy = createFantasy(options), server;
  const keys = [secret(), secret(), secret(), secret()];
  try {
    let league = await fantasy.create({ name: 'Advanced', teamName: 'Alpha', capacity: 4, rosterSize: 2, starters: 1, weeks: 1, draftSeconds: 30, waiverHours: 24, irSlots: 1, playoffTeams: 4 }, keys[0]);
    const id = league.id;
    for (let i = 1; i < 4; i++) await fantasy.join(id, { teamName: ['Beta', 'Gamma', 'Delta'][i - 1] }, keys[i]);
    league = await fantasy.action(id, keys[0], { action: 'start' });
    const keyOf = teamId => keys[league.teams.findIndex(t => t.id === teamId)];
    const first = league.nextTeam;
    await fantasy.action(id, keyOf(first), { action: 'queue', players: ['30', '29'] });
    const other = league.teams.find(t => t.id !== first);
    assert.deepEqual((await fantasy.get(id, keyOf(other.id))).queue, [], 'draft queues stay private');
    now = new Date(+now + 31000);
    fantasy = createFantasy(options); // Deadline must survive process restarts.
    await fantasy.background(id, false);
    league = await fantasy.get(id, keys[0]);
    assert.equal(league.picks[0].playerId, '30');
    assert.equal(league.picks.length, 1);
    await assert.rejects(fantasy.action(id, keys[0], { action: 'autoPick', pickNumber: 0 }), /Another pick/);
    now = new Date(+now + 240000);
    await Promise.all([fantasy.background(id, false), fantasy.background(id, false)]);
    league = await fantasy.get(id, keys[0]);
    assert.equal(league.picks.length, 8, 'concurrent jobs cannot duplicate deadline picks');
    assert.equal(league.status, 'active');
    assert.equal(new Set(league.teams.flatMap(t => t.roster)).size, 8);
    now = new Date('2026-10-02T16:00:00Z');
    const injured = league.teams.find(t => t.roster.includes('1'));
    let own = await fantasy.get(id, keyOf(injured.id));
    const locked = own.teams.find(t => t.id === injured.id).todayLineup;
    await assert.rejects(fantasy.action(id, keyOf(injured.id), { action: 'ir', playerId: injured.roster.find(id => id !== '1') }), /injury report/);
    injuryDown = true;
    await assert.rejects(fantasy.action(id, keyOf(injured.id), { action: 'ir', playerId: '1' }));
    injuryDown = false;
    own = await fantasy.action(id, keyOf(injured.id), { action: 'ir', playerId: '1' });
    assert.deepEqual(own.teams.find(t => t.id === injured.id).todayLineup, locked);
    assert.deepEqual(own.teams.find(t => t.id === injured.id).ir, ['1']);
    await assert.rejects(fantasy.action(id, keys[0], { action: 'addDrop', playerId: '1', date: own.nextDate }), /already rostered/);
    own = await fantasy.action(id, keyOf(injured.id), { action: 'addDrop', playerId: '20', date: own.nextDate });
    await assert.rejects(fantasy.action(id, keyOf(injured.id), { action: 'activate', playerId: '1' }), /drop/);
    own = await fantasy.action(id, keyOf(injured.id), { action: 'activate', playerId: '1', dropId: '20' });
    assert.ok(own.waivers['20']);
    await assert.rejects(fantasy.action(id, keyOf(injured.id), { action: 'claim', playerId: '20', dropId: '1' }), /cannot be claimed/);
    const claimants = own.teams.filter(t => t.id !== injured.id).slice(0, 2);
    for (const t of claimants) await fantasy.action(id, keyOf(t.id), { action: 'claim', playerId: '20', dropId: t.roster[0] });
    assert.equal((await fantasy.get(id, keyOf(injured.id))).claims.length, 0, 'other managers cannot see waiver claims');
    const winner = claimants.sort((a, b) => own.waiverOrder.indexOf(a.id) - own.waiverOrder.indexOf(b.id))[0];
    now = new Date(+now + 86401000);
    await fantasy.background(id, false);
    league = await fantasy.get(id, keys[0]);
    assert.ok(league.teams.find(t => t.id === winner.id).roster.includes('20'));
    assert.equal(league.waiverOrder.at(-1), winner.id);
    assert.equal(league.claims.length, 0);
    const [from, to, third] = league.teams;
    const offer = { action: 'trade', teamId: to.id, giveId: from.roster[0], receiveId: to.roster[0] };
    let view = await fantasy.action(id, keys[0], offer);
    const tradeId = view.trades.at(-1).id;
    await assert.rejects(fantasy.action(id, keys[2], { action: 'acceptTrade', tradeId }), e => e.status === 403);
    assert.equal((await fantasy.get(id, keys[2])).trades.length, 0);
    const before = view.teams.map(t => t.todayLineup);
    const results = await Promise.allSettled([fantasy.action(id, keys[1], { action: 'acceptTrade', tradeId }), fantasy.action(id, keys[1], { action: 'acceptTrade', tradeId })]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    view = await fantasy.get(id, keys[0]);
    assert.deepEqual(view.teams.map(t => t.todayLineup), before, 'trades preserve locked scoring lineups');
    assert.ok(view.teams[0].roster.includes(offer.receiveId));
    await store.update(id, l => {
      for (let i = 0; i < 7; i++) l.scores[offset(l.startDate, i)] = { complete: true, totals: Object.fromEntries(l.teams.map((t, j) => [t.id, 100 - j * 10])) };
      return l;
    });
    await fantasy.background(id, false);
    view = await fantasy.get(id, keys[0]);
    assert.equal(view.playoffs.seeds.length, 4);
    assert.equal(view.playoffs.rounds[0].pairs.length, 2);
    const seeds = view.playoffs.seeds;
    await store.update(id, l => {
      for (let i = 7; i < 21; i++) l.scores[offset(l.startDate, i)] = { complete: true, totals: Object.fromEntries(l.teams.map(t => [t.id, 100])) };
      return l;
    });
    await fantasy.background(id, false);
    view = await fantasy.get(id, keys[0]);
    assert.equal(view.playoffs.rounds[1].pairs.length, 1);
    assert.equal(view.playoffs.champion, seeds[0], 'tied playoff scores favor the higher seed');
    assert.equal(view.standings.completedWeeks, 1, 'playoff scores do not alter regular standings');

    // Exercise the real scoring path without a manager key, not just timer ticks.
    const backgroundResult = await fantasy.background(id);
    assert.deepEqual(backgroundResult.errors, []);
    assert.ok((await store.read(id)).sync.at);
    now = new Date('2026-11-01T16:00:00Z');
    await assert.rejects(fantasy.action(id, keys[0], { action: 'lineup', date: '2026-11-02', players: [] }), /season has ended/);

    let feeds = 0, newsCalls = 0, calls = 0, failNews = false;
    const jobs = createBackgroundJobs({ store, fantasy: { background: async () => { calls++; } }, clock: () => now, secret: () => 'test-secret', moves: { load: async () => { feeds++; return {}; } }, news: async () => { newsCalls++; if (failNews) throw new Error('offline'); return { articles: [{ title: 'Latest' }] }; } });
    await store.update('league-index', () => ({ ids: [] }));
    await Promise.all([jobs.run(), jobs.run()]);
    assert.equal(calls, 1, 'discover old leagues without a browser or existing registry');
    assert.equal(feeds, 1, 'overlapping jobs share one run');
    now = new Date(+now + 60000); await jobs.run();
    assert.equal(feeds, 1);
    now = new Date(+now + 240000); await jobs.run();
    assert.equal(feeds, 2, 'minute jobs still refresh feeds every five minutes');
    failNews = true; now = new Date(+now + 300000);
    assert.ok((await jobs.run()).errors.length);
    assert.equal((await store.read('news-snapshot')).value.articles[0].title, 'Latest');
    server = http.createServer(jobs.handler); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}/api/jobs/refresh`;
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url, { headers: { Authorization: 'Bearer wrong' } })).status, 401);
    failNews = false;
    assert.equal((await fetch(url, { headers: { Authorization: 'Bearer test-secret' } })).status, 200);
    assert.equal((await fetch(url, { method: 'DELETE' })).status, 405);
    const small = await fantasy.create({ name: 'Two-team playoffs', teamName: 'Home', capacity: 2, rosterSize: 2, starters: 1, weeks: 1, playoffTeams: 2 }, keys[0]);
    await fantasy.join(small.id, { teamName: 'Away' }, keys[1]);
    await fantasy.action(small.id, keys[0], { action: 'start' });
    for (let pickNumber = 0; pickNumber < 4; pickNumber++) await fantasy.action(small.id, keys[0], { action: 'autoPick', pickNumber });
    await store.update(small.id, l => {
      for (let i = 0; i < 14; i++) l.scores[offset(l.startDate, i)] = { complete: true, totals: { [l.teams[0].id]: i < 7 ? 100 : 0, [l.teams[1].id]: i < 7 ? 0 : 100 } };
      return l;
    });
    const final = await fantasy.get(small.id, keys[0]);
    assert.equal(final.playoffs.rounds.length, 1);
    assert.equal(final.playoffs.champion, final.teams[1].id, 'lower seed wins a higher-scoring final');
    console.log('✓ Timed drafts, private queues, waiver priority, IR eligibility, atomic trades, playoffs, background discovery, persistence, and job authentication verified');
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await fs.rm(directory, { recursive: true, force: true });
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
