// Official NBA thresholds. Keep source URLs beside every season so figures remain auditable.
const seasons = {
  '2026-27': {
    season: '2026-27', cap: 164_961_000, minimum: 148_465_000, tax: 200_428_000,
    firstApron: 209_015_000, secondApron: 221_686_000,
    exceptions: { nonTaxpayerMidLevel: 15_044_000, taxpayerMidLevel: 6_064_000, roomMidLevel: 9_366_000 },
    source: 'https://pr.nba.com/2026-27-salary-cap/', published: '2026-06-30'
  },
  '2025-26': {
    season: '2025-26', cap: 154_647_000, minimum: 139_182_000, tax: 187_895_000,
    firstApron: 195_945_000, secondApron: 207_824_000,
    exceptions: { nonTaxpayerMidLevel: 14_104_000, taxpayerMidLevel: 5_685_000, roomMidLevel: 8_781_000 },
    source: 'https://pr.nba.com/nba-salary-cap-2025-26-season/', published: '2025-06-30'
  }
};
const cache = new Map();
const BREF = 'https://www.basketball-reference.com/contracts';
const offseasonFreeAgents = require('../data/offseasonFreeAgents');
const brefToEspn = { BRK: 'BKN', CHO: 'CHA', PHO: 'PHX' };
const teamSlugs = { ATL:'hawks',BOS:'celtics',BKN:'nets',CHA:'hornets',CHI:'bulls',CLE:'cavaliers',DAL:'mavericks',DEN:'nuggets',DET:'pistons',GSW:'warriors',HOU:'rockets',IND:'pacers',LAC:'clippers',LAL:'lakers',MEM:'grizzlies',MIA:'heat',MIL:'bucks',MIN:'timberwolves',NOP:'pelicans',NYK:'knicks',OKC:'thunder',ORL:'magic',PHI:'76ers',PHX:'suns',POR:'trail-blazers',SAC:'kings',SAS:'spurs',TOR:'raptors',UTA:'jazz',WAS:'wizards' };
const espnToNba = { GS:'GSW',NO:'NOP',NY:'NYK',SA:'SAS',UTAH:'UTA',WSH:'WAS' };

function nbaUrl(value) {
  if (!value) return null;
  try { return new URL(value, 'https://www.nba.com').href; } catch (_) { return null; }
}

async function getHtml(url, ttl = 1_800_000) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.time < ttl) return hit.data;
  let lastError;
  for(let attempt=0;attempt<2;attempt++)try{const response=await fetch(url,{headers:{'user-agent':'Courtside/0.2 portfolio project'},signal:AbortSignal.timeout(15_000)});if(!response.ok)throw new Error(`Contract source returned ${response.status}`);const data=await response.text();cache.set(url,{time:Date.now(),data});return data}catch(error){lastError=error}
  if(hit)return hit.data;throw lastError;
}

async function getJson(url, ttl = 300_000) {
  const hit=cache.get(url);if(hit&&Date.now()-hit.time<ttl)return hit.data;
  let lastError;for(let attempt=0;attempt<2;attempt++)try{const response=await fetch(url,{headers:{accept:'application/json','user-agent':'Courtside/0.2 portfolio project'},signal:AbortSignal.timeout(12_000)});if(!response.ok)throw new Error(`Roster source returned ${response.status}`);const data=await response.json();cache.set(url,{time:Date.now(),data});return data}catch(error){lastError=error}if(hit)return hit.data;throw lastError;
}

async function currentRosterAssignments() {
  const base='https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
  const directory=await getJson(`${base}/teams?limit=40`,3_600_000);
  const teams=(directory.sports?.[0]?.leagues?.[0]?.teams||[]).map(item=>item.team||item);
  const rosters=await Promise.all(teams.map(async team=>{try{return {team,raw:await getJson(`${base}/teams/${team.id}/roster`,300_000)}}catch(_){return null}}));
  return new Map(rosters.filter(Boolean).flatMap(({team,raw})=>(raw.athletes||[]).flatMap(player=>[[String(player.id),team.abbreviation],[`name:${String(player.displayName||'').toLowerCase()}`,team.abbreviation]])));
}

function clean(value = '') {
  return value.replace(/<[^>]+>/g, '').replaceAll('&nbsp;', ' ').replaceAll('&#x27;', "'").replaceAll('&amp;', '&').trim();
}

function table(html, id) {
  const start = html.indexOf(`id="${id}"`);
  if (start < 0) throw new Error(`Missing ${id} table`);
  return html.slice(start, html.indexOf('</table>', start));
}

function seasonsFromTable(html) {
  return [...html.matchAll(/aria-label="(\d{4}-\d{2})" data-stat="(y\d)"/g)].map(match => ({ season: match[1], key: match[2] }));
}

function cell(row, stat) {
  const match = row.match(new RegExp(`<t[dh]([^>]*)data-stat="${stat}"([^>]*)>([\\s\\S]*?)<\\/t[dh]>`));
  if (!match) return { value: '', numeric: null, html: '', className: '' };
  const attributes = `${match[1]} ${match[2]}`;
  const numeric = attributes.match(/csk="([^"]*)"/)?.[1];
  return { value: clean(match[3]), numeric: numeric ? Number(numeric) : null, html: match[3], className: attributes.match(/class="([^"]*)"/)?.[1] || attributes.match(/class='([^']*)'/)?.[1] || '' };
}

async function payrolls() {
  const source = `${BREF}/`;
  const content = table(await getHtml(source), 'team_summary');
  const seasonColumns = seasonsFromTable(content);
  const teams = [...content.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(match => match[1]).filter(row => row.includes('/contracts/')).map(row => {
    const teamCell = cell(row, 'team_name');
    const href = teamCell.html.match(/\/contracts\/([A-Z]{3})\.html/)?.[1] || '';
    return { abbreviation: brefToEspn[href] || href, sourceAbbreviation: href, displayName: teamCell.value, salaries: Object.fromEntries(seasonColumns.map(column => [column.season, cell(row, column.key).numeric || 0])) };
  });
  return { source, retrievedAt: new Date().toISOString(), seasons: seasonColumns.map(item => item.season), teams };
}

async function teamContracts(abbreviation) {
  const espnToBref = { BKN: 'BRK', CHA: 'CHO', PHX: 'PHO' };
  const code = espnToBref[abbreviation] || abbreviation;
  if (!/^[A-Z]{3}$/.test(code)) throw new Error('Invalid team abbreviation');
  const source = `${BREF}/${code}.html`;
  const content = table(await getHtml(source), 'contracts');
  const seasonColumns = seasonsFromTable(content);
  const players = [...content.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(match => match[1]).filter(row => row.includes('/players/')).map(row => {
    const player = cell(row, 'player');
    const id = player.html.match(/\/players\/[a-z]\/([a-z0-9]+)\.html/i)?.[1] || player.value;
    const salaryCells = Object.fromEntries(seasonColumns.map(column => [column.season, cell(row, column.key)]));
    const options = Object.fromEntries(seasonColumns.map(column => {
      const classes = salaryCells[column.season].className;
      return [column.season, classes.includes('salary-pl') ? 'Player option' : classes.includes('salary-tm') ? 'Team option' : null];
    }));
    return { id, name: player.value, age: Number(cell(row, 'age_today').value) || null, salaries: Object.fromEntries(seasonColumns.map(column => [column.season, salaryCells[column.season].numeric || 0])), options, guaranteed: cell(row, 'remain_gtd').numeric || 0 };
  });
  return { source, retrievedAt: new Date().toISOString(), abbreviation, seasons: seasonColumns.map(item => item.season), players };
}

async function freeAgents() {
  const source = 'https://www.nba.com/players/free-agent-tracker';
  const html = await getHtml(source, 300_000);
  const raw = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
  if (!raw) throw new Error('Free-agent tracker data missing');
  const page = JSON.parse(raw).props?.pageProps || {};
  let assignments=new Map();try{assignments=await currentRosterAssignments()}catch(_){}
  const players = (page.players || []).map(player => {
    const currentTeam=assignments.get(String(player.playerId))||assignments.get(`name:${String(player.playerDisplayName||'').toLowerCase()}`);
    const currentSlug=teamSlugs[espnToNba[currentTeam]||currentTeam];
    const oldSlug=String(player.oldTeamLink||'').match(/\/team\/\d+\/([^/]+)/)?.[1]||null;
    const trackerSigned=player.availability==='S'||Number(player.newTeamId)>0||Boolean(player.newTeamAbbr);
    const rosterChanged=Boolean(currentTeam&&oldSlug&&currentSlug&&currentSlug!==oldSlug);
    const verifiedMove=trackerSigned||Boolean(rosterChanged&&(player.articleLink||player.articleUrl));
    return ({
    id: String(player.playerId), name: player.playerDisplayName, position: player.position || '-', age: player.age ?? null, experience: player.exp ?? null,
    headshot: `https://cdn.nba.com/headshots/nba/latest/1040x760/${player.playerId}.png`,
    type: String(player.type || '').toUpperCase(), availability: verifiedMove?'Signed':'Available', oldTeam: player.oldTeamAbbr || null, newTeam: verifiedMove?(player.newTeamAbbr||currentTeam||null):null, reconciled:verifiedMove?(trackerSigned?'NBA free-agent tracker':'ESPN roster + NBA report'):null,
    stats: { ppg: Number(player.PPG || 0), rpg: Number(player.RPG || 0), apg: Number(player.APG || 0) },
    option: player.isPlayerOption ? 'Player option' : player.isTeamOption ? 'Team option' : player.isEarlyTerminationOption ? 'Early termination option' : player.isTwoWayFreeAgent ? 'Two-way free agent' : null,
    profile: nbaUrl(player.playerLink), article: nbaUrl(player.articleLink || player.articleUrl), articleLabel: player.articleLabel || null
  })});
  await Promise.all(players.filter(player=>player.reconciled&&player.article).map(async player=>{
    try {
      const articleHtml=await getHtml(player.article,86_400_000);
      player.reportedAt=articleHtml.match(/"datePublished"\s*:\s*"([^"]+)/i)?.[1]||articleHtml.match(/property="article:published_time"[^>]+content="([^"]+)/i)?.[1]||null;
    } catch (_) { player.reportedAt=null; }
  }));
  for (const override of offseasonFreeAgents) {
    const existing=players.find(player=>player.id===override.id||player.name.toLowerCase()===override.name.toLowerCase());
    if(existing){Object.assign(existing,{availability:'Available',newTeam:null,type:override.type,oldTeam:override.oldTeam||existing.oldTeam});continue}
    players.push({...override,age:null,experience:null,availability:'Available',newTeam:null,reconciled:'ESPN offseason report',headshot:`https://cdn.nba.com/headshots/nba/latest/1040x760/${override.id}.png`,stats:{ppg:0,rpg:0,apg:0},option:null,profile:null,article:'https://www.espn.com/nba/nba-free-agency/'});
  }
  return { source, retrievedAt: new Date().toISOString(), season: players[0]?.season || '2026', players };
}

function salaryNumber(value = '') {
  const amount = clean(value).match(/\$([\d,]+)/)?.[1];
  return amount ? Number(amount.replaceAll(',', '')) : 0;
}

async function capHolds(abbreviation) {
  const slug = teamSlugs[abbreviation];
  if (!slug) throw new Error('Invalid team abbreviation');
  const source = `https://www.salaryswish.com/teams/${slug}`;
  const html = await getHtml(source, 900_000);
  const tables = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)].map(match => match[1]).filter(content => /<th>(?:RFAs|UFAs)\b/.test(content));
  const holds = tables.flatMap(content => {
    const type = content.includes('<th>RFAs') ? 'RFA' : 'UFA';
    const header = content.match(/<thead>([\s\S]*?)<\/thead>/)?.[1] || '';
    const years = [...header.matchAll(/<th>(\d{4}-\d{2})<\/th>/g)].map(match => match[1]);
    return [...content.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].slice(1).map(match => {
      const cells = [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(cellMatch => cellMatch[1]);
      const playerLink = cells[0]?.match(/href="\/players\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      const values = cells.slice(6, 6 + years.length).map(salaryNumber);
      return { id: playerLink?.[1] || clean(cells[0]), name: clean(playerLink?.[2] || cells[0]), type, age: Number(clean(cells[3])) || null, position: clean(cells[4]) || '-', holds: Object.fromEntries(years.map((year, index) => [year, values[index] || 0])) };
    }).filter(player => player.name && Object.values(player.holds).some(Boolean));
  });
  const seasons = [...new Set(holds.flatMap(player => Object.keys(player.holds)))];
  return { source, retrievedAt: new Date().toISOString(), abbreviation, seasons, holds };
}

function capOverview(season = '2026-27') {
  if (!seasons[season]) throw new Error('Unsupported cap season');
  return seasons[season];
}

module.exports = { capOverview, payrolls, teamContracts, freeAgents, capHolds, seasons };
