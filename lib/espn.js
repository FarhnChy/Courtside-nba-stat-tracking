const BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const cache = new Map();

async function getJson(url, ttl = 15_000) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.time < ttl) return hit.data;
  const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'Courtside/0.2' } });
  if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
  const data = await response.json();
  cache.set(url, { time: Date.now(), data });
  return data;
}

function team(competitor = {}) {
  const t = competitor.team || {};
  return { id: t.id, abbreviation: t.abbreviation || 'TBD', name: t.name || 'TBD', city: t.location || '', displayName: t.displayName || t.name || 'TBD', color: `#${t.color || '334155'}`, logo: t.logo || null, score: Number(competitor.score || 0), homeAway: competitor.homeAway, record: competitor.records?.[0]?.summary || '', lineScores: (competitor.linescores || []).map((line,index) => ({ period: index + 1, value: Number(line.value || line.displayValue || 0) })) };
}

function normalizeEvent(event) {
  const competition = event.competitions?.[0] || {};
  const competitors = competition.competitors || [];
  return { id: event.id, date: event.date, name: event.name, away: team(competitors.find(x => x.homeAway === 'away')), home: team(competitors.find(x => x.homeAway === 'home')), status: { state: event.status?.type?.state || 'pre', completed: !!event.status?.type?.completed, detail: event.status?.type?.shortDetail || event.status?.type?.detail || '', clock: event.status?.displayClock || '', period: event.status?.period || 0 }, venue: competition.venue?.fullName || '', broadcasts: (competition.broadcasts || []).flatMap(x => x.names || []) };
}

function normalizeSummary(raw) {
  const competition = raw.header?.competitions?.[0] || {};
  const event = { id: raw.header?.id, date: competition.date, competitions: [competition], status: competition.status };
  const boxscore = (raw.boxscore?.players || []).map(group => ({ team: team({ team: group.team }), sections: (group.statistics || []).map(section => ({ name: section.name, labels: section.labels || [], athletes: (section.athletes || []).map(row => ({ id: row.athlete?.id, name: row.athlete?.displayName || row.athlete?.shortName || 'Player', position: row.athlete?.position?.abbreviation || '', headshot: row.athlete?.headshot?.href || null, jersey: row.athlete?.jersey || '', starter: !!row.starter, didNotPlay: !!row.didNotPlay, stats: (row.stats || []).map(value => value == null ? '-' : String(value)) })) })) }));
  const teamStats = (raw.boxscore?.teams || []).map(group => ({ team: team({ team: group.team }), stats: (group.statistics || []).map(x => ({ name: x.name, label: x.label || x.displayName || x.name, value: String(x.displayValue ?? x.value ?? '-') })) }));
  const plays = (raw.plays || []).slice(-120).reverse().map(play => ({ id: play.id, clock: play.clock?.displayValue || '', period: play.period?.number || 0, text: play.text || '', homeScore: play.homeScore, awayScore: play.awayScore, scoring: !!play.scoringPlay, shooting: !!play.shootingPlay, coordinate: play.coordinate || null }));
  return { game: normalizeEvent(event), boxscore, teamStats, plays, leaders: raw.leaders || [], injuries: raw.injuries || [] };
}

async function scoreboard(date) {
  const query = date ? `?dates=${date.replaceAll('-', '')}&limit=100` : '?limit=100';
  const raw = await getJson(`${BASE}/scoreboard${query}`);
  return { date: raw.day?.date || date, season: raw.leagues?.[0]?.season?.displayName || '', games: (raw.events || []).map(normalizeEvent) };
}

async function summary(id) {
  if (!/^\d{6,12}$/.test(id)) throw new Error('Invalid game id');
  return normalizeSummary(await getJson(`${BASE}/summary?event=${id}`));
}

function normalizeStandings(raw) {
  const stat = (entry, name) => entry.stats?.find(item => item.name === name || item.type === name);
  const conferences = (raw.children || []).map(group => ({
    id: group.name?.toLowerCase().includes('east') ? 'east' : 'west',
    name: group.name,
    teams: (group.standings?.entries || []).map(entry => ({
      id: entry.team?.id, abbreviation: entry.team?.abbreviation || 'TBD', displayName: entry.team?.displayName || entry.team?.name || 'TBD',
      logo: entry.team?.logos?.find(logo => logo.rel?.includes('default'))?.href || entry.team?.logos?.[0]?.href || null,
      seed: Number(stat(entry, 'playoffSeed')?.value || 0), wins: Number(stat(entry, 'wins')?.value || 0), losses: Number(stat(entry, 'losses')?.value || 0),
      pct: stat(entry, 'winPercent')?.displayValue || '-', gb: stat(entry, 'gamesBehind')?.displayValue || '-', home: stat(entry, 'home')?.displayValue || '-',
      away: stat(entry, 'road')?.displayValue || '-', conference: stat(entry, 'vsconf')?.displayValue || '-', lastTen: stat(entry, 'lasttengames')?.displayValue || '-',
      streak: stat(entry, 'streak')?.displayValue || '-', differential: stat(entry, 'differential')?.displayValue || '-'
    })).sort((a, b) => a.seed - b.seed)
  }));
  return { season: raw.season?.displayName || raw.season?.year || '', conferences };
}

async function standings(season) {
  const query = season ? `?season=${season}` : '';
  return normalizeStandings(await getJson(`https://site.api.espn.com/apis/v2/sports/basketball/nba/standings${query}`, 60_000));
}

function normalizeTeams(raw) {
  return (raw.sports?.[0]?.leagues?.[0]?.teams || []).map(item => item.team || item).map(item => ({
    id: item.id, abbreviation: item.abbreviation, displayName: item.displayName, name: item.name, location: item.location,
    color: `#${item.color || '334155'}`, logo: item.logos?.find(logo => logo.rel?.includes('default'))?.href || item.logos?.[0]?.href || null
  })).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

async function teamsList() {
  return { teams: normalizeTeams(await getJson(`${BASE}/teams?limit=40`, 3_600_000)) };
}

function normalizeRoster(raw) {
  return {
    timestamp: raw.timestamp || null,
    team: { id: raw.team?.id, abbreviation: raw.team?.abbreviation, displayName: raw.team?.displayName || raw.team?.name, logo: raw.team?.logos?.[0]?.href || raw.team?.logo || null },
    coaches: (raw.coach || []).map(coach => ({ id: coach.id, name: coach.displayName || [coach.firstName, coach.lastName].filter(Boolean).join(' '), experience: coach.experience })),
    players: (raw.athletes || []).map(player => ({
      id: player.id, name: player.displayName, jersey: player.jersey || '-', position: player.position?.abbreviation || '-', headshot: player.headshot?.href || null,
      age: player.age ?? '-', height: player.displayHeight || '-', weight: player.displayWeight || '-', experience: player.experience?.years ?? '-', college: player.college?.name || '-',
      status: player.status?.name || 'Active', injuries: (player.injuries || []).map(injury => ({ status: injury.status, date: injury.date }))
    }))
  };
}

async function roster(teamId) {
  if (!/^\d{1,3}$/.test(teamId)) throw new Error('Invalid team id');
  return normalizeRoster(await getJson(`${BASE}/teams/${teamId}/roster`, 300_000));
}

function normalizeInjuries(raw) {
  return { timestamp: raw.timestamp || null, season: raw.season?.displayName || raw.season?.year || '', teams: (raw.injuries || []).map(group => ({
    id: group.id, displayName: group.displayName,
    injuries: (group.injuries || []).map(item => ({ id: item.id, athleteId: item.athlete?.id, player: item.athlete?.displayName || 'Unknown player', position: item.athlete?.position?.abbreviation || '-', headshot: item.athlete?.headshot?.href || null, status: item.status || item.type?.description || 'Unknown', abbreviation: item.type?.abbreviation || '', date: item.date || null, shortComment: item.shortComment || '', detail: item.details?.type || item.details?.detail || '', returnDate: item.details?.returnDate || null }))
  })).filter(group => group.injuries.length) };
}

async function injuries() {
  return normalizeInjuries(await getJson(`${BASE}/injuries`, 120_000));
}

function transactionType(description = '') {
  const text = description.toLowerCase();
  if (text.includes('trade') || text.includes('acquired')) return 'Trade';
  if (text.includes('waive')) return 'Waived';
  if (text.includes('re-sign')) return 'Re-signed';
  if (text.includes('sign')) return 'Signed';
  if (text.includes('release')) return 'Released';
  if (text.includes('convert')) return 'Converted';
  if (text.includes('exercise')) return 'Option';
  return 'Roster move';
}

function normalizeTransactions(raw) {
  return { timestamp: raw.timestamp || null, season: raw.season?.displayName || raw.season?.year || '', count: raw.count || 0, transactions: (raw.transactions || []).map((item, index) => ({
    id: `${item.date || 'unknown'}-${item.team?.id || 'league'}-${index}`, date: item.date || null, description: item.description || 'Transaction details unavailable', type: transactionType(item.description),
    url: item.team?.abbreviation ? `https://www.espn.com/nba/team/transactions/_/name/${item.team.abbreviation.toLowerCase()}` : 'https://www.espn.com/nba/transactions',
    team: { id: item.team?.id, abbreviation: item.team?.abbreviation || 'NBA', displayName: item.team?.displayName || 'League transaction', color: `#${item.team?.color || '334155'}`, logo: item.team?.logos?.find(logo => logo.rel?.includes('default'))?.href || item.team?.logos?.[0]?.href || null }
  })) };
}

async function transactions() {
  return normalizeTransactions(await getJson(`${BASE}/transactions?limit=100`, 60_000));
}

function normalizePlayerOverview(raw) {
  const statistics = raw.statistics || {};
  return { stats: (statistics.splits || []).map(split => ({ label: split.displayName, values: Object.fromEntries((statistics.labels || []).map((label,index)=>[label, split.stats?.[index] ?? '-'])) })), awards: (raw.awards || []).map(award => ({ name: award.name, count: award.displayCount || '', seasons: award.seasons || [] })), news: (raw.news || []).slice(0, 5).map(item => ({ id: item.id, headline: item.headline || item.linkText, description: item.description || '', published: item.published || item.lastModified, image: item.images?.[0]?.url || null, url: item.links?.web?.href || null })) };
}

function normalizePlayerHistory(raw) {
  const category = (raw.categories || []).find(item => item.displayName === 'Regular Season Averages') || raw.categories?.[0];
  if (!category) return [];
  const teams = Object.values(raw.teams || {});
  return (category.statistics || []).map(row => ({
    season: row.season?.displayName || String(row.season?.year || ''),
    team: teams.find(team => String(team.id) === String(row.teamId))?.abbreviation || row.teamSlug || '-',
    values: Object.fromEntries((category.labels || []).map((label,index) => [label, row.stats?.[index] ?? '-']))
  }));
}

async function playerOverview(id) {
  if (!/^\d{1,10}$/.test(id)) throw new Error('Invalid player id');
  const root = `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${id}`;
  const [overview, history] = await Promise.all([getJson(`${root}/overview`, 300_000), getJson(`${root}/stats`, 300_000)]);
  return { ...normalizePlayerOverview(overview), history: normalizePlayerHistory(history) };
}

module.exports = { scoreboard, summary, standings, teamsList, roster, injuries, transactions, playerOverview, normalizeEvent, normalizeSummary, normalizeStandings, normalizeTeams, normalizeRoster, normalizeInjuries, normalizeTransactions, normalizePlayerOverview, normalizePlayerHistory };
