const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const espn = require('./lib/espn');
const finance = require('./lib/finance');
const offseasonContracts = require('./data/offseasonContracts');
const offseasonTrades = require('./data/offseasonTrades');
const offseasonStatusUpdates = require('./data/offseasonStatusUpdates');
const offseasonReportedTransactions = require('./data/offseasonReportedTransactions');

const root = path.join(__dirname, 'public');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png' };
let searchCache = null;

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' });
  res.end(JSON.stringify(body));
}

async function transactionsWithRosterReconciliation() {
  const base = await espn.transactions().catch(() => ({ timestamp: null, season: '', count: 0, transactions: [] }));
  try {
    const [market, directory, shamsFeed] = await Promise.all([
      finance.freeAgents().catch(() => ({ players: [] })),
      espn.teamsList().catch(() => ({ teams: [] })),
      espn.shamsUpdates(25).catch(() => ({ updates: [] }))
    ]);
    const teamAliases = { GSW: 'GS', NOP: 'NO', NYK: 'NY', SAS: 'SA', UTA: 'UTAH', WAS: 'WSH' };
    const teams = new Map(directory.teams.map(team => [team.abbreviation, team]));
    const marketPlayers = new Map(market.players.map(player => [player.name.toLowerCase(), player]));
    const coveredPlayers = new Set();
    const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const actualTransactionText = normalize(base.transactions.map(item => item.description).join(' '));
    const teamAliasesForSearch = directory.teams.flatMap(team => [
      [team.abbreviation, team.abbreviation],
      [team.name, team.abbreviation],
      [team.displayName, team.abbreviation],
      [team.location, team.abbreviation]
    ]).filter(([label]) => label && String(label).length > 1).sort((a, b) => b[0].length - a[0].length);
    const teamForCode = code => {
      const abbreviation = teamAliases[code] || code;
      const team = teams.get(abbreviation) || {};
      return {
        id: team.id || abbreviation,
        abbreviation,
        displayName: team.displayName || code || 'NBA',
        color: team.color || '#334155',
        logo: team.logo || null
      };
    };
    const findPlayerInText = text => market.players.find(player => normalize(text).includes(normalize(player.name)));
    const teamCodeInText = text => {
      const clean = ` ${normalize(text)} `;
      const match = teamAliasesForSearch.find(([label]) => clean.includes(` ${normalize(label)} `));
      return match?.[1] || null;
    };
    const typeFromReport = text => {
      const clean = normalize(text);
      if (clean.includes('trade') || clean.includes('acquire')) return 'Trade';
      if (clean.includes('re sign') || clean.includes('remain with')) return 'Re-signed';
      if (clean.includes('sign') || clean.includes('agreed')) return 'Signed';
      if (clean.includes('buyout')) return 'Buyout';
      if (clean.includes('waive') || clean.includes('waiver')) return 'Waived';
      if (clean.includes('convert')) return 'Converted';
      return 'Roster move';
    };
    const numberWord = value => ({ one:1,two:2,three:3,four:4,five:5,six:6 }[value] || Number(value) || null);
    const contractFromText = text => {
      const years = text.match(/\b(\d+|one|two|three|four|five|six)[-\s]?year\b/i)?.[1];
      const value = text.match(/\$([\d.]+)\s*(m|million|b|billion)\b/i);
      if (!years && !value) return null;
      const amount = value ? Number(value[1]) * (/^b/i.test(value[2]) ? 1_000_000_000 : 1_000_000) : null;
      return {
        years: numberWord(String(years || 1).toLowerCase()) || 1,
        value: amount ? Math.round(amount) : 0,
        details: text.toLowerCase().includes('nearly') ? 'Reported as nearly this amount' : 'Reported terms'
      };
    };
    const verificationFor = (player, teamCode, text) => {
      const playerName = player?.name || '';
      const actualMatch = playerName && actualTransactionText.includes(normalize(playerName));
      if (actualMatch) return { status: 'confirmed', source: 'ESPN public transactions', detail: 'Player appears in ESPN transaction feed.' };
      if (player?.availability === 'Signed' && (!teamCode || player.newTeam === teamCode)) {
        if (player.reconciled === 'ESPN/Shams reported contract') {
          return { status: 'matched', source: 'ESPN/Shams report + tracker label', detail: `Free-agent tracker references the report and Courtside has reported terms for ${player.name}; awaiting transaction-feed confirmation.` };
        }
        return { status: 'confirmed', source: 'NBA free-agent tracker', detail: `Tracker lists ${player.name} as signed${player.newTeam ? ` with ${player.newTeam}` : ''}.` };
      }
      if (player?.newTeam) return { status: 'matched', source: 'NBA free-agent tracker', detail: `Tracker links this report to ${player.newTeam}; awaiting transaction-feed confirmation.` };
      return { status: 'reported', source: 'ESPN/Shams headline', detail: 'Reported by ESPN; awaiting ESPN transaction-feed or tracker confirmation.' };
    };

    const enriched = base.transactions.map(item => {
      const description = item.description.toLowerCase();
      const matchedPlayer = market.players.find(player => description.includes(player.name.toLowerCase()));
      const playerData = matchedPlayer
        ? { id: matchedPlayer.id, name: matchedPlayer.name, headshot: matchedPlayer.headshot }
        : item.player;
      const keepActualTeam = ['Waived', 'Released', 'Buyout'].includes(item.type);
      const verifiedTeam = matchedPlayer?.newTeam && !keepActualTeam ? teamForCode(matchedPlayer.newTeam) : item.team;
      const report = offseasonContracts.find(entry => (teamAliases[entry.team] || entry.team) === item.team.abbreviation && description.includes(entry.player.toLowerCase()));

      if (!report) return {
        ...item,
        team: verifiedTeam,
        player: playerData,
        verification: { status: 'confirmed', source: 'ESPN public transactions', detail: 'Listed in ESPN transaction feed.' }
      };

      coveredPlayers.add(report.player);
      const player = marketPlayers.get(report.player.toLowerCase());
      return {
        ...item,
        team: verifiedTeam,
        contract: report.contract,
        source: 'espn-2026-buzz',
        player: player ? { id: player.id, name: player.name, headshot: player.headshot } : playerData,
        verification: { status: 'confirmed', source: 'ESPN public transactions', detail: 'Matched in ESPN transaction feed.' }
      };
    });

    const liveReports = (shamsFeed.updates || []).map(update => {
      const text = `${update.headline || ''} ${update.description || ''}`;
      const player = findPlayerInText(text);
      const teamCode = player?.newTeam || teamCodeInText(text) || 'NBA';
      const contract = contractFromText(text);
      return {
        id: `live-report-${update.id}`,
        date: update.published || new Date().toISOString(),
        dateLabel: 'Live report',
        description: update.description || update.headline,
        type: typeFromReport(text),
        source: update.source,
        url: update.url,
        contract,
        player: player ? { id: player.id, name: player.name, headshot: player.headshot } : null,
        team: teamForCode(teamCode),
        verification: verificationFor(player, teamCode === 'NBA' ? null : teamCode, text)
      };
    }).filter(item => item.type !== 'Roster move' && item.player);

    const reported = offseasonContracts.filter(entry => !coveredPlayers.has(entry.player)).map(entry => {
      const team = teamForCode(entry.team);
      const player = marketPlayers.get(entry.player.toLowerCase());
      const playerId = player?.id || entry.playerId;
      return {
        id: `reported-${entry.date}-${entry.team}-${entry.player.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        date: `${entry.date}T12:00:00Z`,
        description: `${entry.type}: ${entry.player}.`,
        type: entry.type,
        source: 'espn-2026-buzz',
        url: entry.source || player?.article || 'https://www.espn.com/nba/nba-free-agency/',
        contract: entry.contract,
        player: { id: playerId, name: entry.player, headshot: player?.headshot || (playerId ? `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png` : null) },
        team,
        verification: player ? verificationFor(player, entry.team, `${entry.type} ${entry.player}`) : { status: 'reported', source: 'Manual fallback', detail: 'Fallback row from saved ESPN/Shams snapshot.' }
      };
    });

    const trades = offseasonTrades.map(entry => {
      const team = teamForCode(entry.team);
      return {
        id: `trade-${entry.date}-${entry.player.id}`,
        date: `${entry.date}T12:00:00Z`,
        description: entry.description,
        type: 'Trade',
        source: 'espn-2026-trade-tracker',
        url: entry.source,
        player: { ...entry.player, headshot: `https://cdn.nba.com/headshots/nba/latest/1040x760/${entry.player.id}.png` },
        team,
        verification: { status: 'confirmed', source: 'NBA trade tracker', detail: 'Saved from official offseason trade tracker.' }
      };
    });

    const statusUpdates = offseasonStatusUpdates.map(entry => {
      const team = teamForCode(entry.team);
      return {
        id: `status-${entry.date}-${entry.player.id}-${entry.type.toLowerCase()}`,
        date: `${entry.date}T12:00:00Z`,
        description: entry.description,
        type: entry.type,
        source: 'manual-offseason-status',
        url: entry.source,
        player: { ...entry.player, headshot: `https://cdn.nba.com/headshots/nba/latest/1040x760/${entry.player.id}.png` },
        team,
        verification: { status: 'confirmed', source: 'Manual status source', detail: 'Status update was manually verified from linked source.' }
      };
    });

    const lateReports = offseasonReportedTransactions.map(entry => {
      const team = teamForCode(entry.team);
      return {
        id: `reported-transaction-${entry.date}-${entry.team}-${entry.player.id}`,
        date: `${entry.date}T12:00:00Z`,
        description: entry.description,
        type: entry.type,
        source: 'manual-offseason-report',
        url: entry.source,
        player: { ...entry.player, headshot: `https://cdn.nba.com/headshots/nba/latest/1040x760/${entry.player.id}.png` },
        team,
        verification: { status: 'reported', source: 'Manual fallback', detail: 'Saved fallback report; live feeds can supersede it.' }
      };
    });

    const text = [...enriched.map(item => item.description.toLowerCase()), ...liveReports.map(item => item.description.toLowerCase()), ...reported.map(item => item.description.toLowerCase()), ...statusUpdates.map(item => item.description.toLowerCase()), ...lateReports.map(item => item.description.toLowerCase())].join('\n');
    const additions = market.players
      .filter(player => player.reconciled && player.newTeam && player.article && player.reportedAt && !text.includes(player.name.toLowerCase()))
      .map(player => ({
        id: `reported-signing-${player.id}-${player.newTeam}`,
        date: player.reportedAt,
        dateLabel: 'Reported',
        description: `${player.articleLabel || 'Reported signing'}: ${player.name}.`,
        type: 'Signed',
        source: 'nba-free-agent-tracker',
        url: player.article,
        player: { id: player.id, name: player.name, headshot: player.headshot },
        team: teamForCode(player.newTeam),
        verification: { status: 'confirmed', source: 'NBA free-agent tracker', detail: `Tracker lists ${player.name} as signed with ${player.newTeam}.` }
      }));
    // A reconciled roster move is current but undated. Keep it immediately below
    // the latest dated report instead of hiding it beneath the full dated feed.
    const tradeNames = new Set([
      ...trades,
      ...lateReports.filter(item => item.type === 'Trade'),
      ...reported.filter(item => String(item.type).toLowerCase().includes('trade'))
    ].map(item => item.player.name.toLowerCase()));
    const deduped = enriched.filter(item => !([...tradeNames].some(name => item.description.toLowerCase().includes(name)) && item.type === 'Trade'));
    const mergeUnique = rows => {
      const seen = new Set();
      return rows.filter(item => {
        const player = normalize(item.player?.name || item.description);
        const day = String(item.date || '').slice(0, 10);
        const key = `${day}|${player}|${item.team.abbreviation}|${String(item.type).toLowerCase().replace('re-signed','signed')}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };
    const transactions = mergeUnique([...liveReports, ...lateReports, ...statusUpdates, ...reported, ...trades, ...additions, ...deduped]).sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
    return {
      ...base,
      count: transactions.length,
      sources: ['ESPN/Shams live headlines', 'ESPN public transactions', 'NBA offseason trackers', 'manual fallbacks'],
      manualVerifiedAt: [offseasonReportedTransactions, offseasonStatusUpdates, offseasonTrades].flat().map(item => item.verifiedAt).filter(Boolean).sort().at(-1) || null,
      transactions
    };
  } catch (_) {
    return base;
  }
}

async function searchableDirectory() {
  if (searchCache && Date.now() - searchCache.time < 600_000) return searchCache.items;
  const [directory, market, board] = await Promise.all([espn.teamsList(), finance.freeAgents().catch(()=>({players:[]})), espn.scoreboard().catch(()=>({games:[]}))]);
  const rosters = await Promise.all(directory.teams.map(async team => { try { return await espn.roster(team.id); } catch (_) { return null; } }));
  const players = new Map();
  for (const roster of rosters.filter(Boolean)) for (const player of roster.players) players.set(String(player.id), { kind:'player', id:player.id, name:player.name, subtitle:`${roster.team.displayName} · ${player.position}`, headshot:player.headshot, teamName:roster.team.displayName, position:player.position });
  const rosterNames=new Set([...players.values()].map(player=>player.name.toLowerCase()));
  for (const player of market.players) if (!players.has(String(player.id))&&!rosterNames.has(player.name.toLowerCase())) players.set(String(player.id), { kind:'player', id:player.id, name:player.name, subtitle:`Free agent · ${player.position}`, headshot:player.headshot, teamName:player.newTeam||player.oldTeam||'NBA free agent', position:player.position });
  const items = [
    ...directory.teams.map(team=>({kind:'team',id:team.id,name:team.displayName,subtitle:team.abbreviation,logo:team.logo})),
    ...players.values(),
    ...(board.games||[]).map(game=>({kind:'game',id:game.id,name:`${game.away.displayName} at ${game.home.displayName}`,subtitle:game.status.detail,away:game.away.abbreviation,home:game.home.abbreviation}))
  ];
  searchCache={time:Date.now(),items}; return items;
}

const server = http.createServer(async (req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/api/health') return json(res, 200, { ok: true, provider: 'espn-site-api' });
  if (urlPath === '/api/search') {
    const query = new URL(req.url, 'http://localhost').searchParams.get('q')?.trim() || '';
    if (query.length < 2 || query.length > 60) return json(res, 400, { error: 'Search must contain 2 to 60 characters' });
    try { const needle=query.toLowerCase(); const results=(await searchableDirectory()).filter(item=>`${item.name} ${item.subtitle}`.toLowerCase().includes(needle)).slice(0,20); return json(res,200,{query,results,retrievedAt:new Date().toISOString()}); }
    catch (error) { return json(res,502,{error:'Search unavailable',detail:error.message}); }
  }
  if (urlPath === '/api/finance/cap') {
    try {
      const season = new URL(req.url, 'http://localhost').searchParams.get('season') || '2026-27';
      return json(res, 200, finance.capOverview(season));
    } catch (error) { return json(res, 400, { error: error.message }); }
  }
  if (urlPath === '/api/finance/payrolls') {
    try { return json(res, 200, await finance.payrolls()); }
    catch (error) { return json(res, 502, { error: 'Payroll source unavailable', detail: error.message }); }
  }
  if (urlPath === '/api/free-agents') {
    try { return json(res, 200, await finance.freeAgents()); }
    catch (error) { return json(res, 502, { error: 'Free-agent tracker unavailable', detail: error.message }); }
  }
  const capHoldMatch = urlPath.match(/^\/api\/finance\/teams\/([A-Z]{3})\/cap-holds$/);
  if (capHoldMatch) {
    try { return json(res, 200, await finance.capHolds(capHoldMatch[1])); }
    catch (error) { return json(res, 502, { error: 'Cap holds unavailable', detail: error.message }); }
  }
  const contractMatch = urlPath.match(/^\/api\/finance\/teams\/([A-Z]{3})\/contracts$/);
  if (contractMatch) {
    try { return json(res, 200, await finance.teamContracts(contractMatch[1])); }
    catch (error) { return json(res, 502, { error: 'Team contracts unavailable', detail: error.message }); }
  }
  if (urlPath === '/api/scoreboard') {
    try {
      const date = new URL(req.url, 'http://localhost').searchParams.get('date') || '';
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json(res, 400, { error: 'Date must be YYYY-MM-DD' });
      return json(res, 200, await espn.scoreboard(date));
    } catch (error) { return json(res, 502, { error: 'Live scoreboard unavailable', detail: error.message }); }
  }
  if (urlPath === '/api/schedule') {
    try {
      const params = new URL(req.url, 'http://localhost').searchParams;
      const start = params.get('start') || '';
      const days = Number(params.get('days') || 7);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return json(res, 400, { error: 'Start date must be YYYY-MM-DD' });
      if (!Number.isInteger(days) || days < 1 || days > 14) return json(res, 400, { error: 'Days must be an integer from 1 to 14' });
      return json(res, 200, await espn.scheduleWindow(start, days));
    } catch (error) { return json(res, 502, { error: 'Schedule unavailable', detail: error.message }); }
  }
  if (urlPath === '/api/standings') {
    try {
      const season = new URL(req.url, 'http://localhost').searchParams.get('season') || '';
      if (season && !/^\d{4}$/.test(season)) return json(res, 400, { error: 'Season must be a four-digit ending year' });
      return json(res, 200, await espn.standings(season));
    } catch (error) { return json(res, 502, { error: 'Live standings unavailable', detail: error.message }); }
  }
  if (urlPath === '/api/playoffs') {
    try {
      const season = new URL(req.url, 'http://localhost').searchParams.get('season') || '';
      if (!/^\d{4}$/.test(season)) return json(res, 400, { error: 'Season must be a four-digit ending year' });
      return json(res, 200, await espn.playoffBracket(season));
    } catch (error) { return json(res, 502, { error: 'Historical playoffs unavailable', detail: error.message }); }
  }
  if (urlPath === '/api/teams') {
    try { return json(res, 200, await espn.teamsList()); }
    catch (error) { return json(res, 502, { error: 'Team directory unavailable', detail: error.message }); }
  }
  const rosterMatch = urlPath.match(/^\/api\/teams\/(\d+)\/roster$/);
  if (rosterMatch) {
    try { return json(res, 200, await espn.roster(rosterMatch[1])); }
    catch (error) { return json(res, 502, { error: 'Roster unavailable', detail: error.message }); }
  }
  if (urlPath === '/api/injuries') {
    try { return json(res, 200, await espn.injuries()); }
    catch (error) { return json(res, 502, { error: 'Injury report unavailable', detail: error.message }); }
  }
  if (urlPath === '/api/transactions') {
    try { return json(res, 200, await transactionsWithRosterReconciliation()); }
    catch (error) { return json(res, 502, { error: 'Transactions unavailable', detail: error.message }); }
  }
  if (urlPath === '/api/shams-updates') {
    try {
      const limit = Number(new URL(req.url, 'http://localhost').searchParams.get('limit') || 12);
      return json(res, 200, await espn.shamsUpdates(limit));
    } catch (error) { return json(res, 502, { error: 'Shams updates unavailable', detail: error.message }); }
  }
  const playerMatch = urlPath.match(/^\/api\/players\/(\d+)$/);
  if (playerMatch) {
    try { return json(res, 200, await espn.playerOverview(playerMatch[1])); }
    catch (error) { return json(res, 502, { error: 'Player profile unavailable', detail: error.message }); }
  }
  const gameMatch = urlPath.match(/^\/api\/games\/(\d+)$/);
  if (gameMatch) {
    try { return json(res, 200, await espn.summary(gameMatch[1])); }
    catch (error) { return json(res, 502, { error: 'Game summary unavailable', detail: error.message }); }
  }
  const requested = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const file = path.resolve(root, requested);
  const relative = path.relative(root, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN' });
    res.end(data);
  });
});

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';
  server.listen(port, host, () => console.log(`Courtside running at http://${host}:${port}`));
}

module.exports = { server };
