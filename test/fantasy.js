const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { createStore } = require('../lib/fantasy-store');
const { createFantasy, secret, scoreRows, dateKey, pairings } = require('../lib/fantasy');
const { createFantasyHandler } = require('../lib/fantasy-api');

async function run() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'courtside-fantasy-test-'));
  const env = { FANTASY_DATA_DIR: directory };
  const store = createStore(env);
  const players = Array.from({ length: 12 }, (_, i) => ({ id: String(i + 1), name: `Player ${String(i + 1).padStart(2, '0')}`, position: 'G', team: 'BOS' }));
  let now = new Date('2026-10-01T16:00:00Z');
  let fail = false, correction = 0;
  const provider = {
    scoreboard: async date => { if (fail) throw new Error('Offline'); return { games: [{ id: date, status: { state: 'post', completed: true } }] }; },
    summary: async () => ({ boxscore: [{ sections: [{ labels: ['PTS', 'REB', 'AST', 'STL', 'BLK', 'TO'], athletes: players.map((player, i) => ({ id: player.id, stats: [String((i + 1) * 10 + correction), '5', '2', '1', '1', '2'] })) }] }] })
  };
  const options = { store, provider, clock: () => now, catalogLoader: async () => players };
  const fantasy = createFantasy(options);
  const alphaKey = secret(), betaKey = secret(), strangerKey = secret();
  let server;
  try {
    assert.equal(dateKey(new Date('2026-10-02T02:00:00Z')), '2026-10-01', 'midnight uses New York time');
    assert.equal(dateKey(new Date('2026-11-02T04:30:00Z')), '2026-11-01', 'daylight saving offset is respected');
    assert.equal(createStore({ VERCEL: '1' }).available, false, 'serverless must never write ephemeral league files');
    assert.equal(createStore({ UPSTASH_REDIS_REST_URL: 'https://example.com' }).available, false, 'partial storage settings fail closed');
    await assert.rejects(createStore({ VERCEL: '1' }).read('anything'), /not configured/);
    // Exercise the hosted transport and CAS retry path with independent instances.
    const originalFetch = global.fetch;
    const redis = new Map(); let conflicts = 0;
    global.fetch = async (_url, options) => {
      const args = JSON.parse(options.body); let result;
      assert.equal(options.headers.Authorization, 'Bearer test-token');
      if (args[0] === 'GET') result = redis.get(args[1]) || null;
      else if (args[0] === 'EVAL') {
        if ((redis.get(args[3]) || '') !== args[4]) { result = 0; conflicts++; }
        else { redis.set(args[3], args[5]); result = 1; }
      } else throw new Error('Unexpected Redis command');
      return new Response(JSON.stringify({ result }));
    };
    try {
      const remoteEnv = { UPSTASH_REDIS_REST_URL: 'https://test.example', UPSTASH_REDIS_REST_TOKEN: 'test-token' };
      const a = createStore(remoteEnv), b = createStore(remoteEnv);
      await Promise.all([a.update('counter', old => ({ count: (old?.count || 0) + 1 })), b.update('counter', old => ({ count: (old?.count || 0) + 1 }))]);
      assert.equal((await a.read('counter')).count, 2);
      assert.ok(conflicts > 0, 'a conflicting hosted write must retry');
    } finally { global.fetch = originalFetch; }
    await assert.rejects(fantasy.create({ name: 'x', teamName: 'Alpha' }, alphaKey), /2–40/);
    await assert.rejects(fantasy.create({ name: 'Friends', teamName: 'Alpha', rosterSize: 2, starters: 3 }, alphaKey), /cannot exceed/);
    let league = await fantasy.create({ name: 'Friends', teamName: 'Alpha', capacity: 2, rosterSize: 2, starters: 1, weeks: 2 }, alphaKey);
    const id = league.id;
    const retry = await fantasy.create({ id, name: 'Friends', teamName: 'Alpha', capacity: 2, rosterSize: 2, starters: 1, weeks: 2 }, alphaKey);
    assert.equal(retry.id, id, 'a lost create response can be retried without duplicating the league');
    await assert.rejects(fantasy.create({ id, name: 'Friends', teamName: 'Impostor' }, strangerKey), error => error.status === 409);
    assert.equal(JSON.stringify(league).includes('keyHash'), false);
    await assert.rejects(fantasy.get(id, strangerKey), error => error.status === 401);
    await assert.rejects(fantasy.action(id, alphaKey, { action: 'start' }), /at least one friend/);
    const beta = await fantasy.join(id, { teamName: 'Beta' }, betaKey);
    assert.equal((await fantasy.join(id, { teamName: 'Beta' }, betaKey)).teams.length, 2, 'join retries are idempotent');
    await assert.rejects(fantasy.join(id, { teamName: 'Third' }, strangerKey), /full/);
    await assert.rejects(fantasy.action(id, betaKey, { action: 'start' }), error => error.status === 403);
    league = await fantasy.action(id, alphaKey, { action: 'start' });
    assert.equal(league.status, 'draft');
    assert.deepEqual([...league.order].sort(), league.teams.map(team => team.id).sort());
    const keys = { [league.me]: alphaKey, [beta.me]: betaKey };
    const firstId = league.nextTeam;
    const wrongKey = firstId === league.me ? betaKey : alphaKey;
    await assert.rejects(fantasy.action(id, wrongKey, { action: 'pick', playerId: '1', pickNumber: 0 }), error => error.status === 403);
    const simultaneous = await Promise.allSettled([
      fantasy.action(id, keys[firstId], { action: 'pick', playerId: '1', pickNumber: 0 }),
      fantasy.action(id, keys[firstId], { action: 'pick', playerId: '2', pickNumber: 0 })
    ]);
    assert.equal(simultaneous.filter(result => result.status === 'fulfilled').length, 1, 'concurrent picks cannot both commit');
    league = await fantasy.get(id, alphaKey);
    const picked = league.picks[0].playerId;
    await assert.rejects(fantasy.action(id, keys[league.nextTeam], { action: 'pick', playerId: picked, pickNumber: 1 }), /unavailable/);
    while (league.status === 'draft') league = await fantasy.action(id, alphaKey, { action: 'autoPick', pickNumber: league.picks.length });
    assert.equal(league.startDate, '2026-10-02');
    assert.deepEqual(league.picks.map(pick => pick.teamId), [league.order[0], league.order[1], league.order[1], league.order[0]], 'snake reverses at the end of each round');
    await assert.rejects(fantasy.action(id, alphaKey, { action: 'pick', playerId: '6', pickNumber: 4 }), /not active/);
    const alpha = league.teams.find(team => team.id === league.me);
    const betaTeam = league.teams.find(team => team.id !== league.me);
    await assert.rejects(fantasy.action(id, alphaKey, { action: 'lineup', date: league.nextDate, players: betaTeam.roster.slice(0, 1) }), /your roster/);
    await assert.rejects(fantasy.action(id, alphaKey, { action: 'lineup', date: league.today, players: [] }), /date changed/);
    await assert.rejects(fantasy.action(id, alphaKey, { action: 'lineup', date: league.nextDate, players: [alpha.roster[0], alpha.roster[0]] }), /different players/);
    league = await fantasy.action(id, alphaKey, { action: 'lineup', date: league.nextDate, players: [alpha.roster[0]] });
    now = new Date('2026-10-02T23:00:00Z');
    league = await fantasy.sync(id, alphaKey);
    const expected = Number(alpha.roster[0]) * 10 + 13;
    assert.equal(league.matchup.totals[alpha.id], expected, 'fantasy points use server box-score weights');
    assert.equal(league.matchup.complete, false);
    const frozen = league.teams.find(team => team.id === alpha.id).todayLineup;
    league = await fantasy.action(id, alphaKey, { action: 'addDrop', date: league.nextDate, playerId: '8', dropId: alpha.roster[0] });
    assert.deepEqual(league.teams.find(team => team.id === alpha.id).todayLineup, frozen, 'dropping a player cannot alter today’s locked lineup');
    assert.equal(league.teams.find(team => team.id === alpha.id).nextLineup.includes(alpha.roster[0]), false);
    await assert.rejects(fantasy.action(id, betaKey, { action: 'addDrop', date: league.nextDate, playerId: '8', dropId: betaTeam.roster[0] }), /already rostered/);
    league = await fantasy.action(id, alphaKey, { action: 'lineup', date: league.nextDate, players: ['8'] });
    now = new Date('2026-10-03T16:00:00Z');
    league = await fantasy.sync(id, alphaKey);
    assert.equal(league.matchup.totals[alpha.id], expected + 93);
    const beforeFailure = league.matchup.totals[alpha.id];
    fail = true; now = new Date('2026-10-03T16:02:00Z');
    league = await fantasy.sync(id, alphaKey);
    assert.equal(league.matchup.totals[alpha.id], beforeFailure, 'provider failures retain previously scored points');
    assert.ok(league.sync.errors.length);
    fail = false; correction = 1; now = new Date('2026-10-03T16:04:00Z');
    league = await fantasy.sync(id, alphaKey);
    assert.equal(league.matchup.totals[alpha.id], beforeFailure + 2, 'corrections replace points instead of accumulating duplicates');
    now = new Date('2026-10-09T16:00:00Z');
    league = await fantasy.sync(id, alphaKey);
    league = await fantasy.sync(id, alphaKey);
    assert.equal(league.standings.completedWeeks, 1);
    assert.equal(league.standings.rows.reduce((sum, row) => sum + row.wins, 0), 1);
    const restored = createFantasy({ ...options, store: createStore(env) });
    assert.deepEqual((await restored.get(id, alphaKey)).standings, league.standings, 'teams and scoring survive server restart');
    const dnp = scoreRows({ boxscore: [{ sections: [{ labels: Object.keys(require('../lib/fantasy').SCORING), athletes: [{ id: '1', didNotPlay: true, stats: [] }] }] }] });
    assert.equal(dnp['1'], 0);
    assert.throws(() => scoreRows({ boxscore: [{ sections: [{ labels: ['PTS'], athletes: [] }] }] }), /missing/);
    const byeLeague = { order: ['a', 'b', 'c'] };
    assert.equal(pairings(byeLeague, 0).flat().filter(Boolean).length, 3);

    const handler = createFantasyHandler(options);
    server = http.createServer((req, res) => handler(req, res, new URL(req.url, 'http://localhost').pathname));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const endpoint = `${base}/api/fantasy/leagues/${id}`;
    assert.equal((await fetch(endpoint)).status, 401);
    const get = await fetch(endpoint, { headers: { Authorization: `Bearer ${alphaKey}` } });
    assert.equal(get.status, 200); assert.equal(get.headers.get('cache-control'), 'no-store');
    const serialized = await get.text(); assert.equal(serialized.includes(alphaKey), false); assert.equal(serialized.includes('keyHash'), false);
    const headers = { Authorization: `Bearer ${alphaKey}`, 'Content-Type': 'application/json' };
    assert.equal((await fetch(`${endpoint}/actions`, { method: 'POST', headers: { ...headers, Origin: 'https://malicious.example' }, body: '{}' })).status, 403);
    assert.equal((await fetch(`${endpoint}/actions`, { method: 'POST', headers, body: '{bad' })).status, 400);
    assert.equal((await fetch(`${endpoint}/actions`, { method: 'POST', headers, body: JSON.stringify({ text: 'a'.repeat(9000) }) })).status, 413);
    assert.equal((await fetch(`${endpoint}/actions`, { method: 'POST', headers, body: JSON.stringify({ action: 'lineup', date: '1999-01-01', players: [] }) })).status, 409);
    assert.equal((await fetch(`${endpoint}/actions`, { method: 'DELETE', headers })).status, 405);
    assert.equal((await fetch(`${base}/api/fantasy/config`)).status, 200);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    // This path is created by mkdtemp above; never points at real league data.
    assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
    await fs.rm(directory, { recursive: true, force: true });
  }
  console.log('✓ Fantasy league isolation, concurrent drafting, lineup locks, real-stat scoring, corrections, persistence, and HTTP protection verified');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
