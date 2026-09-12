const demoData = require('../data/demoData');
const { getInjuries: getManualInjuries, withOverrides } = require('./overrides');

const DEFAULT_SITE_BASE_URL = 'https://site.api.espn.com/apis';
const DEFAULT_CDN_BASE_URL = 'https://cdn.espn.com/core/nba';
const CACHE_TTL_MS = 30 * 1000;
const SLOW_CACHE_TTL_MS = 10 * 60 * 1000;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function easternIsoDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function toEspnDate(isoDate) {
  return String(isoDate || easternIsoDate()).replaceAll('-', '');
}

function toEasternClock(dateText, timeValid = true) {
  if (!timeValid) return 'TBD';
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return 'TBD';
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York'
  });
}

function scoreNumber(value, status) {
  const score = Number(value);
  if (Number.isFinite(score)) return score;
  return status === 'UPCOMING' ? null : 0;
}

function normalizeStatus(status) {
  const state = status?.type?.state;
  if (state === 'in') return 'LIVE';
  if (state === 'post' || status?.type?.completed) return 'FINAL';
  return 'UPCOMING';
}

function normalizeClock(event, competition, status) {
  const statusBlock = competition?.status || event?.status || {};
  if (status === 'FINAL') return '0:00';
  if (status === 'LIVE') return statusBlock.displayClock || statusBlock.type?.shortDetail || 'LIVE';
  return toEasternClock(competition?.date || event?.date, competition?.timeValid !== false);
}

function normalizeRecord(competitor) {
  const record = (competitor?.records || []).find((item) => item.type === 'total') || competitor?.records?.[0];
  return record?.summary || '0-0';
}

function normalizeTeam(team) {
  const code = team?.abbreviation || team?.shortDisplayName || team?.displayName || 'NBA';
  const known = demoData.teams[code] || {};
  return {
    code,
    espnId: team?.id ? String(team.id) : undefined,
    name: team?.name || known.name || code,
    city: team?.location || known.city || '',
    conference: known.conference || team?.groups?.abbreviation || '',
    color: `#${team?.color || known.color?.replace('#', '') || '5aa8ff'}`,
    alternateColor: team?.alternateColor ? `#${team.alternateColor}` : known.alternateColor,
    logo: team?.logo || team?.logos?.[0]?.href || known.logo
  };
}

function normalizeWinProbability(game, awayScore, homeScore, status) {
  if (status === 'FINAL') {
    return {
      away: awayScore > homeScore ? 100 : 0,
      home: homeScore > awayScore ? 100 : 0
    };
  }

  const probabilities = game?.winprobability || game?.winProbability || [];
  const latest = Array.isArray(probabilities) ? probabilities.at(-1) : null;
  const homeProbability = Number(latest?.homeWinPercentage ?? latest?.homeWinPercent);
  if (Number.isFinite(homeProbability)) {
    const home = Math.round(homeProbability <= 1 ? homeProbability * 100 : homeProbability);
    return { away: 100 - home, home };
  }

  if (status === 'LIVE') {
    const margin = Math.max(-25, Math.min(25, homeScore - awayScore));
    const home = Math.round(50 + margin * 1.6);
    return { away: 100 - home, home };
  }

  return { away: 50, home: 50 };
}

function normalizeGame(event, summary = null, injuries = []) {
  const competition = event?.competitions?.[0] || summary?.header?.competitions?.[0] || {};
  const competitors = competition.competitors || [];
  const home = competitors.find((item) => item.homeAway === 'home') || competitors[0] || {};
  const away = competitors.find((item) => item.homeAway === 'away') || competitors[1] || {};
  const status = normalizeStatus(competition.status || event.status);
  const awayScore = scoreNumber(away.score, status);
  const homeScore = scoreNumber(home.score, status);
  const probability = normalizeWinProbability(summary || event, awayScore || 0, homeScore || 0, status);

  return {
    id: `espn-${event.id || competition.id}`,
    externalId: String(event.id || competition.id || ''),
    date: event.date || competition.date || '',
    status,
    period: competition.status?.period || event.status?.period || null,
    clock: normalizeClock(event, competition, status),
    arena: competition.venue?.fullName || 'Arena TBD',
    away: {
      team: away.team?.abbreviation || 'AWAY',
      score: awayScore,
      record: normalizeRecord(away),
      winProbability: probability.away
    },
    home: {
      team: home.team?.abbreviation || 'HOME',
      score: homeScore,
      record: normalizeRecord(home),
      winProbability: probability.home
    },
    leaders: normalizeLeaders(summary || event),
    injuries,
    shots: [],
    plays: normalizePlays(summary)
  };
}

function normalizeLeaders(payload) {
  const leaders = [];
  const boxPlayers = payload?.boxscore?.players || [];

  for (const teamBlock of boxPlayers) {
    const code = teamBlock.team?.abbreviation;
    for (const group of teamBlock.statistics || []) {
      for (const athlete of group.athletes || []) {
        const totals = athlete.stats || [];
        const pointIndex = group.labels?.findIndex((label) => String(label).toLowerCase() === 'pts');
        const points = Number(totals[pointIndex >= 0 ? pointIndex : totals.length - 1]);
        if (!Number.isFinite(points)) continue;
        leaders.push({
          player: athlete.athlete?.shortName || athlete.athlete?.displayName || 'Player',
          team: code || '',
          position: athlete.athlete?.position?.abbreviation || '',
          points
        });
      }
    }
  }

  if (leaders.length) {
    return leaders
      .sort((a, b) => b.points - a.points)
      .slice(0, 3);
  }

  const competitionLeaders = payload?.competitions?.[0]?.leaders || payload?.leaders || [];
  for (const group of competitionLeaders) {
    for (const leader of group.leaders || []) {
      leaders.push({
        player: leader.athlete?.shortName || leader.athlete?.displayName || 'Player',
        team: leader.team?.abbreviation || '',
        position: leader.athlete?.position?.abbreviation || group.abbreviation || '',
        points: Number(leader.value) || 0
      });
    }
  }

  return leaders.slice(0, 3);
}

function normalizePlays(summary) {
  const plays = summary?.plays || summary?.gamepackageJSON?.plays || [];
  if (!Array.isArray(plays)) return [];

  return plays
    .slice(-20)
    .reverse()
    .map((play) => ({
      clock: play.clock?.displayValue || play.displayClock || play.clock || '',
      player: play.participants?.[0]?.athlete?.shortName || '',
      text: play.text || play.shortText || play.type?.text || 'Game event'
    }))
    .filter((play) => play.text);
}

function normalizeInjury(item, teamCode = '') {
  const athlete = item.athlete || item.player || item;
  const status = item.status || item.type || item.detail || item.description || 'UPDATE';
  return {
    player: athlete?.shortName || athlete?.displayName || athlete?.fullName || item.name || 'Player',
    team: item.team?.abbreviation || teamCode,
    position: athlete?.position?.abbreviation || item.position?.abbreviation || '',
    status: String(status).toUpperCase().slice(0, 16),
    detail: item.detail || item.description || item.comment || '',
    source: 'ESPN',
    updatedAt: item.date || new Date().toISOString()
  };
}

function normalizePlayer(item, teamCode = '') {
  const athlete = item.athlete || item;
  const name = athlete.displayName || athlete.fullName || `${athlete.firstName || ''} ${athlete.lastName || ''}`.trim();
  return {
    id: `espn-player-${athlete.id}`,
    externalId: String(athlete.id || ''),
    firstName: athlete.firstName || name.split(' ')[0] || '',
    lastName: athlete.lastName || name.split(' ').slice(1).join(' '),
    displayName: athlete.shortName || name,
    team: teamCode || athlete.team?.abbreviation || '',
    position: athlete.position?.abbreviation || athlete.position?.name || '',
    jersey: athlete.jersey || '',
    height: athlete.displayHeight || athlete.height || '',
    weight: athlete.displayWeight || athlete.weight || '',
    college: athlete.college?.name || '',
    country: athlete.birthPlace?.country || ''
  };
}

function normalizeCoach(item, teamCode = '') {
  const name = item.displayName || item.fullName || `${item.firstName || ''} ${item.lastName || ''}`.trim();
  return {
    id: `espn-coach-${item.id || teamCode}`,
    externalId: String(item.id || ''),
    displayName: name || 'Coach',
    firstName: item.firstName || '',
    lastName: item.lastName || '',
    team: teamCode,
    experience: item.experience || item.displayExperience || '',
    source: 'ESPN'
  };
}

function normalizeStat(stats, names) {
  const wanted = new Set(names);
  const stat = (stats || []).find((item) => wanted.has(item.name) || wanted.has(item.abbreviation));
  return stat?.displayValue || stat?.value || '';
}

function normalizeStandingsGroup(group, fallbackName = '') {
  const name = group.name || group.displayName || fallbackName;
  const entries = group.standings?.entries || group.entries || [];
  const label = /west/i.test(name) ? 'West' : 'East';

  return {
    label,
    rows: entries.map((entry) => {
      const team = entry.team || {};
      return {
        team: team.abbreviation || team.shortDisplayName || '',
        wins: Number(normalizeStat(entry.stats, ['wins', 'W'])) || 0,
        losses: Number(normalizeStat(entry.stats, ['losses', 'L'])) || 0,
        pct: String(normalizeStat(entry.stats, ['winPercent', 'PCT']) || '.000').replace(/^0/, ''),
        gb: normalizeStat(entry.stats, ['gamesBehind', 'GB']) || '-',
        last10: normalizeStat(entry.stats, ['lastTenGames', 'L10']) || '-'
      };
    }).filter((row) => row.team)
  };
}

function playerFromTransactionText(text) {
  const match = String(text || '').match(/^(?:Re-signed|Signed|Waived|Released|Acquired|Traded|Claimed|Assigned|Recalled)\s+(?:[A-Z]{1,2}\s+)?(.+?)(?:\s+to\s+a\s+contract|\s+from|\s+to|\s+for|\.|$)/i);
  return match ? match[1].trim() : '';
}

function normalizeTransaction(item) {
  const text = item.description || item.text || item.headline || item.type?.description || '';
  const player = item.athlete?.displayName || item.athlete?.shortName || playerFromTransactionText(text);
  return {
    id: String(item.id || `${item.date || ''}-${text}`),
    date: item.date || item.effectiveDate || '',
    team: item.team?.abbreviation || '',
    type: item.type?.description || item.type || '',
    player,
    category: item.type?.description || item.type || 'Transaction',
    text,
    source: 'ESPN',
    sourceUrl: 'https://www.espn.com/nba/transactions'
  };
}

function espnMeta(details = {}) {
  return {
    source: 'espn',
    provider: 'ESPN public endpoints',
    generatedAt: new Date().toISOString(),
    dataQuality: 'real-public-plus-demo-fallback',
    fallback: 'Demo data is used for predictions, futures, shot charts until NBA.com shot data is connected, and any ESPN gaps.',
    ...details
  };
}

function fallbackPayload(reason) {
  return withOverrides({
    ...clone(demoData),
    meta: {
      ...clone(demoData.meta),
      configuredProvider: 'espn',
      fallbackReason: reason
    }
  });
}

function createEspnProvider(options = {}) {
  const siteBaseUrl = options.siteBaseUrl || process.env.ESPN_SITE_BASE_URL || DEFAULT_SITE_BASE_URL;
  const cdnBaseUrl = options.cdnBaseUrl || process.env.ESPN_CDN_BASE_URL || DEFAULT_CDN_BASE_URL;
  const cache = new Map();

  async function request(url, ttl = CACHE_TTL_MS) {
    const cached = cache.get(url);
    if (cached && Date.now() - cached.createdAt < ttl) return cached.body;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Courtside/0.1 local project'
      }
    });

    if (!response.ok) {
      const error = new Error(`ESPN returned ${response.status}`);
      error.code = 'provider_error';
      error.status = response.status;
      throw error;
    }

    const body = await response.json();
    cache.set(url, { createdAt: Date.now(), body });
    return body;
  }

  function sitePath(path) {
    return `${siteBaseUrl}${path}`;
  }

  async function loadScoreboard(date, allowDefaultFallback = false) {
    const url = sitePath(`/site/v2/sports/basketball/nba/scoreboard?dates=${toEspnDate(date)}`);
    const scoreboard = await request(url);
    if ((scoreboard.events || []).length || !allowDefaultFallback) return scoreboard;

    const defaultScoreboard = await request(sitePath('/site/v2/sports/basketball/nba/scoreboard'));
    return { ...defaultScoreboard, requestedDateHadNoGames: true };
  }

  async function loadSummary(eventId) {
    return request(sitePath(`/site/v2/sports/basketball/nba/summary?event=${encodeURIComponent(eventId)}`));
  }

  async function loadCdnGame(eventId) {
    try {
      return await request(`${cdnBaseUrl}/game?xhr=1&gameId=${encodeURIComponent(eventId)}`);
    } catch (_error) {
      return null;
    }
  }

  async function loadTeams() {
    const payload = await request(sitePath('/site/v2/sports/basketball/nba/teams'), SLOW_CACHE_TTL_MS);
    const teams = {};
    const rows = payload.sports?.[0]?.leagues?.[0]?.teams || payload.teams || [];
    for (const item of rows) {
      const team = normalizeTeam(item.team || item);
      if (team.code) teams[team.code] = team;
    }
    return { ...clone(demoData.teams), ...teams };
  }

  async function loadTeamInjuries(teamId, teamCode) {
    if (!teamId) return [];
    try {
      const payload = await request(sitePath(`/site/v2/sports/basketball/nba/teams/${teamId}/injuries`), SLOW_CACHE_TTL_MS);
      const rows = payload.injuries || payload.athletes || payload.items || [];
      return rows.map((item) => normalizeInjury(item, teamCode));
    } catch (_error) {
      return [];
    }
  }

  async function injuriesForGame(event) {
    const competitors = event?.competitions?.[0]?.competitors || [];
    const injuries = await Promise.all(competitors.map((competitor) => {
      return loadTeamInjuries(competitor.team?.id, competitor.team?.abbreviation);
    }));
    return injuries.flat();
  }

  async function loadRosters(search = '') {
    const teams = await loadTeams();
    const rows = await Promise.all(Object.values(teams)
      .filter((team) => team.espnId)
      .map(async (team) => {
        try {
          const payload = await request(sitePath(`/site/v2/sports/basketball/nba/teams/${team.espnId}/roster`), SLOW_CACHE_TTL_MS);
          const groups = payload.athletes || [];
          const athletes = groups.flatMap((group) => group.items || group.athletes || [group]);
          return athletes.map((item) => normalizePlayer(item, team.code));
        } catch (_error) {
          return [];
        }
      }));
    const query = search.trim().toLowerCase();
    const allPlayers = rows.flat();
    const players = allPlayers.filter((player) => {
      return !query || player.displayName.toLowerCase().includes(query) || player.lastName.toLowerCase().includes(query);
    });
    return allPlayers.length ? players : clone(demoData.players);
  }

  async function loadCoaches() {
    const teams = await loadTeams();
    const rows = await Promise.all(Object.values(teams)
      .filter((team) => team.espnId)
      .map(async (team) => {
        try {
          const payload = await request(sitePath(`/site/v2/sports/basketball/nba/teams/${team.espnId}/roster`), SLOW_CACHE_TTL_MS);
          return payload.coach ? normalizeCoach(payload.coach, team.code) : null;
        } catch (_error) {
          return null;
        }
      }));
    return rows.filter(Boolean);
  }

  async function loadStandings() {
    const season = process.env.NBA_DATA_SEASON || new Date().getFullYear();
    const url = sitePath(`/v2/sports/basketball/nba/standings?region=us&lang=en&contentorigin=espn&type=0&level=1&sort=winpercent%3Adesc%2Cwins%3Adesc%2Cgamesbehind%3Aasc&season=${season}`);
    const payload = await request(url, SLOW_CACHE_TTL_MS);
    const standings = { East: [], West: [] };
    const groups = payload.children || payload.groups || [];

    if (groups.length) {
      for (const group of groups) {
        const normalized = normalizeStandingsGroup(group);
        standings[normalized.label] = normalized.rows;
      }
    } else {
      const normalized = normalizeStandingsGroup(payload, 'East');
      standings[normalized.label] = normalized.rows;
    }

    return standings.East.length || standings.West.length ? standings : clone(demoData.standings);
  }

  async function loadTransactions(team = '') {
    const payload = await request(sitePath('/site/v2/sports/basketball/nba/transactions'), SLOW_CACHE_TTL_MS);
    const rows = payload.transactions || payload.items || payload.events || [];
    const teamCode = team.toUpperCase();
    return rows
      .map(normalizeTransaction)
      .filter((item) => item.text)
      .filter((item) => !teamCode || item.team === teamCode);
  }

  async function getHybridData(date, allowDefaultFallback = false) {
    try {
      const scoreboard = await loadScoreboard(date, allowDefaultFallback);
      const teamsFromScores = {};
      for (const event of scoreboard.events || []) {
        for (const competitor of event.competitions?.[0]?.competitors || []) {
          const team = normalizeTeam(competitor.team);
          teamsFromScores[team.code] = team;
        }
      }

      const gameInjuries = await Promise.all((scoreboard.events || []).map(injuriesForGame));
      const games = (scoreboard.events || []).map((event, index) => normalizeGame(event, null, gameInjuries[index] || []));
      const standings = await loadStandings().catch(() => clone(demoData.standings));

      return withOverrides({
        ...clone(demoData),
        meta: espnMeta({
          requestedDate: date || easternIsoDate(),
          providerDate: scoreboard.day?.date,
          requestedDateHadNoGames: Boolean(scoreboard.requestedDateHadNoGames),
          realGamesAvailable: games.length > 0
        }),
        teams: { ...clone(demoData.teams), ...teamsFromScores },
        games: games.length ? games : clone(demoData.games),
        standings
      });
    } catch (error) {
      return fallbackPayload(error.code || error.message);
    }
  }

  return {
    name: 'espn',

    async getHealth() {
      return { ok: true, source: 'espn', configuredProvider: 'espn', requiresApiKey: false };
    },

    async getBootstrap(options = {}) {
      const data = await getHybridData(options.date, true);
      const transactions = await loadTransactions().catch(() => clone(demoData.transactions));
      return { ...data, transactions };
    },

    async getGames(options = {}) {
      const data = await getHybridData(options.date, false);
      return { meta: data.meta, teams: data.teams, games: data.games };
    },

    async getTeams() {
      try {
        return { meta: espnMeta({ realTeamsAvailable: true }), teams: await loadTeams() };
      } catch (error) {
        const data = fallbackPayload(error.code || error.message);
        return { meta: data.meta, teams: data.teams };
      }
    },

    async getPlayers(options = {}) {
      try {
        return { meta: espnMeta({ realPlayersAvailable: true }), teams: await loadTeams(), players: await loadRosters(options.search || '') };
      } catch (error) {
        const data = fallbackPayload(error.code || error.message);
        return { meta: data.meta, teams: data.teams, players: data.players };
      }
    },

    async getInjuries(options = {}) {
      return getManualInjuries(options);
    },

    async getGame(id) {
      const eventId = String(id).replace(/^espn-/, '');
      try {
        const summary = await loadSummary(eventId);
        const cdn = await loadCdnGame(eventId);
        const event = summary.header || summary;
        const game = normalizeGame(event, { ...summary, gamepackageJSON: cdn?.gamepackageJSON });
        return withOverrides({ meta: espnMeta({ eventId }), teams: await loadTeams(), game });
      } catch (error) {
        const data = await getHybridData(process.env.NBA_DATA_DATE || easternIsoDate(), true);
        const game = data.games.find((item) => item.id === id || item.externalId === eventId);
        return game ? { meta: data.meta, teams: data.teams, game } : null;
      }
    },

    async getStandings() {
      try {
        return { meta: espnMeta({ realStandingsAvailable: true }), teams: await loadTeams(), standings: await loadStandings() };
      } catch (error) {
        const data = fallbackPayload(error.code || error.message);
        return { meta: data.meta, teams: data.teams, standings: data.standings };
      }
    },

    async getPredictions(options = {}) {
      const data = await getHybridData(options.date, true);
      return { meta: data.meta, teams: data.teams, predictions: data.predictions, futures: data.futures };
    },

    async getTransactions(options = {}) {
      try {
        return { meta: espnMeta({ realTransactionsAvailable: true }), transactions: await loadTransactions(options.team || '') };
      } catch (error) {
        const team = options.team?.toUpperCase();
        const transactions = demoData.transactions.filter((move) => !team || move.team === team);
        return { meta: espnMeta({ fallbackReason: error.code || error.message }), transactions: clone(transactions) };
      }
    },

    async getCoaches() {
      try {
        return { meta: espnMeta({ realCoachesAvailable: true }), coaches: await loadCoaches() };
      } catch (error) {
        return { meta: espnMeta({ fallbackReason: error.code || error.message }), coaches: [] };
      }
    }
  };
}

module.exports = { createEspnProvider };
