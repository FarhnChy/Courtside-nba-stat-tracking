const crypto = require('node:crypto');
const path = require('node:path');
const { createStore } = require('./fantasy-store');

const MOVEMENT_URL = 'https://stats.nba.com/js/data/playermovement/NBA_Player_Movement.json';
// NBA and ESPN use different team IDs. Keep filters consistent with the rest of Courtside.
const TEAMS = [
  ['hawks',1610612737,1,'ATL','Atlanta Hawks'], ['celtics',1610612738,2,'BOS','Boston Celtics'],
  ['nets',1610612751,17,'BKN','Brooklyn Nets'], ['hornets',1610612766,30,'CHA','Charlotte Hornets'],
  ['bulls',1610612741,4,'CHI','Chicago Bulls'], ['cavaliers',1610612739,5,'CLE','Cleveland Cavaliers'],
  ['mavericks',1610612742,6,'DAL','Dallas Mavericks'], ['nuggets',1610612743,7,'DEN','Denver Nuggets'],
  ['pistons',1610612765,8,'DET','Detroit Pistons'], ['warriors',1610612744,9,'GS','Golden State Warriors'],
  ['rockets',1610612745,10,'HOU','Houston Rockets'], ['pacers',1610612754,11,'IND','Indiana Pacers'],
  ['clippers',1610612746,12,'LAC','LA Clippers'], ['lakers',1610612747,13,'LAL','Los Angeles Lakers'],
  ['grizzlies',1610612763,29,'MEM','Memphis Grizzlies'], ['heat',1610612748,14,'MIA','Miami Heat'],
  ['bucks',1610612749,15,'MIL','Milwaukee Bucks'], ['timberwolves',1610612750,16,'MIN','Minnesota Timberwolves'],
  ['pelicans',1610612740,3,'NO','New Orleans Pelicans'], ['knicks',1610612752,18,'NY','New York Knicks'],
  ['thunder',1610612760,25,'OKC','Oklahoma City Thunder'], ['magic',1610612753,19,'ORL','Orlando Magic'],
  ['sixers',1610612755,20,'PHI','Philadelphia 76ers'], ['suns',1610612756,21,'PHX','Phoenix Suns'],
  ['blazers',1610612757,22,'POR','Portland Trail Blazers'], ['kings',1610612758,23,'SAC','Sacramento Kings'],
  ['spurs',1610612759,24,'SA','San Antonio Spurs'], ['raptors',1610612761,28,'TOR','Toronto Raptors'],
  ['jazz',1610612762,26,'UTAH','Utah Jazz'], ['wizards',1610612764,27,'WSH','Washington Wizards']
].map(([slug, nbaId, id, abbreviation, displayName]) => ({ slug, nbaId, id: String(id), abbreviation, displayName, logo: `/team-logos/${({GS:'gsw',NO:'nop',NY:'nyk',SA:'sas',UTAH:'uta',WSH:'was'})[abbreviation] || abbreviation.toLowerCase()}.png`, color: '#334155' }));

const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const stableId = text => crypto.createHash('sha256').update(text).digest('hex').slice(0, 20);
function moveType(description = '') {
  const text = normalize(description);
  if (/\b(claim|claimed|awarded)\b.*\bwaivers?\b/.test(text)) return 'Claimed off waivers';
  if (/\b(waive|waived|waives)\b/.test(text)) return 'Waived';
  if (/\b(release|released|releases)\b/.test(text)) return 'Released';
  if (/\b(convert|converted|converts)\b/.test(text)) return 'Converted';
  if (/\b(recall|recalled|recalls)\b/.test(text)) return 'Recalled';
  if (/\b(assign|assigned|assigns)\b/.test(text)) return 'Assigned';
  if (/\b(retire|retired|retires|retirement)\b/.test(text)) return 'Retired';
  if (/\b(buyout|bought out)\b/.test(text)) return 'Buyout';
  if (/\b(exercise|exercised|decline|declined)\b.*\boption\b/.test(text)) return 'Option';
  if (/\b(trade|traded|trades|acquire|acquired|acquires|received)\b/.test(text)) return 'Trade';
  if (/\b(re sign|re signed|re signs|resigned)\b/.test(text)) return 'Re-signed';
  if (/\b(sign|signed|signs|signing)\b/.test(text)) return 'Signed';
  return 'Roster move';
}
function contractType(text = '') {
  if (/exhibit[ -]?9\b/i.test(text)) return 'Exhibit 9';
  if (/exhibit[ -]?10\b/i.test(text)) return 'Exhibit 10';
  if (/two[ -]way/i.test(text)) return 'Two-way';
  if (/10[ -]day|ten[ -]day/i.test(text)) return '10-day';
  if (/training[ -]camp|camp (deal|contract)/i.test(text)) return 'Training camp';
  if (/non[ -]?guaranteed|nonguaranteed/i.test(text)) return 'Non-guaranteed';
  if (/extension|extend(?:s|ed)?\b/i.test(text)) return 'Extension';
  return null;
}
function normalizeMovement(raw, since) {
  const rows = raw?.NBA_Player_Movement?.rows;
  if (!Array.isArray(rows)) throw new Error('NBA transaction feed shape changed');
  return rows.filter(row => String(row.TRANSACTION_DATE).slice(0,10) >= since).map(row => {
    const team = TEAMS.find(team => team.nbaId === Number(row.TEAM_ID));
    if (!team || !row.TRANSACTION_DESCRIPTION || !/^\d{4}-\d{2}-\d{2}/.test(row.TRANSACTION_DATE)) return null;
    const description = row.TRANSACTION_DESCRIPTION;
    const name = String(row.PLAYER_SLUG || '').split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    return {
      id: `nba-move-${stableId([row.GroupSort, row.TRANSACTION_DATE, row.TEAM_ID, row.PLAYER_ID, description].join('|'))}`,
      // This source has a calendar date, not a true event timestamp.
      date: `${row.TRANSACTION_DATE.slice(0,10)}T12:00:00Z`, dateOnly: true,
      description, type: ({ Signing: /re-signed/i.test(description) ? 'Re-signed' : 'Signed', Waive: 'Waived', Trade: 'Trade', AwardOnWaivers: 'Claimed off waivers', ContractConverted: 'Converted' })[row.Transaction_Type] || moveType(description),
      contractType: contractType(description), team,
      player: row.PLAYER_ID ? { id: String(row.PLAYER_ID), name, headshot: `https://cdn.nba.com/headshots/nba/latest/1040x760/${row.PLAYER_ID}.png` } : null,
      source: 'NBA official transactions', url: 'https://www.nba.com/players/transactions',
      verification: { status: 'official', source: 'NBA official transactions', detail: 'Listed in the NBA player-movement feed.' }
    };
  }).filter(Boolean);
}
function announcements(html, team, since) {
  const raw = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!raw) throw new Error('Team news page data missing');
  const page = JSON.parse(raw).props?.pageProps;
  if (!page?.pageObject) throw new Error('Team news page shape changed');
  const posts = new Map();
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (value.type === 'article' && value.title && value.permalink && value.date) posts.set(value.permalink, value);
    for (const child of Object.values(value)) if (typeof child === 'object') walk(child);
  }
  walk(page.pageObject);
  return normalizeAnnouncements([...posts.values()], team, since);
}
function normalizeAnnouncements(posts, team, since) {
  if (!Array.isArray(posts)) throw new Error('Team announcement feed shape changed');
  return posts.filter(post => {
    if (post.type !== 'article' || !post.date || !post.title || !post.permalink) return false;
    if (post.date.slice(0,10) < since || !Number.isFinite(Date.parse(post.date))) return false;
    let url; try { url = new URL(post.permalink, 'https://www.nba.com'); } catch (_) { return false; }
    if (url.origin !== 'https://www.nba.com' || !url.pathname.startsWith(`/${team.slug}/`)) return false;
    const title = normalize(post.title);
    if (/\b(partner|partnership|sponsor|sponsorship|broadcast|tickets|giveaway)\b/.test(title)) return false;
    if (/\b(could|should|might|rumor|rumors|reportedly|potential|preview|why|how)\b/.test(title)) return false;
    // Only transaction announcements, not speculation or general camp coverage.
    return /\b(sign|signs|signed|re sign|re signs|re signed|waive|waives|waived|acquire|acquires|acquired|trade|trades|traded|convert|converts|converted|claim|claims|claimed|release|releases|released|assign|assigns|assigned|recall|recalls|recalled|exercise|exercises|exercised|decline|declines|declined|extend|extends|extended)\b/.test(title);
  }).map(post => {
    const people = Object.entries(post.taxonomy?.players || {});
    const player = people.length === 1 ? { id: people[0][0], name: people[0][1], headshot: `https://cdn.nba.com/headshots/nba/latest/1040x760/${people[0][0]}.png` } : null;
    return { id: `nba-announcement-${team.nbaId}-${post.id || stableId(post.permalink)}`, date: post.date, dateLabel: 'Announced', description: post.title, type: moveType(post.title), contractType: contractType(post.title), player, team, url: post.permalink, source: 'Official team announcement', verification: { status: 'official', source: `${team.displayName} announcement`, detail: 'Published on the team’s official NBA website. Contract guarantees and roster spots are not inferred.' } };
  });
}
function mergeMoves(rows) {
  const seenIds = new Set(); const seenEvents = new Map(); const output = [];
  // Callers put authoritative sources first. Never collapse different move types
  // or teams, or use a player's current roster to rewrite their old transactions.
  for (const row of rows) {
    if (row.id && seenIds.has(row.id)) continue;
    if (row.id) seenIds.add(row.id);
    // ESPN sometimes groups several players into one row. Matching its first
    // player must not discard the other moves in the same description.
    const key = [String(row.date || '').slice(0,10), row.team?.id || row.team?.abbreviation, row.type, normalize(row.eventKey || row.player?.name || row.description)].join('|');
    const existing = seenEvents.get(key);
    if (existing) {
      existing.contractType ||= row.contractType;
      existing.contract ||= row.contract;
      continue;
    }
    const item = { ...row, contractType: row.contractType || contractType(row.description) };
    seenEvents.set(key, item); output.push(item);
  }
  return output.sort((a,b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
}

function createMoveFeed({ fetcher = fetch, clock = () => new Date(), teams = TEAMS, archive } = {}) {
  const cache = new Map(); let pending; let snapshot;
  if (!archive) archive = createStore({ ...process.env, FANTASY_DATA_DIR: path.join(__dirname, '..', '.tracker-data'), FANTASY_KEY_PREFIX: `${process.env.FANTASY_KEY_PREFIX || 'courtside:fantasy:v1:'}moves:` });
  async function get(url, parse) {
    const old = cache.get(url);
    try {
      const response = await fetcher(url, { headers: { 'User-Agent': 'Courtside/0.3', accept: 'application/json,text/html' }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`Source returned ${response.status}`);
      const data = parse(await response.text()); const result = { data, checkedAt: clock().toISOString(), stale: false };
      cache.set(url, result); return result;
    } catch (_) { return old ? { ...old, stale: true } : { data: [], checkedAt: null, stale: true }; }
  }
  async function load() {
    if (snapshot && clock().getTime() - snapshot.time < 300000) return snapshot.value;
    if (pending) return pending;
    pending = (async () => {
      const since = new Date(clock().getTime() - 365 * 86400000).toISOString().slice(0,10);
      const movementPromise = get(MOVEMENT_URL, text => normalizeMovement(JSON.parse(text), since));
      const results = []; let index = 0;
      await Promise.all(Array.from({ length: Math.min(10, teams.length) }, async () => {
        while (index < teams.length) {
          const team = teams[index++];
          // The public content API also serves teams with custom news websites.
          const url = `https://content-api-prod.nba.com/public/1/leagues/nba/teams/${team.nbaId}/content?types=article&count=50&offset=0`;
          let result = await get(url, text => normalizeAnnouncements(JSON.parse(text).results?.items, team, since));
          if (result.stale) {
            const fallback = await get(`https://www.nba.com/${team.slug}/news`, text => announcements(text, team, since));
            if (!fallback.stale) result = fallback;
          }
          results.push({ team, ...result });
        }
      }));
      const movement = await movementPromise;
      let remembered = []; let archiveStatus = archive.available ? archive.mode : 'unconfigured';
      const collected = results.flatMap(result => result.data);
      const players = [...new Map(movement.data.filter(item => item.player?.name).map(item => [item.player.id, item.player])).values()];
      for (const item of collected) if (!item.player) {
        const text = ` ${normalize(item.description)} `;
        const matches = players.filter(player => text.includes(` ${normalize(player.name)} `));
        if (matches.length === 1) item.player = matches[0];
      }
      if (archive.available) try {
        const saved = await archive.update('announcements', old => ({ transactions: mergeMoves([...collected, ...(old?.transactions || [])]).filter(item => item.date.slice(0,10) >= since) }));
        remembered = saved.transactions;
      } catch (_) { archiveStatus = 'unavailable'; }
      const transactions = mergeMoves([...movement.data, ...collected, ...remembered]);
      const failedTeams = results.filter(result => result.stale).map(result => result.team.abbreviation);
      const value = {
        transactions,
        coverage: { since, checkedAt: clock().toISOString(), officialFeed: movement.stale ? 'unavailable-or-stale' : 'ok', officialFeedCheckedAt: movement.checkedAt, teamFeedsChecked: teams.length, teamFeedsFresh: teams.length - failedTeams.length, failedTeams, archive: archiveStatus, announcementScope: 'Latest 50 articles per team plus previously collected announcements; not a complete historical team-news archive.' },
        stale: movement.stale && results.every(result => result.stale)
      };
      snapshot = { time: clock().getTime(), value }; return value;
    })().finally(() => { pending = null; });
    return pending;
  }
  return { load };
}

module.exports = { TEAMS, MOVEMENT_URL, moveType, contractType, normalizeMovement, normalizeAnnouncements, announcements, mergeMoves, createMoveFeed };
