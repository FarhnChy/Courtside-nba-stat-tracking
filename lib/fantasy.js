const crypto = require('node:crypto');
const advanced = require('./fantasy-rules');
const { failure } = require('./fantasy-store');

const SCORING = { PTS: 1, REB: 1.2, AST: 1.5, STL: 3, BLK: 3, TO: -1 };
const digest = token => crypto.createHash('sha256').update(token).digest('hex');
const secret = () => crypto.randomBytes(24).toString('base64url');
const dateKey = now => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
const offset = (date, days) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
function check(condition, message, status = 400) { if (!condition) throw failure(message, status); }
function name(value, label) { check(typeof value === 'string' && value.trim().length >= 2 && value.trim().length <= 40, `${label} must be 2–40 characters.`); return value.trim(); }
function integer(value, min, max, label) { check(Number.isInteger(value) && value >= min && value <= max, `${label} must be ${min}–${max}.`); return value; }
function member(league, token) {
  check(league, 'League not found.', 404);
  check(typeof token === 'string' && /^[\w-]{32}$/.test(token), 'Enter your private team key to access this league.', 401);
  const team = league.teams.find(team => team.keyHash === digest(token));
  check(team, 'The team key does not belong to this league.', 401);
  return team;
}
function commissioner(league, team) { check(team.id === league.commissioner, 'Only the commissioner can do that.', 403); }
function lineupAt(team, date) {
  return [...team.lineups].reverse().find(entry => entry.date <= date)?.players || [];
}
function nextTeam(league) {
  const round = Math.floor(league.picks.length / league.teams.length);
  const slot = league.picks.length % league.teams.length;
  return league.order[round % 2 ? league.order.length - 1 - slot : slot];
}
function pairings(league, week) {
  const ring = [...league.order];
  if (ring.length % 2) ring.push(null);
  for (let i = 0; i < week % (ring.length - 1); i++) ring.splice(1, 0, ring.pop());
  return ring.slice(0, ring.length / 2).map((id, i) => [id, ring[ring.length - 1 - i]]);
}
function scoreRows(summary) {
  const points = {};
  for (const group of summary.boxscore || []) for (const section of group.sections || []) {
    const labels = section.labels.map(label => label.toUpperCase() === 'TOV' ? 'TO' : label.toUpperCase());
    check(Object.keys(SCORING).every(label => labels.includes(label)), 'Box score is missing scoring statistics.', 502);
    for (const player of section.athletes || []) {
      if (player.didNotPlay) { points[player.id] = 0; continue; }
      let total = 0;
      for (const [label, weight] of Object.entries(SCORING)) {
        const raw = player.stats[labels.indexOf(label)];
        check(raw !== '' && raw != null && raw !== '-' && Number.isFinite(Number(raw)), 'Box score contains incomplete statistics.', 502);
        total += Number(raw) * weight;
      }
      points[player.id] = Math.round(total * 100) / 100;
    }
  }
  return points;
}
async function parallelMap(items, size, fn) {
  const results = new Array(items.length); let index = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (index < items.length) { const i = index++; results[i] = await fn(items[i]); }
  }));
  return results;
}

function createFantasy({ store, provider, clock = () => new Date(), catalogLoader }) {
  let catalogCache; let catalogPending;
  const dayCache = new Map();
  const syncs = new Map();
  async function catalog() {
    if (catalogCache && clock().getTime() - catalogCache.time < 3600000) return catalogCache.players;
    if (!catalogPending) catalogPending = (async () => {
      let players;
      if (catalogLoader) players = await catalogLoader();
      else {
        // Use ESPN IDs consistently for both drafting and box-score scoring.
        const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams?limit=40', { signal: AbortSignal.timeout(12000) });
        check(response.ok, 'NBA player directory is unavailable.', 502);
        const raw = await response.json();
        const teams = raw.sports?.[0]?.leagues?.[0]?.teams || [];
        check(teams.length === 30, 'NBA player directory is incomplete. Try again shortly.', 502);
        const rosters = await parallelMap(teams, 5, async ({ team }) => {
          const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${team.id}/roster`, { signal: AbortSignal.timeout(12000) });
          check(response.ok, 'NBA rosters are unavailable. Try again shortly.', 502);
          const raw = await response.json();
          check(Array.isArray(raw.athletes) && raw.athletes.length > 0, 'An NBA roster is incomplete. Try again shortly.', 502);
          return raw.athletes.map(player => ({ id: String(player.id), name: player.displayName, position: player.position?.abbreviation || '—', team: team.abbreviation }));
        });
        players = [...new Map(rosters.flat().map(player => [player.id, player])).values()];
      }
      players.sort((a, b) => a.name.localeCompare(b.name));
      catalogCache = { time: clock().getTime(), players }; return players;
    })().finally(() => { catalogPending = null; });
    return catalogPending;
  }
  function log(league, text) { league.activity.unshift({ at: clock().toISOString(), text }); league.activity = league.activity.slice(0, 100); }
  function teamRecord(teamName, key) { return { id: crypto.randomUUID(), name: name(teamName, 'Team name'), keyHash: digest(key), roster: [], lineups: [] }; }
  function standings(league) {
    const rows = league.teams.map(team => ({ id: team.id, name: team.name, wins: 0, losses: 0, ties: 0, points: 0 }));
    const byId = Object.fromEntries(rows.map(row => [row.id, row]));
    let completedWeeks = 0;
    if (league.startDate) for (let week = 0; week < league.weeks; week++) {
      const dates = Array.from({ length: 7 }, (_, i) => offset(league.startDate, week * 7 + i));
      if (!dates.every(date => league.scores[date]?.complete)) continue;
      completedWeeks++;
      const totals = Object.fromEntries(rows.map(row => [row.id, dates.reduce((sum, date) => sum + (league.scores[date].totals[row.id] || 0), 0)]));
      for (const row of rows) row.points += totals[row.id];
      for (const [a, b] of pairings(league, week)) {
        if (!a || !b) continue;
        if (Math.abs(totals[a] - totals[b]) < 0.001) { byId[a].ties++; byId[b].ties++; }
        else { const winner = totals[a] > totals[b] ? a : b; byId[winner].wins++; byId[winner === a ? b : a].losses++; }
      }
    }
    return { completedWeeks, rows: rows.sort((a, b) => b.wins - a.wins || b.ties - a.ties || b.points - a.points).map(row => ({ ...row, points: Math.round(row.points * 100) / 100 })) };
  }
  function view(league, token) {
    advanced.defaults(league);
    const me = member(league, token);
    const today = dateKey(clock());
    const week = league.startDate ? Math.max(0, Math.min(totalWeeks(league) - 1, Math.floor(daysBetween(league.startDate, today) / 7))) : 0;
    const dates = league.startDate ? Array.from({ length: 7 }, (_, i) => offset(league.startDate, week * 7 + i)) : [];
    const totals = Object.fromEntries(league.teams.map(team => [team.id, Math.round(dates.reduce((sum, date) => sum + (league.scores[date]?.totals[team.id] || 0), 0) * 100) / 100]));
    return {
      id: league.id, name: league.name, capacity: league.capacity, rosterSize: league.rosterSize, starters: league.starters,
      weeks: league.weeks, status: league.status, commissioner: league.commissioner, me: me.id,
      teams: league.teams.map(({ keyHash, queue, ...team }) => ({ ...team, todayLineup: lineupAt(team, today), nextLineup: lineupAt(team, offset(today, 1)) })),
      order: league.order, picks: league.picks, nextTeam: league.status === 'draft' ? nextTeam(league) : null,
      players: league.players, activity: league.activity, startDate: league.startDate, today, nextDate: offset(today, 1),
      rules: league.rules, draftDeadline: league.draftDeadline || null, queue: me.queue, waivers: league.waivers, claims: league.claims.filter(c => c.teamId === me.id), waiverOrder: league.waiverOrder, trades: league.trades.filter(t => t.from === me.id || t.to === me.id), playoffs: league.playoffs || null,
      scoring: SCORING, standings: standings(league), sync: league.sync || null,
      matchup: { week: week + 1, dates, totals, pairs: week >= league.weeks ? (league.playoffs?.rounds[week - league.weeks]?.pairs || []) : league.order.length ? pairings(league, week) : [], complete: dates.length > 0 && dates.every(date => league.scores[date]?.complete) },
      storage: store.mode
    };
  }
  async function create(body, token) {
    check(/^[\w-]{32}$/.test(token || ''), 'A private team key is required.', 401);
    const team = teamRecord(body.teamName, token);
    const id = body.id || crypto.randomBytes(9).toString('hex');
    check(/^[a-f0-9]{18}$/.test(id), 'Invalid league identifier.');
    const league = { id, name: name(body.name, 'League name'), capacity: integer(body.capacity ?? 8, 2, 12, 'League size'), rosterSize: integer(body.rosterSize ?? 10, 2, 15, 'Roster size'), starters: integer(body.starters ?? 5, 1, 10, 'Starters'), weeks: integer(body.weeks ?? 12, 1, 26, 'Season length'), commissioner: team.id, teams: [team], status: 'lobby', order: [], picks: [], players: [], scores: {}, startDate: null, activity: [] };
    league.rules = advanced.rules(body);
    check(league.starters <= league.rosterSize, 'Starters cannot exceed roster size.');
    log(league, `${team.name} created the league.`);
    const saved = await store.update(id, existing => {
      if (existing) { check(existing.teams[0].keyHash === digest(token), 'Please retry creating the league.', 409); return existing; }
      return league;
    });
    await register(id);
    return view(saved, token);
  }
  async function join(id, body, token) {
    check(/^[\w-]{32}$/.test(token || ''), 'A private team key is required.', 401);
    const newTeam = teamRecord(body.teamName, token);
    const league = await store.update(id, league => {
      check(league, 'Invite code not found.', 404);
      if (league.teams.some(team => team.keyHash === newTeam.keyHash)) return league;
      check(league.status === 'lobby', 'This league has already started drafting.', 409);
      check(league.teams.length < league.capacity, 'This league is full.', 409);
      check(!league.teams.some(team => team.name.toLowerCase() === newTeam.name.toLowerCase()), 'That team name is already taken.', 409);
      league.teams.push(newTeam); log(league, `${newTeam.name} joined.`); return league;
    });
    return view(league, token);
  }
  const totalWeeks = league => league.weeks + (league.rules?.playoffTeams ? Math.log2(league.rules.playoffTeams) : 0);
  async function register(id) {
    if ((await store.read('league-index'))?.ids.includes(id)) return;
    await store.update('league-index', old => ({ ids: [...new Set([...(old?.ids || []), id])] }));
  }
  async function tick(id) {
    const snapshot = await store.read(id); check(snapshot, 'League not found.', 404);
    const before = JSON.stringify(snapshot);
    advanced.tick(snapshot, clock(), () => {}, nextTeam, standings);
    if (JSON.stringify(snapshot) === before) return snapshot;
    return store.update(id, league => { check(league, 'League not found.', 404); return advanced.tick(league, clock(), log, nextTeam, standings); });
  }
  async function action(id, token, body) {
    const initial = await store.read(id); member(initial, token);
    await tick(id);
    let injuries;
    if (body.action === 'ir') {
      const report = await provider.injuries();
      check(!report.stale && Array.isArray(report.teams), 'Current injury report is unavailable.', 502);
      injuries = new Set(report.teams.flatMap(t => t.injuries || []).filter(i => /^(out|injured reserve)$/i.test(i.status)).map(i => String(i.athleteId)));
    }
    const players = body.action === 'start' ? await catalog() : null;
    const now = clock(); const today = dateKey(now); const tomorrow = offset(today, 1);
    const league = await store.update(id, league => {
      const me = member(league, token);
      advanced.defaults(league);
      if (league.status === 'active') check(today < offset(league.startDate, totalWeeks(league) * 7), 'This season has ended.', 409);
      if (advanced.advancedAction(league, me, body, now, log, injuries)) return league;
      if (body.action === 'start') {
        commissioner(league, me); check(league.status === 'lobby', 'The draft has already started.', 409);
        check(league.teams.length >= league.rules.playoffTeams, 'Invite enough managers for the selected playoff size.');
        check(league.teams.length >= 2, 'Invite at least one friend before starting.');
        check(players.length >= league.teams.length * league.rosterSize, 'There are not enough NBA players to draft.', 502);
        league.players = players; league.order = league.teams.map(team => team.id);
        for (let i = league.order.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [league.order[i], league.order[j]] = [league.order[j], league.order[i]]; }
        league.waiverOrder = [...league.order].reverse();
        league.draftDeadline = league.rules.draftSeconds ? new Date(+now + league.rules.draftSeconds * 1000).toISOString() : null;
        league.status = 'draft'; log(league, 'The commissioner started the snake draft. Order was randomized.');
      } else if (body.action === 'pick' || body.action === 'autoPick') {
        check(league.status === 'draft', 'The draft is not active.', 409);
        check(body.pickNumber === league.picks.length, 'Another pick was made. Refresh the draft.', 409);
        const owner = nextTeam(league);
        check(me.id === owner || (body.action === 'autoPick' && me.id === league.commissioner), 'It is another team’s turn.', 403);
        const taken = new Set(league.teams.flatMap(team => team.roster));
        // Managers control their queue; the fallback pool is alphabetical, not a projection model.
        const player = body.action === 'autoPick' ? advanced.autoPlayer(league, owner) : league.players.find(player => player.id === body.playerId);
        check(player && !taken.has(player.id), 'That player is unavailable.', 409);
        advanced.finishPick(league, owner, player, now, log);
      } else if (body.action === 'lineup') {
        check(league.status === 'active', 'Finish the draft before setting lineups.', 409);
        check(body.date === tomorrow, 'The lineup date changed. Refresh and try again.', 409);
        check(Array.isArray(body.players) && body.players.length <= league.starters && new Set(body.players).size === body.players.length && body.players.every(id => me.roster.includes(id)), `Choose up to ${league.starters} different players from your roster.`);
        me.lineups = me.lineups.filter(entry => entry.date !== tomorrow); me.lineups.push({ date: tomorrow, players: body.players });
        log(league, `${me.name} set the lineup for ${tomorrow}.`);
      } else if (body.action === 'addDrop') {
        check(league.status === 'active', 'Finish the draft before changing rosters.', 409);
        check(body.date === tomorrow, 'The roster date changed. Refresh and try again.', 409);
        const player = league.players.find(player => player.id === body.playerId);
        check(player && !advanced.owned(league, player.id), 'That player is already rostered or unavailable.', 409);
        check(!league.waivers[body.playerId], 'This player is on waivers. Submit a claim instead.', 409);
        check(!body.dropId || me.roster.includes(body.dropId), 'You can only drop your own players.');
        check(body.dropId || me.roster.length < league.rosterSize, 'Choose a player to drop first.');
        const tomorrowLineup = lineupAt(me, tomorrow).filter(id => id !== body.dropId);
        advanced.drop(league, me, body.dropId, now); me.roster.push(player.id);
        me.lineups = me.lineups.filter(entry => entry.date !== tomorrow); me.lineups.push({ date: tomorrow, players: tomorrowLineup });
        log(league, `${me.name} added ${player.name}${body.dropId ? ` and dropped ${league.players.find(player => player.id === body.dropId)?.name}` : ''}. Eligible starting ${tomorrow}.`);
      } else throw failure('Unknown fantasy action.', 400);
      return league;
    });
    return view(league, token);
  }
  async function day(date) {
    const hit = dayCache.get(date);
    if (hit && clock().getTime() - hit.time < 60000) return hit.value;
    const observedAt = clock().toISOString();
    const board = await provider.scoreboard(date);
    check(!board.stale && Array.isArray(board.games), 'Score feed is stale or unavailable.', 502);
    const totals = {}; let complete = date < dateKey(clock());
    await parallelMap(board.games, 4, async game => {
      if (game.status.state === 'pre') { complete = false; return; }
      if (!game.status.completed) complete = false;
      const summary = await provider.summary(game.id);
      check(!summary.stale && summary.boxscore?.length, 'Box score is not available yet.', 502);
      const rows = scoreRows(summary);
      check(Object.keys(rows).length > 0, 'Box score is empty.', 502);
      for (const [id, points] of Object.entries(rows)) totals[id] = (totals[id] || 0) + points;
    });
    const value = { totals, complete, observedAt }; dayCache.set(date, { time: clock().getTime(), value });
    if (dayCache.size > 200) dayCache.delete(dayCache.keys().next().value);
    return value;
  }
  async function sync(id, token, internal = false) {
    const league = await store.read(id); if (!internal) member(league, token);
    check(league.status === 'active', 'Scoring begins after the draft.', 409);
    if (syncs.has(id)) {
      await syncs.get(id);
      const updated = await tick(id);
      return internal ? { errors: updated.sync?.errors || [] } : view(updated, token);
    }
    const pending = (async () => {
      const today = dateKey(clock());
      const allDates = Array.from({ length: Math.min(totalWeeks(league) * 7, Math.max(0, daysBetween(league.startDate, today) + 1)) }, (_, i) => offset(league.startDate, i));
      const pendingDates = allDates.filter(date => !league.scores[date]?.complete);
      const dates = [...new Set([...pendingDates.slice(0, 6), ...allDates.slice(-2)])];
      const results = await parallelMap(dates, 2, async date => {
        try { return { date, ...(await day(date)) }; } catch (_) { return { date, error: 'NBA statistics unavailable; previous scores retained.' }; }
      });
      await store.update(id, current => {
        for (const result of results) {
          if (result.error || (current.scores[result.date]?.updatedAt > result.observedAt)) continue;
          const totals = Object.fromEntries(current.teams.map(team => [team.id, Math.round(lineupAt(team, result.date).reduce((sum, player) => sum + (result.totals[player] || 0), 0) * 100) / 100]));
          current.scores[result.date] = { totals, complete: result.complete, updatedAt: result.observedAt };
        }
        current.sync = { at: clock().toISOString(), errors: results.filter(result => result.error).map(result => result.date), remaining: allDates.filter(date => date < today && !current.scores[date]?.complete).length };
        return current;
      });
    })().finally(() => syncs.delete(id));
    syncs.set(id, pending); await pending;
    const updated = await tick(id);
    return internal ? { errors: updated.sync?.errors || [] } : view(updated, token);
  }
  return { create, join, action, sync, catalog,
    get: async (id, token) => { member(await store.read(id), token); await register(id); return view(await tick(id), token); },
    background: async (id, score = true) => { const league = await tick(id); if (score && league.status === 'active') return sync(id, null, true); }
  };
}

module.exports = { createFantasy, SCORING, scoreRows, dateKey, offset, lineupAt, pairings, secret };
