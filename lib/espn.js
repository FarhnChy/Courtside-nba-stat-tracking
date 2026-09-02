const BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const releasedSchedule = require('../data/releasedSchedule');
const offseasonShamsUpdates = require('../data/offseasonShamsUpdates');
const cache = new Map();
const nbaTeamIds = { ATL:1610612737,BOS:1610612738,CLE:1610612739,NOP:1610612740,CHI:1610612741,DAL:1610612742,DEN:1610612743,GSW:1610612744,HOU:1610612745,LAC:1610612746,LAL:1610612747,MIA:1610612748,MIL:1610612749,MIN:1610612750,BKN:1610612751,NYK:1610612752,ORL:1610612753,IND:1610612754,PHI:1610612755,PHX:1610612756,POR:1610612757,SAC:1610612758,SAS:1610612759,OKC:1610612760,TOR:1610612761,UTA:1610612762,MEM:1610612763,WAS:1610612764,DET:1610612765,CHA:1610612766 };
const teamAbbreviations = { Hawks:'ATL', Celtics:'BOS', Nets:'BKN', Hornets:'CHA', Bulls:'CHI', Cavaliers:'CLE', Mavericks:'DAL', Nuggets:'DEN', Pistons:'DET', Warriors:'GSW', Rockets:'HOU', Pacers:'IND', Clippers:'LAC', Lakers:'LAL', Grizzlies:'MEM', Heat:'MIA', Bucks:'MIL', Timberwolves:'MIN', Pelicans:'NOP', Knicks:'NYK', Thunder:'OKC', Magic:'ORL', '76ers':'PHI', Suns:'PHX', 'Trail Blazers':'POR', Kings:'SAC', Spurs:'SAS', Raptors:'TOR', Jazz:'UTA', Wizards:'WAS' };
let coachRecordsCache = null;

async function getCdnFallback(url) {
  const parsed = new URL(url);
  const route = parsed.pathname.split('/').at(-1);
  if (!['scoreboard', 'news'].includes(route)) return null;
  const query = new URLSearchParams(parsed.searchParams);
  query.set('xhr', '1');
  const response = await fetch(`https://cdn.espn.com/core/nba/scoreboard?${query}`, {
    headers: { accept: 'application/json, text/plain, */*', referer: 'https://www.espn.com/nba/' },
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) throw new Error(`ESPN CDN returned ${response.status}`);
  const payload = await response.json();
  if (route === 'news') return payload.news || { articles: [] };
  return payload.content?.sbData || null;
}

async function coachRecords() {
  if (coachRecordsCache && Date.now()-coachRecordsCache.time<86_400_000) return coachRecordsCache.data;
  const response = await fetch('https://www.basketball-reference.com/coaches/NBA_stats.html',{headers:{'user-agent':'Courtside/0.2'}});
  if(!response.ok)throw new Error('Coach records unavailable'); const html=await response.text(); const records=new Map();
  for(const match of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)){const row=match[1];const value=key=>row.match(new RegExp(`data-stat="${key}"[^>]*>([\\s\\S]*?)<\\/`))?.[1]?.replace(/<[^>]+>/g,'').trim();const name=value('coach');if(name)records.set(name.toLowerCase(),{years:Number(value('years'))||null,wins:Number(value('wins'))||0,losses:Number(value('losses'))||0,playoffWins:Number(value('wins_playoffs'))||0,playoffLosses:Number(value('losses_playoffs'))||0,titles:Number(value('years_league_champion'))||0});}
  coachRecordsCache={time:Date.now(),data:records};return records;
}

async function getJson(url, ttl = 15_000) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.time < ttl) return hit.data;
  let lastError;
  for (let attempt=0;attempt<2;attempt++) try {
    const response = await fetch(url, { headers: {
      accept: 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9',
      origin: 'https://www.espn.com',
      referer: 'https://www.espn.com/',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'
    }, signal:AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
    const data = await response.json(); cache.set(url, { time: Date.now(), data }); return data;
  } catch (error) { lastError=error; }
  if (hit) return hit.data;
  try {
    const fallback = await getCdnFallback(url);
    if (fallback) { cache.set(url, { time: Date.now(), data: fallback }); return fallback; }
  } catch (error) { lastError = error; }
  throw lastError;
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

function isoDateOffset(start, offset) {
  const [year, month, day] = String(start).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + offset, 12));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function previewTeam(code, homeAway) {
  return { id: code, abbreviation: code, name: code, city: '', displayName: code, color: '#334155', logo: null, score: 0, homeAway, record: '', lineScores: [] };
}

function normalizePreviewGame(game, index) {
  return {
    id: `released-${game.date.slice(0, 10)}-${game.away}-${game.home}-${index}`,
    date: game.date,
    name: `${game.away} at ${game.home}`,
    away: previewTeam(game.away, 'away'),
    home: previewTeam(game.home, 'home'),
    status: { state: 'pre', completed: false, detail: game.label || 'Scheduled', clock: '', period: 0 },
    venue: game.label || '',
    broadcasts: ['Released schedule preview'],
    source: releasedSchedule.source,
    sourceUrl: releasedSchedule.sourceUrl
  };
}

async function scheduleWindow(start, days = 7) {
  const count = Math.max(1, Math.min(14, Number(days) || 7));
  const dates = Array.from({ length: count }, (_, index) => isoDateOffset(start, index));
  const rows = await Promise.all(dates.map(async date => {
    const payload = await scoreboard(date);
    const previewGames = releasedSchedule.games
      .filter(game => game.date.slice(0, 10) === date)
      .map(normalizePreviewGame)
      .filter(game => !payload.games.some(existing => existing.away.abbreviation === game.away.abbreviation && existing.home.abbreviation === game.home.abbreviation));
    const games = [...payload.games, ...previewGames].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    return {
      date,
      count: games.length,
      events: releasedSchedule.events.filter(event => event.date === date),
      games: games.map(game => ({
        id: game.id,
        date: game.date,
        away: game.away,
        home: game.home,
        status: game.status,
        venue: game.venue,
        broadcasts: game.broadcasts,
        source: game.source || 'ESPN public scoreboard',
        sourceUrl: game.sourceUrl || null
      }))
    };
  }));
  return { start, days: rows, retrievedAt: new Date().toISOString(), source: `ESPN public scoreboard + ${releasedSchedule.source}`, sourceUrl: releasedSchedule.sourceUrl, releasedVerifiedAt: releasedSchedule.verifiedAt };
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

async function playoffBracket(season) {
  if (!/^\d{4}$/.test(String(season))) throw new Error('Invalid playoff season');
  const start = `${season}0401`; const end = `${season}0630`;
  const raw = await getJson(`${BASE}/scoreboard?dates=${start}-${end}&seasontype=3&limit=1000`, 3_600_000);
  const series = new Map();
  for (const event of raw.events || []) {
    const competition = event.competitions?.[0] || {};
    const competitors = competition.competitors || [];
    if (competitors.length !== 2) continue;
    const headline = competition.notes?.[0]?.headline || '';
    const round = /NBA Finals/i.test(headline) ? 'NBA Finals'
      : /Conference Finals|^(East|West) Finals/i.test(headline) ? 'Conference Finals'
      : /Semifinals/i.test(headline) ? 'Conference Semifinals'
      : /1st Round/i.test(headline) ? 'First Round'
      : /Play-In/i.test(headline) ? 'Play-In' : null;
    if (!round) continue;
    const conference = /East/i.test(headline) ? 'East' : /West/i.test(headline) ? 'West' : 'NBA';
    const ids = competitors.map(item => String(item.team?.id || '')).sort();
    const key = `${round}:${ids.join(':')}`;
    if (!series.has(key)) series.set(key, { round, conference, headline, teams:competitors.map(item => ({ id:item.team?.id, abbreviation:item.team?.abbreviation, displayName:item.team?.displayName || item.team?.name, logo:item.team?.logo || item.team?.logos?.[0]?.href || null, seed:Number(item.seed || item.curatedRank?.current || 0), wins:0 })), games:0 });
    const row = series.get(key); row.games++;
    const winner = competitors.find(item => item.winner);
    const savedWinner = winner && row.teams.find(item => String(item.id) === String(winner.team?.id));
    if (savedWinner) savedWinner.wins++;
  }
  const rounds = ['Play-In','First Round','Conference Semifinals','Conference Finals','NBA Finals'];
  const rows = [...series.values()].map(row => ({ ...row, winner:row.teams.slice().sort((a,b) => b.wins-a.wins)[0]?.id || null }));
  return { season:`${Number(season)-1}-${String(season).slice(-2)}`, rounds:rounds.map(name => ({ name, series:rows.filter(row => row.round === name) })).filter(round => round.series.length), source:'ESPN public scoreboard' };
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
  const normalized = normalizeRoster(await getJson(`${BASE}/teams/${teamId}/roster`, 300_000));
  const nbaId = nbaTeamIds[normalized.team.abbreviation];
  if (!nbaId) return normalized;
  try {
    const now = new Date(); const start = now.getMonth() < 8 ? now.getFullYear()-1 : now.getFullYear(); const season = `${start}-${String(start+1).slice(-2)}`;
    const url = `https://stats.nba.com/stats/commonteamroster?TeamID=${nbaId}&Season=${season}`;
    const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0', referer: 'https://www.nba.com/' } });
    if (!response.ok) return normalized;
    const raw = await response.json(); const set = raw.resultSets?.find(item=>item.name==='Coaches');
    const index = Object.fromEntries((set?.headers||[]).map((name,i)=>[name,i]));
    let records=new Map();try{records=await coachRecords()}catch(_){}
    normalized.coaches = (set?.rowSet||[]).map(row=>{const name=row[index.COACH_NAME];return { id:String(row[index.COACH_ID]), name, role:row[index.COACH_TYPE]||'Coach', assistant:Number(row[index.IS_ASSISTANT])>1, record:records.get(String(name).toLowerCase())||null, headshot:`https://cdn.nba.com/headshots/nba/latest/1040x760/${row[index.COACH_ID]}.png` }});
  } catch (_) {}
  return normalized;
}

function normalizeInjuries(raw) {
  return { timestamp: raw.timestamp || null, season: raw.season?.displayName || raw.season?.year || '', teams: (raw.injuries || []).map(group => ({
    id: group.id,
    displayName: group.displayName,
    abbreviation: group.team?.abbreviation || group.abbreviation || teamAbbreviations[group.displayName?.replace(/^.*?\s/, '')] || '',
    logo: group.team?.logos?.find(logo => logo.rel?.includes('default'))?.href || group.team?.logos?.[0]?.href || null,
    source: 'ESPN injury report',
    sourceUrl: 'https://www.espn.com/nba/injuries',
    injuries: (group.injuries || []).map(item => ({ id: item.id, athleteId: item.athlete?.id, player: item.athlete?.displayName || 'Unknown player', position: item.athlete?.position?.abbreviation || '-', headshot: item.athlete?.headshot?.href || null, status: item.status || item.type?.description || 'Unknown', abbreviation: item.type?.abbreviation || '', date: item.date || null, shortComment: item.shortComment || '', detail: item.details?.type || item.details?.detail || item.longComment || '', returnDate: item.details?.returnDate || item.expectedReturnDate || null, source: 'ESPN' }))
  })).filter(group => group.injuries.length), source: 'ESPN injury report', sourceUrl: 'https://www.espn.com/nba/injuries' };
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

function normalizeNewsItem(item = {}) {
  const categories = (item.categories || []).map(category => category.description || category.name || category.type || '').filter(Boolean);
  const byline = item.byline || categories.find(value => value.toLowerCase() === 'shams charania') || '';
  const text = `${item.headline || ''} ${item.description || ''} ${byline} ${categories.join(' ')}`.toLowerCase();
  const shams = text.includes('shams charania') || /^shams:/.test(String(item.headline || '').toLowerCase());
  const freeAgency = categories.some(value => /free agency/i.test(value)) || /\b(free agent|free agency|buyout|waiver|waivers|re-sign|signing|agreed|contract|trade|acquire|convert)\b/i.test(text);
  return {
    id: String(item.id || item.nowId || item.contentKey || item.headline || ''),
    published: item.published || item.lastModified || null,
    headline: item.headline || item.linkText || 'ESPN NBA update',
    description: item.description || '',
    byline,
    source: shams ? 'ESPN / Shams Charania' : 'ESPN NBA news',
    url: item.links?.web?.href || item.link || item.url || 'https://www.espn.com/nba/',
    priority: shams ? 0 : freeAgency ? 1 : 2
  };
}

function rosterRelevantNews(item) {
  const text = `${item.headline} ${item.description}`.toLowerCase();
  return /\b(free agent|free agency|sign|signed|signing|re-sign|agreed|contract|trade|trading|acquire|acquired|waive|waived|release|released|buyout|waiver|waivers|convert|converted|option)\b/.test(text);
}

function dedupeNews(updates) {
  const seen = new Set();
  return updates.filter(item => {
    const key = String(item.url || item.headline).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function shamsUpdates(limit = 12) {
  const count = Math.max(1, Math.min(25, Number(limit) || 12));
  try {
    const raw = await getJson(`${BASE}/news?limit=50`, 60_000);
    const live = (raw.articles || []).map(normalizeNewsItem).filter(rosterRelevantNews);
    const updates = dedupeNews([...live, ...offseasonShamsUpdates])
      .sort((a, b) => a.priority - b.priority || (Date.parse(b.published) || 0) - (Date.parse(a.published) || 0))
      .slice(0, count);
    return { source: 'ESPN NBA news API + Shams Charania fallback', retrievedAt: new Date().toISOString(), updates };
  } catch (error) {
    return { source: 'Manual ESPN/Shams fallback', retrievedAt: new Date().toISOString(), error: error.message, updates: offseasonShamsUpdates.slice(0, count) };
  }
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
  const detailedPositions = { '1966': 'SF / PF · versatile across all five positions', '3934672': 'PG / SG' };
  return { ...normalizePlayerOverview(overview), history: normalizePlayerHistory(history), positions: detailedPositions[id] || null };
}

module.exports = { scoreboard, scheduleWindow, summary, standings, playoffBracket, teamsList, roster, injuries, transactions, shamsUpdates, playerOverview, normalizeEvent, normalizeSummary, normalizeStandings, normalizeTeams, normalizeRoster, normalizeInjuries, normalizeTransactions, normalizeNewsItem, normalizePlayerOverview, normalizePlayerHistory };
