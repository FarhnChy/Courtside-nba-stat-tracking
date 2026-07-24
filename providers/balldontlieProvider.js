const demoData = require('../data/demoData');
const { getInjuries, withOverrides } = require('./overrides');

const DEFAULT_BASE_URL = 'https://api.balldontlie.io';
const CACHE_TTL_MS = 60 * 1000;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeStatus(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'final' || value.includes('final')) return 'FINAL';
  if (value.includes(':') || value.includes('qtr') || value.includes('quarter') || value.includes('halftime')) return 'LIVE';
  if (value === 'in progress') return 'LIVE';
  return 'UPCOMING';
}

function normalizeClock(game) {
  const status = normalizeStatus(game.status);
  if (status === 'FINAL') return '0:00';
  if (game.time && game.time !== 'Final') return game.time;
  if (game.datetime) {
    return new Date(game.datetime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York'
    });
  }
  return game.status || 'TBD';
}

function teamRecord(code, fallbackTeams) {
  const game = demoData.games.find((item) => item.away.team === code || item.home.team === code);
  if (!game) return '0-0';
  return game.away.team === code ? game.away.record : game.home.record;
}

function normalizeTeam(team) {
  return {
    code: team.abbreviation,
    name: team.name,
    city: team.city,
    conference: team.conference,
    color: demoData.teams[team.abbreviation]?.color || '#5aa8ff'
  };
}

function normalizePlayer(player) {
  const firstName = player.first_name || '';
  const lastName = player.last_name || '';
  const teamCode = player.team?.abbreviation || '';
  return {
    id: `bdl-player-${player.id}`,
    externalId: String(player.id),
    firstName,
    lastName,
    displayName: `${firstName.charAt(0)}. ${lastName}`.trim(),
    team: teamCode,
    position: player.position || 'NA',
    jersey: player.jersey_number || '',
    height: player.height || '',
    weight: player.weight || '',
    college: player.college || '',
    country: player.country || ''
  };
}

function normalizeGame(game) {
  const awayCode = game.visitor_team.abbreviation;
  const homeCode = game.home_team.abbreviation;
  const status = normalizeStatus(game.status);
  const awayScore = Number.isFinite(game.visitor_team_score) ? game.visitor_team_score : null;
  const homeScore = Number.isFinite(game.home_team_score) ? game.home_team_score : null;
  const homePregameProbability = homeScore === awayScore ? 50 : homeScore > awayScore ? 56 : 44;
  const awayPregameProbability = 100 - homePregameProbability;

  return {
    id: `bdl-${game.id}`,
    externalId: String(game.id),
    date: game.date,
    status,
    period: game.period || null,
    clock: normalizeClock(game),
    arena: 'Arena TBD',
    away: {
      team: awayCode,
      score: awayScore,
      record: teamRecord(awayCode),
      winProbability: status === 'FINAL' ? (awayScore > homeScore ? 100 : 0) : awayPregameProbability
    },
    home: {
      team: homeCode,
      score: homeScore,
      record: teamRecord(homeCode),
      winProbability: status === 'FINAL' ? (homeScore > awayScore ? 100 : 0) : homePregameProbability
    },
    leaders: [],
    injuries: [],
    shots: [],
    plays: []
  };
}

function hybridMeta(details) {
  return {
    source: 'balldontlie',
    provider: 'BALLDONTLIE Sports API',
    generatedAt: new Date().toISOString(),
    dataQuality: 'real-basic-plus-demo-fallback',
    fallback: 'Demo data is used for standings, predictions, shots, injuries, leaders, and missing game days.',
    ...details
  };
}

function fallbackPayload(reason) {
  return withOverrides({
    ...clone(demoData),
    meta: {
      ...clone(demoData.meta),
      configuredProvider: 'balldontlie',
      fallbackReason: reason
    }
  });
}

function createBalldontlieProvider(options = {}) {
  const apiKey = options.apiKey || process.env.BALLDONTLIE_API_KEY || '';
  const baseUrl = options.baseUrl || process.env.BALLDONTLIE_BASE_URL || DEFAULT_BASE_URL;
  const cache = new Map();

  async function request(route) {
    if (!apiKey) {
      const error = new Error('BALLDONTLIE_API_KEY is not set');
      error.code = 'missing_api_key';
      throw error;
    }

    const url = `${baseUrl}${route}`;
    const cached = cache.get(url);
    if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) return cached.body;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: apiKey
      }
    });

    if (!response.ok) {
      const error = new Error(`BALLDONTLIE returned ${response.status}`);
      error.code = 'provider_error';
      error.status = response.status;
      throw error;
    }

    const body = await response.json();
    cache.set(url, { createdAt: Date.now(), body });
    return body;
  }

  async function loadRealBasics(date = process.env.NBA_DATA_DATE || todayIso()) {
    const teamsResponse = await request('/v1/teams');
    const gamesResponse = await request(`/v1/games?dates[]=${encodeURIComponent(date)}&per_page=100`);
    const teams = {};

    for (const item of teamsResponse.data || []) {
      if (item.abbreviation) teams[item.abbreviation] = normalizeTeam(item);
    }

    const normalizedGames = (gamesResponse.data || []).map(normalizeGame);
    return { date, teams, games: normalizedGames };
  }

  async function loadTeams() {
    const response = await request('/v1/teams');
    const teams = {};
    for (const item of response.data || []) {
      if (item.abbreviation) teams[item.abbreviation] = normalizeTeam(item);
    }
    return teams;
  }

  async function loadPlayers(search = '') {
    const query = new URLSearchParams({ per_page: '100' });
    if (search) query.set('search', search);
    const response = await request(`/v1/players?${query.toString()}`);
    return (response.data || []).map(normalizePlayer);
  }

  async function getHybridData(date) {
    try {
      const basics = await loadRealBasics(date);
      const hasGames = basics.games.length > 0;
      return withOverrides({
        ...clone(demoData),
        meta: hybridMeta({
          requestedDate: basics.date,
          realGamesAvailable: hasGames,
          gameFallback: hasGames ? null : 'No BALLDONTLIE games returned for the requested date.'
        }),
        teams: { ...clone(demoData.teams), ...basics.teams },
        games: hasGames ? basics.games : clone(demoData.games)
      });
    } catch (error) {
      return fallbackPayload(error.code || error.message);
    }
  }

  return {
    name: 'balldontlie',

    async getHealth() {
      return {
        ok: true,
        source: apiKey ? 'balldontlie' : 'demo',
        configuredProvider: 'balldontlie',
        hasApiKey: Boolean(apiKey)
      };
    },

    async getBootstrap(options = {}) {
      return getHybridData(options.date);
    },

    async getGames(options = {}) {
      const data = await getHybridData(options.date);
      return { meta: data.meta, teams: data.teams, games: data.games };
    },

    async getTeams() {
      try {
        const teams = await loadTeams();
        return { meta: hybridMeta({ realTeamsAvailable: true }), teams: { ...clone(demoData.teams), ...teams } };
      } catch (error) {
        const data = fallbackPayload(error.code || error.message);
        return { meta: data.meta, teams: data.teams };
      }
    },

    async getPlayers(options = {}) {
      try {
        const teams = await loadTeams();
        const players = await loadPlayers(options.search);
        return {
          meta: hybridMeta({ realPlayersAvailable: true, playerLimit: 100 }),
          teams: { ...clone(demoData.teams), ...teams },
          players: players.length ? players : clone(demoData.players)
        };
      } catch (error) {
        const data = fallbackPayload(error.code || error.message);
        return { meta: data.meta, teams: data.teams, players: data.players };
      }
    },

    async getInjuries(options = {}) {
      return getInjuries(options);
    },

    async getGame(id, options = {}) {
      const data = await getHybridData(options.date);
      const game = data.games.find((item) => item.id === id || item.externalId === id);
      return game ? { meta: data.meta, teams: data.teams, game } : null;
    },

    async getStandings(options = {}) {
      const data = await getHybridData(options.date);
      return { meta: data.meta, teams: data.teams, standings: data.standings };
    },

    async getPredictions(options = {}) {
      const data = await getHybridData(options.date);
      return { meta: data.meta, teams: data.teams, predictions: data.predictions, futures: data.futures };
    }
  };
}

module.exports = { createBalldontlieProvider };
