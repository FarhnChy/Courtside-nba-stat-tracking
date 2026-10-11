const crypto = require('node:crypto');
const { failure } = require('./fantasy-store');
const check = (ok, message, status = 409) => { if (!ok) throw failure(message, status); };
const dateKey = now => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
const offset = (date, days) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const lineup = (team, date) => [...team.lineups].reverse().find(x => x.date <= date)?.players || [];
const owned = (league, id) => league.teams.some(t => t.roster.includes(id) || (t.ir || []).includes(id));
function defaults(league) {
  league.rules ||= { draftSeconds: 0, waiverHours: 0, irSlots: 0, playoffTeams: 0 };
  league.waivers ||= {}; league.claims ||= []; league.trades ||= []; league.waiverOrder ||= [...league.order].reverse();
  for (const team of league.teams) { team.ir ||= []; team.queue ||= []; }
  return league;
}
function rules(body) {
  const result = { draftSeconds: body.draftSeconds ?? 0, waiverHours: body.waiverHours ?? 0, irSlots: body.irSlots ?? 0, playoffTeams: body.playoffTeams ?? 0 };
  for (const [key, choices] of Object.entries({ draftSeconds: [0, 30, 60, 90, 120], waiverHours: [0, 24, 48], irSlots: [0, 1, 2], playoffTeams: [0, 2, 4] })) check(choices.includes(result[key]), `Invalid ${key} setting.`, 400);
  check(result.playoffTeams <= (body.capacity ?? 8), 'Playoff teams cannot exceed league capacity.', 400);
  return result;
}
function trimLineup(team, tomorrow) {
  const players = lineup(team, tomorrow).filter(id => team.roster.includes(id));
  team.lineups = team.lineups.filter(x => x.date !== tomorrow); team.lineups.push({ date: tomorrow, players });
}
function drop(league, team, id, now) {
  if (!id) return;
  check(team.roster.includes(id), 'You can only drop your own active players.');
  team.roster = team.roster.filter(x => x !== id);
  if (league.rules.waiverHours) league.waivers[id] = { until: new Date(+now + league.rules.waiverHours * 3600000).toISOString(), droppedBy: team.id };
  trimLineup(team, offset(dateKey(now), 1));
}
function finishPick(league, owner, player, now, log) {
  const team = league.teams.find(t => t.id === owner);
  team.roster.push(player.id); league.picks.push({ teamId: owner, playerId: player.id, at: now.toISOString() });
  log(league, `${team.name} drafted ${player.name}.`);
  league.draftDeadline = league.rules.draftSeconds ? new Date(+now + league.rules.draftSeconds * 1000).toISOString() : null;
  if (league.picks.length === league.teams.length * league.rosterSize) {
    league.status = 'active'; league.startDate = offset(dateKey(now), 1); league.draftDeadline = null;
    for (const t of league.teams) t.lineups.push({ date: league.startDate, players: t.roster.slice(0, league.starters) });
    log(league, `Draft complete. Scoring starts ${league.startDate}.`);
  }
}
function autoPlayer(league, owner) {
  const queue = league.teams.find(t => t.id === owner).queue || [];
  return queue.map(id => league.players.find(p => p.id === id)).find(p => p && !owned(league, p.id)) || league.players.find(p => !owned(league, p.id));
}
function tick(league, now, log, nextTeam, standings) {
  defaults(league);
  while (league.status === 'draft' && league.draftDeadline && Date.parse(league.draftDeadline) <= +now) {
    const owner = nextTeam(league), player = autoPlayer(league, owner);
    if (!player) break;
    finishPick(league, owner, player, new Date(league.draftDeadline), log);
  }
  for (const [id, waiver] of Object.entries(league.waivers).sort((a, b) => a[1].until.localeCompare(b[1].until) || a[0].localeCompare(b[0]))) {
    if (Date.parse(waiver.until) > +now) continue;
    const claims = league.claims.filter(c => c.playerId === id).sort((a, b) => league.waiverOrder.indexOf(a.teamId) - league.waiverOrder.indexOf(b.teamId));
    for (const claim of claims) {
      const team = league.teams.find(t => t.id === claim.teamId);
      if (owned(league, id) || (claim.dropId && !team.roster.includes(claim.dropId)) || (!claim.dropId && team.roster.length >= league.rosterSize)) continue;
      drop(league, team, claim.dropId, now); team.roster.push(id);
      league.waiverOrder = league.waiverOrder.filter(x => x !== team.id).concat(team.id);
      log(league, `${team.name} won the waiver claim for ${league.players.find(p => p.id === id)?.name}. Eligible tomorrow.`);
      break;
    }
    delete league.waivers[id]; league.claims = league.claims.filter(c => c.playerId !== id);
  }
  for (const trade of league.trades) if (trade.status === 'pending' && Date.parse(trade.expiresAt) <= +now) trade.status = 'expired';
  if (league.rules.playoffTeams && league.startDate) {
    if (!league.playoffs && standings(league).completedWeeks === league.weeks) {
      const seeds = standings(league).rows.slice(0, league.rules.playoffTeams).map(x => x.id);
      league.playoffs = { seeds, rounds: [{ pairs: seeds.length === 4 ? [[seeds[0], seeds[3]], [seeds[1], seeds[2]]] : [[seeds[0], seeds[1]]] }] };
      log(league, 'Playoff seeds are locked. Tied playoff matchups go to the higher seed.');
    }
    if (league.playoffs) for (let round = 0; round < league.playoffs.rounds.length; round++) {
      const bracket = league.playoffs.rounds[round]; if (bracket.winners) continue;
      const dates = Array.from({ length: 7 }, (_, i) => offset(league.startDate, (league.weeks + round) * 7 + i));
      if (!dates.every(d => league.scores[d]?.complete)) break;
      const points = id => dates.reduce((sum, d) => sum + (league.scores[d].totals[id] || 0), 0);
      bracket.totals = Object.fromEntries(bracket.pairs.flat().map(id => [id, points(id)]));
      bracket.winners = bracket.pairs.map(([a, b]) => points(a) === points(b) ? (league.playoffs.seeds.indexOf(a) < league.playoffs.seeds.indexOf(b) ? a : b) : points(a) > points(b) ? a : b);
      if (bracket.winners.length === 1) { league.playoffs.champion = bracket.winners[0]; log(league, `${league.teams.find(t => t.id === bracket.winners[0]).name} won the championship!`); }
      else league.playoffs.rounds.push({ pairs: [[bracket.winners[0], bracket.winners[1]]] });
    }
  }
  return league;
}
function advancedAction(league, me, body, now, log, injuries) {
  const tomorrow = offset(dateKey(now), 1);
  if (body.action === 'queue') {
    check(['lobby', 'draft'].includes(league.status), 'The draft has finished.');
    check(Array.isArray(body.players) && body.players.length <= 100 && new Set(body.players).size === body.players.length && body.players.every(id => league.players.some(p => p.id === id)), 'Choose up to 100 different draft players.', 400);
    me.queue = body.players; return true;
  }
  if (!['claim', 'cancelClaim', 'trade', 'acceptTrade', 'rejectTrade', 'cancelTrade', 'ir', 'activate'].includes(body.action)) return false;
  check(league.status === 'active', 'Finish the draft first.');
  if (body.action === 'claim') {
    const waiver = league.waivers[body.playerId];
    check(waiver && Date.parse(waiver.until) > +now && waiver.droppedBy !== me.id, 'This player cannot be claimed by your team.');
    check(!body.dropId || me.roster.includes(body.dropId), 'Choose a player from your roster to drop.');
    check(body.dropId || me.roster.length < league.rosterSize, 'Choose a player to drop first.');
    league.claims = league.claims.filter(c => c.teamId !== me.id || c.playerId !== body.playerId);
    league.claims.push({ teamId: me.id, playerId: body.playerId, dropId: body.dropId || null });
  } else if (body.action === 'cancelClaim') league.claims = league.claims.filter(c => c.teamId !== me.id || c.playerId !== body.playerId);
  else if (body.action === 'trade') {
    const target = league.teams.find(t => t.id === body.teamId);
    check(target && target.id !== me.id && me.roster.includes(body.giveId) && target.roster.includes(body.receiveId), 'Choose one active player from each team.');
    check(league.trades.filter(t => t.from === me.id && t.status === 'pending').length < 10, 'Cancel an existing offer before making another.');
    league.trades = league.trades.filter(t => t.status === 'pending').concat(league.trades.filter(t => t.status !== 'pending').slice(-90));
    league.trades.push({ id: crypto.randomUUID(), from: me.id, to: target.id, giveId: body.giveId, receiveId: body.receiveId, status: 'pending', expiresAt: new Date(+now + 48 * 3600000).toISOString() });
    log(league, `${me.name} proposed a trade to ${target.name}.`);
  } else if (body.action.endsWith('Trade')) {
    const trade = league.trades.find(t => t.id === body.tradeId);
    check(trade?.status === 'pending', 'This offer is no longer pending.');
    check(body.action === 'cancelTrade' ? me.id === trade.from : me.id === trade.to, 'You cannot respond to this trade.', 403);
    if (body.action === 'acceptTrade') {
      const from = league.teams.find(t => t.id === trade.from), to = league.teams.find(t => t.id === trade.to);
      check(from.roster.includes(trade.giveId) && to.roster.includes(trade.receiveId), 'A traded player is no longer on the original roster.');
      from.roster = from.roster.map(id => id === trade.giveId ? trade.receiveId : id); to.roster = to.roster.map(id => id === trade.receiveId ? trade.giveId : id);
      trimLineup(from, tomorrow); trimLineup(to, tomorrow); trade.status = 'accepted';
      log(league, `${from.name} and ${to.name} completed a trade. Players are eligible tomorrow.`);
    } else trade.status = body.action === 'rejectTrade' ? 'rejected' : 'cancelled';
  } else if (body.action === 'ir') {
    check(me.roster.includes(body.playerId) && me.ir.length < league.rules.irSlots, 'Choose your active player and an available IR slot.');
    check(injuries?.has(body.playerId), 'The current NBA injury report must list this player as Out or Injured Reserve.');
    me.roster = me.roster.filter(id => id !== body.playerId); me.ir.push(body.playerId); trimLineup(me, tomorrow);
    log(league, `${me.name} moved ${league.players.find(p => p.id === body.playerId)?.name} to injured reserve.`);
  } else {
    check(me.ir.includes(body.playerId), 'This player is not on your injured reserve.');
    check(body.dropId || me.roster.length < league.rosterSize, 'Choose a player to drop before activating.');
    drop(league, me, body.dropId, now); me.ir = me.ir.filter(id => id !== body.playerId); me.roster.push(body.playerId);
    log(league, `${me.name} activated a player from injured reserve. Eligible tomorrow.`);
  }
  return true;
}
module.exports = { defaults, rules, tick, advancedAction, finishPick, autoPlayer, owned, drop };
