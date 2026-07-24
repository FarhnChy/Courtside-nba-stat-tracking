const teams = {
  BOS:{name:'Celtics',city:'Boston',color:'#087a52'},NYK:{name:'Knicks',city:'New York',color:'#f58426'},
  CLE:{name:'Cavaliers',city:'Cleveland',color:'#7b1636'},MIL:{name:'Bucks',city:'Milwaukee',color:'#1d684b'},
  OKC:{name:'Thunder',city:'Oklahoma City',color:'#1677c8'},DEN:{name:'Nuggets',city:'Denver',color:'#fdb827'},
  LAL:{name:'Lakers',city:'Los Angeles',color:'#552583'},GSW:{name:'Warriors',city:'Golden State',color:'#1d428a'},
  MIN:{name:'Timberwolves',city:'Minnesota',color:'#0c2340'},PHX:{name:'Suns',city:'Phoenix',color:'#e56020'},
  ORL:{name:'Magic',city:'Orlando',color:'#178bd1'},PHI:{name:'76ers',city:'Philadelphia',color:'#d9283e'}
};
const games=[
 {id:1,away:'BOS',home:'NYK',as:87,hs:84,status:'LIVE',detail:'Q4 · 6:42',records:['44–16','38–22'],prob:[61,39]},
 {id:2,away:'DEN',home:'OKC',as:112,hs:118,status:'FINAL',detail:'Final',records:['40–21','48–12'],prob:[0,100]},
 {id:3,away:'LAL',home:'GSW',as:null,hs:null,status:'UPCOMING',detail:'10:00 PM',records:['36–24','34–27'],prob:[46,54]}
];
let selected=games[0], dayOffset=0;
const logo=(code,cls='team-logo')=>`<span class="${cls}" style="--team:${teams[code].color}">${code}</span>`;
function renderDates(){const root=document.querySelector('#dates');root.innerHTML='';for(let i=-3;i<=3;i++){const d=new Date();d.setDate(d.getDate()+i+dayOffset);root.innerHTML+=`<div class="date ${i===0?'active':''}">${d.toLocaleDateString('en-US',{weekday:'short'})}<strong>${d.getDate()}</strong></div>`}}
function renderCards(){document.querySelector('#scoreGrid').innerHTML=games.map(g=>`<article class="score-card ${selected.id===g.id?'selected':''}" data-id="${g.id}"><div class="score-meta"><span class="${g.status==='LIVE'?'live':''}">${g.detail}</span><span>${g.status==='UPCOMING'?'MATCHUP':'NBA'}</span></div>${teamLine(g.away,g.records[0],g.as,g.as>g.hs)}${teamLine(g.home,g.records[1],g.hs,g.hs>g.as)}</article>`).join('');document.querySelectorAll('.score-card').forEach(c=>c.onclick=()=>{selected=games.find(g=>g.id==c.dataset.id);renderCards();renderGame()})}
function teamLine(code,record,score,winner){return `<div class="team-row ${winner?'winner':''}">${logo(code)}<div><div class="team-name">${teams[code].city} <span class="team-full">${teams[code].name}</span></div><div class="record">${record}</div></div><div class="team-score">${score??'—'}</div></div>`}
const shots=[['made',18,48],['miss',28,20],['made',37,67],['miss',48,87],['made',55,35],['made',64,71],['miss',73,17],['made',82,50],['miss',89,82],['made',43,13],['miss',67,43],['made',32,81]];
const plays=[['6:42','J. Brunson','Driving layup made · 2 PTS'],['7:03','J. Tatum','25-foot three missed'],['7:18','K. Porziņģis','Defensive rebound'],['7:31','M. Bridges','Personal foul · 3rd'],['7:46','J. Brown','Pullup jumper made · 2 PTS']];
function renderGame(){const g=selected,a=teams[g.away],h=teams[g.home];document.querySelector('#gameCenter').innerHTML=`<div class="panel-title"><h2>Game center</h2><span class="pill">${g.detail}</span></div><div class="game-scoreboard"><div class="big-team">${logo(g.away,'team-logo big-logo')}<div><strong>${a.name}</strong><div class="record">${g.records[0]}</div></div></div><div><div class="score-main">${g.as??'—'}<small>–</small>${g.hs??'—'}</div><div class="status-live">${g.status==='LIVE'?'● LIVE · '+g.detail:g.detail}</div></div><div class="big-team">${logo(g.home,'team-logo big-logo')}<div><strong>${h.name}</strong><div class="record">${g.records[1]}</div></div></div></div><div class="prob"><div class="prob-labels"><span>${g.away} ${g.prob[0]}%</span><span>LIVE WIN PROBABILITY</span><span>${g.home} ${g.prob[1]}%</span></div><div class="prob-bar"><span style="width:${g.prob[0]}%"></span><span style="width:${g.prob[1]}%"></span></div></div><div class="tabs"><button class="active">Shot chart</button><button>Team stats</button><button>Box score</button><button>Play-by-play</button></div><div class="court-wrap"><div class="court"><span class="hoop"></span>${shots.map(s=>`<span class="shot ${s[0]}" style="left:${s[1]}%;top:${s[2]}%">${s[0]==='made'?'○':'×'}</span>`).join('')}</div><div class="play-list">${plays.map(p=>`<div class="play"><time>${p[0]}</time><div><strong>${p[1]}</strong>${p[2]}</div></div>`).join('')}</div></div>`}
function renderSide(){document.querySelector('#leaders').innerHTML=`<div class="panel-title"><h2>Game leaders</h2><span class="pill">PTS</span></div>${[['J. Tatum','BOS · SF','31'],['J. Brunson','NYK · PG','27'],['J. Brown','BOS · SG','22']].map((x,i)=>`<div class="stat-row"><span class="rank">0${i+1}</span><div><strong>${x[0]}</strong><small>${x[1]}</small></div><span class="stat-value">${x[2]}</span></div>`).join('')}`;document.querySelector('#injuries').innerHTML=`<div class="panel-title"><h2>Injury report</h2><span class="pill">4 updates</span></div>${[['M. Robinson','NYK · C','OUT'],['A. Horford','BOS · C','GTD'],['O. Anunoby','NYK · SF','ACTIVE']].map(x=>`<div class="injury-row"><span>✚</span><div><strong>${x[0]}</strong><small>${x[1]}</small></div><span class="tag">${x[2]}</span></div>`).join('')}`}
const standings=[['CLE',49,11,'.817','—','8–2'],['BOS',44,16,'.733','5.0','7–3'],['NYK',38,22,'.633','11.0','6–4'],['MIL',35,25,'.583','14.0','7–3'],['ORL',33,28,'.541','16.5','5–5'],['PHI',31,29,'.517','18.0','6–4']];
function renderStandings(){document.querySelector('#standingsTable').innerHTML=`<table class="standings-table"><thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th><th>L10</th></tr></thead><tbody>${standings.map((r,i)=>`<tr><td>${i+1}</td><td>${logo(r[0],'mini-logo')}<b>${teams[r[0]].city} ${teams[r[0]].name}</b></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td><td>${r[5]}</td></tr>`).join('')}</tbody></table>`}
const match=(a,ap,b,bp)=>`<div class="matchup"><div class="fav"><span>${a}</span><b>${ap}%</b></div><div><span>${b}</span><span>${bp}%</span></div></div>`;
function renderPredict(random=false){let n=random?()=>Math.floor(55+Math.random()*30):()=>72;document.querySelector('#bracket').innerHTML=`<div class="panel-title"><h2>Eastern Conference</h2><span class="pill">Projected bracket</span></div><div class="rounds"><div><div class="round-title">First round</div>${match('1 CLE',91,'8 ATL',9)}${match('4 MIL',66,'5 ORL',34)}${match('2 BOS',88,'7 MIA',12)}${match('3 NYK',71,'6 IND',29)}</div><div><div class="round-title">Semifinals</div>${match('1 CLE',57,'4 MIL',43)}${match('2 BOS',n(),'3 NYK',100-n())}</div><div><div class="round-title">Conference final</div>${match('2 BOS',58,'1 CLE',42)}<div class="round-title" style="margin-top:35px">Finals winner</div>${match('BOS',54,'OKC',46)}</div></div>`;document.querySelector('#modelCard').innerHTML=`<div class="panel-title"><h2>Model outlook</h2><span class="pill">v0.1</span></div><div class="champion">${logo('BOS','team-logo big-logo')}<small class="muted">TITLE FAVORITE</small><br><strong>Boston Celtics</strong><p><b style="color:var(--green)">24.8%</b> championship odds</p></div>${[['Net rating',86],['Recent form',73],['Schedule strength',61],['Rest & travel',48],['Injury health',76]].map(x=>`<div class="factor"><div class="factor-head"><span>${x[0]}</span><b>${x[1]}</b></div><div class="factor-track"><span style="width:${x[1]}%"></span></div></div>`).join('')}`}
const futures=[['NBA champion',[['BOS','24.8%'],['OKC','22.1%'],['CLE','15.6%'],['DEN','12.4%']]],['MVP award',[['OKC','S. Gilgeous-Alexander'],['DEN','N. Jokić'],['MIL','G. Antetokounmpo'],['BOS','J. Tatum']]],['No. 1 seed',[['CLE','East · 78%'],['OKC','West · 84%'],['BOS','East · 19%'],['DEN','West · 11%']]]];
function renderFutures(){document.querySelector('#futuresGrid').innerHTML=futures.map(f=>`<section class="panel future-card"><h2>${f[0]}</h2>${f[1].map(x=>`<div class="odds-row">${logo(x[0],'mini-logo')}<span>${teams[x[0]].city} ${teams[x[0]].name}</span><b>${x[1]}</b></div>`).join('')}</section>`).join('')}
const viewRoutes = { scores:'scores', standings:'standings', teams:'teamsView', injuries:'injuriesView', moves:'transactionsView', finance:'financeView', 'free-agents':'freeAgentsView', predict:'predict', futures:'futures' };
const routeForView = viewId => Object.entries(viewRoutes).find(([,id]) => id === viewId)?.[0] || 'scores';
function activateView(viewId, updateUrl = true) {
  const target = document.querySelector(`#${viewId}`) || document.querySelector('#scores');
  document.querySelectorAll('.view').forEach(view => view.classList.toggle('active-view', view === target));
  document.querySelectorAll('#nav button').forEach(button => {
    const active = button.dataset.view === target.id;
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
    if (active) button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
  if (updateUrl) history.pushState({ view: target.id }, '', `#${routeForView(target.id)}`);
}
document.querySelectorAll('#nav button').forEach(button => button.onclick = () => activateView(button.dataset.view));
const openRoute = () => activateView(viewRoutes[location.hash.slice(1)] || 'scores', false);
window.addEventListener('hashchange', openRoute);
openRoute();
document.querySelector('#prevDay').onclick=()=>{dayOffset--;renderDates()};document.querySelector('#nextDay').onclick=()=>{dayOffset++;renderDates()};document.querySelector('#simulate').onclick=()=>{const b=document.querySelector('#simulate');b.textContent='Simulating…';setTimeout(()=>{renderPredict(true);b.textContent='Run simulation'},550)};
renderDates();renderCards();renderGame();renderSide();renderStandings();renderPredict();renderFutures();

// Live data layer. The demo above remains an offline fallback.
const live = { date: new Date(), timer: null, summaries: new Map(), source: 'demo' };
const isoDate = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const statusLabel = status => status.state === 'in' && status.period ? `Q${status.period} · ${status.clock}` : status.detail;

function installLiveGames(payload) {
  if (!payload.games.length) {
    games.splice(0, games.length);
    document.querySelector('#scoreGrid').innerHTML = '<div class="empty-state">No NBA games scheduled for this date.</div>';
    document.querySelector('#gameCenter').innerHTML = '<div class="empty-state"><strong>No games today</strong><br>Use the date arrows to browse the schedule.</div>';
    return;
  }
  const normalized = payload.games.map(game => {
    for (const side of [game.away, game.home]) teams[side.abbreviation] = { name: side.name, city: side.city, color: side.color, logo: side.logo };
    return { id: game.id, away: game.away.abbreviation, home: game.home.abbreviation, as: game.away.score, hs: game.home.score, status: game.status.state === 'in' ? 'LIVE' : game.status.completed ? 'FINAL' : 'UPCOMING', detail: statusLabel(game.status), records: [game.away.record, game.home.record], prob: [50,50], raw: game };
  });
  const previousId = selected?.id;
  games.splice(0, games.length, ...normalized);
  selected = games.find(game => String(game.id) === String(previousId)) || games[0];
  renderCards(); enhanceScoreCards(); loadGame(selected.id, true);
}

async function loadScoreboard(quiet = false) {
  const status = document.querySelector('#feedStatus');
  if (status && !quiet) status.textContent = 'Loading live NBA data…';
  try {
    const response = await fetch(`/api/scoreboard?date=${isoDate(live.date)}`);
    if (!response.ok) throw new Error('Feed unavailable');
    const payload = await response.json(); live.source = 'live'; installLiveGames(payload);
    if (status) status.textContent = `${payload.season || 'NBA'} · Live feed · refreshes every 20s`;
  } catch (error) { live.source = 'demo'; if (status) status.textContent = 'Offline demo · live feed unavailable'; }
}

function summaryTabs(summary, active = 'box') {
  const game = selected;
  const button = (id, label) => `<button class="summary-tab ${active===id?'active':''}" data-summary-tab="${id}">${label}</button>`;
  const content = active === 'box' ? renderBoxScore(summary.boxscore) : active === 'stats' ? renderTeamStats(summary.teamStats) : renderPlayByPlay(summary.plays);
  const lineTeams = [summary.game?.away, summary.game?.home].filter(Boolean); const periods = Math.max(4,...lineTeams.map(team=>team.lineScores?.length||0));
  const lineScore = lineTeams.length===2 ? `<div class="table-scroll"><table class="line-score"><caption class="sr-only">Quarter by quarter scoring</caption><thead><tr><th>Team</th>${Array.from({length:periods},(_,i)=>`<th>${i<4?i+1:`OT${i-3}`}</th>`).join('')}<th>T</th></tr></thead><tbody>${lineTeams.map(team=>`<tr><td>${escapeHtml(team.abbreviation)}</td>${Array.from({length:periods},(_,i)=>`<td>${team.lineScores?.[i]?.value??'—'}</td>`).join('')}<td><strong>${team.score}</strong></td></tr>`).join('')}</tbody></table></div>`:'';
  const context = [game.raw?.venue,...(game.raw?.broadcasts||[])].filter(Boolean).join(' · ');
  document.querySelector('#gameCenter').innerHTML = `<div class="panel-title"><div><h2>${escapeHtml(game.away)} at ${escapeHtml(game.home)}</h2>${context?`<p class="game-context">${escapeHtml(context)}</p>`:''}</div><span class="pill">${escapeHtml(game.detail)}</span></div><div class="game-scoreboard compact"><div class="big-team">${logo(game.away,'team-logo big-logo')}<strong>${escapeHtml(teams[game.away].name)}</strong></div><div class="score-main">${game.as}<small>–</small>${game.hs}</div><div class="big-team">${logo(game.home,'team-logo big-logo')}<strong>${escapeHtml(teams[game.home].name)}</strong></div></div>${lineScore}<div class="tabs">${button('box','Box score')}${button('stats','Team stats')}${button('plays','Play-by-play')}</div><div class="summary-content">${content}</div>`;
  document.querySelectorAll('[data-summary-tab]').forEach(el => el.onclick = () => summaryTabs(summary, el.dataset.summaryTab));
  document.querySelectorAll('.box-player[data-player-id]').forEach(button => {
    button.onclick = () => openPlayerProfile(button.dataset.playerId, {
      name: button.dataset.playerName, position: button.dataset.playerPosition,
      headshot: button.dataset.playerHeadshot, jersey: button.dataset.playerJersey
    }, button.dataset.teamName);
  });
}

function renderBoxScore(groups) {
  if (!groups?.length) return '<div class="empty-state">The full box score will appear when stats are available.</div>';
  return groups.map(group => group.sections.map(section => `<div class="box-team"><h3>${escapeHtml(group.team.displayName)}</h3><div class="table-scroll"><table class="box-table"><thead><tr><th>Player</th>${section.labels.map(x=>`<th>${escapeHtml(x)}</th>`).join('')}</tr></thead><tbody>${section.athletes.map(player=>`<tr><td><button class="box-player" data-player-id="${escapeHtml(player.id)}" data-player-name="${escapeHtml(player.name)}" data-player-position="${escapeHtml(player.position)}" data-player-headshot="${escapeHtml(player.headshot||'')}" data-player-jersey="${escapeHtml(player.jersey||'')}" data-team-name="${escapeHtml(group.team.displayName)}"><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(player.position)}${player.starter?' · Starter':''}</small></button></td>${player.didNotPlay?`<td colspan="${section.labels.length}">DNP</td>`:player.stats.map(x=>`<td>${escapeHtml(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`).join('')).join('');
}

function renderTeamStats(groups) {
  if (groups?.length < 2) return '<div class="empty-state">Team statistics are not available yet.</div>';
  const names = [...new Set(groups.flatMap(g => g.stats.map(x => x.name)))];
  const value = (group, name) => group.stats.find(x => x.name === name)?.value ?? '-';
  return `<table class="comparison-table"><thead><tr><th>${escapeHtml(groups[0].team.abbreviation)}</th><th>Team stat</th><th>${escapeHtml(groups[1].team.abbreviation)}</th></tr></thead><tbody>${names.map(name=>{const label=groups[0].stats.find(x=>x.name===name)?.label||name;return `<tr><td>${escapeHtml(value(groups[0],name))}</td><td>${escapeHtml(label)}</td><td>${escapeHtml(value(groups[1],name))}</td></tr>`}).join('')}</tbody></table>`;
}

function renderPlayByPlay(plays) {
  if (!plays?.length) return '<div class="empty-state">Play-by-play is not available for this game.</div>';
  return `<div class="play-list full">${plays.map(play=>`<div class="play"><time>Q${play.period} ${escapeHtml(play.clock)}</time><div><strong>${escapeHtml(play.awayScore)}–${escapeHtml(play.homeScore)}</strong>${escapeHtml(play.text)}</div></div>`).join('')}</div>`;
}

async function loadGame(id, quiet = false) {
  if (live.source !== 'live') return renderGame();
  const root = document.querySelector('#gameCenter');
  root.setAttribute('aria-busy','true');
  if (!quiet) root.innerHTML = '<div class="empty-state">Loading complete box score…</div>';
  try {
    const cached = live.summaries.get(id);
    const selectedGame = games.find(game => String(game.id) === String(id));
    const maxAge = selectedGame?.status === 'LIVE' ? 15_000 : 300_000;
    let summary = cached && Date.now() - cached.time < maxAge ? cached.data : null;
    if (!summary) { const response = await fetch(`/api/games/${id}`); if (!response.ok) throw new Error('Summary unavailable'); summary = await response.json(); live.summaries.set(id, { data: summary, time: Date.now() }); }
    const activeTab = root.querySelector('[data-summary-tab].active')?.dataset.summaryTab || 'box';
    summaryTabs(summary, activeTab);
  } catch (error) { if (!quiet || !root.querySelector('.summary-content')) root.innerHTML = '<div class="empty-state">Game details are not available yet.</div>'; }
  finally { root.setAttribute('aria-busy','false'); }
}

function enhanceScoreCards() {
  document.querySelectorAll('.score-card').forEach(card => {
    card.tabIndex = 0; card.setAttribute('role','button');
    card.setAttribute('aria-label', `${card.querySelectorAll('.team-name')[0]?.textContent || 'Away team'} versus ${card.querySelectorAll('.team-name')[1]?.textContent || 'home team'}`);
    card.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); card.click(); setTimeout(enhanceScoreCards,0); } };
  });
}

document.querySelector('#scoreGrid').addEventListener('click', event => { const card = event.target.closest('.score-card'); if (card && live.source === 'live') setTimeout(() => { enhanceScoreCards(); loadGame(card.dataset.id); }, 0); });
enhanceScoreCards();
document.querySelector('#prevDay').onclick = () => { live.date.setDate(live.date.getDate()-1); dayOffset--; renderDates(); loadScoreboard(); };
document.querySelector('#nextDay').onclick = () => { live.date.setDate(live.date.getDate()+1); dayOffset++; renderDates(); loadScoreboard(); };
loadScoreboard(); live.timer = setInterval(() => loadScoreboard(true), 20_000);

const liveStandings = { conference: 'east', data: null };
function currentSeasonEndYear() { const now = new Date(); return now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear(); }

function renderLiveStandings() {
  const conference = liveStandings.data?.conferences.find(item => item.id === liveStandings.conference);
  const root = document.querySelector('#standingsTable');
  if (!conference?.teams.length) { root.innerHTML = '<div class="empty-state">Standings are not available for this season.</div>'; return; }
  document.querySelector('#standingsSeason').textContent = `${liveStandings.data.season || currentSeasonEndYear()} SEASON · LIVE DATA`;
  root.innerHTML = `<div class="table-scroll"><table class="standings-table live-standings"><thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th><th>HOME</th><th>AWAY</th><th>CONF</th><th>L10</th><th>STRK</th><th>DIFF</th></tr></thead><tbody>${conference.teams.map(team => `<tr><td><span class="seed ${team.seed<=6?'playoff':team.seed<=10?'playin':''}">${team.seed}</span></td><td>${team.logo?`<img class="team-mark" src="${escapeHtml(team.logo)}" alt="">`:''}<b>${escapeHtml(team.displayName)}</b></td><td>${team.wins}</td><td>${team.losses}</td><td>${escapeHtml(team.pct)}</td><td>${escapeHtml(team.gb)}</td><td>${escapeHtml(team.home)}</td><td>${escapeHtml(team.away)}</td><td>${escapeHtml(team.conference)}</td><td>${escapeHtml(team.lastTen)}</td><td>${escapeHtml(team.streak)}</td><td>${escapeHtml(team.differential)}</td></tr>`).join('')}</tbody></table></div><div class="standings-key"><span><i class="key-playoff"></i> Playoff seed</span><span><i class="key-playin"></i> Play-in position</span></div>`;
}

async function loadStandings() {
  const root = document.querySelector('#standingsTable'); root.innerHTML = '<div class="empty-state">Loading East and West standings…</div>';
  try {
    const response = await fetch(`/api/standings?season=${currentSeasonEndYear()}`);
    if (!response.ok) throw new Error('Standings unavailable');
    liveStandings.data = await response.json(); renderLiveStandings();
  } catch (error) { root.innerHTML = '<div class="empty-state">Live standings are temporarily unavailable.</div>'; }
}

document.querySelectorAll('#conferencePicker button').forEach(button => button.onclick = () => {
  liveStandings.conference = button.dataset.conference;
  document.querySelectorAll('#conferencePicker button').forEach(item => item.classList.toggle('active', item === button));
  renderLiveStandings();
});
loadStandings();

async function loadTeams() {
  const picker = document.querySelector('#teamPicker');
  try {
    const response = await fetch('/api/teams'); if (!response.ok) throw new Error('Teams unavailable');
    const payload = await response.json();
    picker.innerHTML = payload.teams.map(team => `<option value="${team.id}">${escapeHtml(team.displayName)}</option>`).join('');
    picker.onchange = () => loadRoster(picker.value);
    if (payload.teams[0]) loadRoster(payload.teams[0].id);
  } catch (error) { document.querySelector('#rosterView').innerHTML = '<div class="empty-state">Team directory is temporarily unavailable.</div>'; }
}

const rosterState = { roster: null, query: '', position: 'all' };
function renderRosterData() {
  const roster = rosterState.roster; const root = document.querySelector('#rosterView');
  if (!roster) return;
  const query = rosterState.query.toLowerCase();
  const players = roster.players.filter(player => (!query || player.name.toLowerCase().includes(query)) && (rosterState.position === 'all' || player.position === rosterState.position));
  const positions = [...new Set(roster.players.map(player=>player.position).filter(Boolean))].sort();
  root.innerHTML = `<div class="roster-heading">${roster.team.logo?`<img src="${escapeHtml(roster.team.logo)}" alt="">`:''}<div><p class="eyebrow">CURRENT ROSTER</p><h2>${escapeHtml(roster.team.displayName)}</h2><span>${roster.players.length} players · ${players.length} shown</span></div><div class="coach-list"><small>COACHING STAFF</small>${roster.coaches.length?roster.coaches.map(coach=>`<strong>${escapeHtml(coach.name)}</strong>`).join(''):'<strong>Not listed</strong>'}</div></div><div class="roster-tools"><label><span>Search roster</span><input id="rosterSearch" type="search" value="${escapeHtml(rosterState.query)}" placeholder="Player name"></label><label><span>Position</span><select id="rosterPosition"><option value="all">All positions</option>${positions.map(position=>`<option value="${escapeHtml(position)}" ${rosterState.position===position?'selected':''}>${escapeHtml(position)}</option>`).join('')}</select></label></div><div class="table-scroll"><table class="roster-table"><caption class="sr-only">${escapeHtml(roster.team.displayName)} current roster</caption><thead><tr><th>Player</th><th>#</th><th>Pos</th><th>Age</th><th>Height</th><th>Weight</th><th>Experience</th><th>College</th><th>Status</th></tr></thead><tbody>${players.map(player=>`<tr class="profile-row" data-player-id="${player.id}" tabindex="0"><td><div class="player-cell">${player.headshot?`<img src="${escapeHtml(player.headshot)}" alt="">`:'<span class="player-placeholder"></span>'}<strong>${escapeHtml(player.name)}</strong></div></td><td>${escapeHtml(player.jersey)}</td><td>${escapeHtml(player.position)}</td><td>${escapeHtml(player.age)}</td><td>${escapeHtml(player.height)}</td><td>${escapeHtml(player.weight)}</td><td>${player.experience===0?'R':escapeHtml(player.experience)}</td><td>${escapeHtml(player.college)}</td><td><span class="availability ${player.injuries.length?'limited':'active'}">${escapeHtml(player.injuries[0]?.status || player.status)}</span></td></tr>`).join('')}</tbody></table></div>${players.length?'':'<div class="empty-state">No roster players match this filter.</div>'}`;
  const search = document.querySelector('#rosterSearch'); const position = document.querySelector('#rosterPosition');
  search.oninput = () => { rosterState.query = search.value; renderRosterData(); const next=document.querySelector('#rosterSearch'); next.focus(); next.setSelectionRange(next.value.length,next.value.length); };
  position.onchange = () => { rosterState.position = position.value; renderRosterData(); };
  root.querySelectorAll('[data-player-id]').forEach(row => { const open=()=>openPlayerProfile(row.dataset.playerId); row.onclick=open; row.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open()}}; });
}

function playerProfileHeader(player, teamName) {
  const bio = [player.position, player.height, player.weight, player.age && player.age !== '-' ? `Age ${player.age}` : ''].filter(Boolean).join(' · ');
  const portrait = player.headshot ? `<img src="${escapeHtml(player.headshot)}" alt="${escapeHtml(player.name)} headshot">` : `<span class="profile-placeholder" aria-hidden="true">${escapeHtml(player.name?.split(' ').map(part=>part[0]).slice(0,2).join('')||'NBA')}</span>`;
  return `<div class="player-profile-head">${portrait}<div><p class="eyebrow">${escapeHtml(teamName)}${player.jersey?` · #${escapeHtml(player.jersey)}`:''}</p><h2 id="playerDialogTitle">${escapeHtml(player.name)}</h2>${bio?`<p>${escapeHtml(bio)}</p>`:''}</div></div>`;
}

async function openPlayerProfile(id, playerOverride = null, teamOverride = '') {
  const player = playerOverride || rosterState.roster?.players.find(item => String(item.id) === String(id)); if (!player || !id) return;
  const teamName = teamOverride || rosterState.roster?.team?.displayName || 'NBA';
  const dialog = document.querySelector('#playerDialog'); const root = document.querySelector('#playerProfile');
  const header = playerProfileHeader(player, teamName);
  root.innerHTML = `${header}<div class="empty-state compact-empty">Loading season statistics…</div>`; dialog.showModal();
  try {
    const response = await fetch(`/api/players/${id}`); if (!response.ok) throw new Error('Profile unavailable'); const profile=await response.json();
    const season = profile.stats.find(item=>item.label==='Regular Season') || profile.stats[0];
    root.innerHTML = `${header}${season?`<div class="profile-stats">${['PTS','REB','AST','FG%'].map(label=>`<div><strong>${escapeHtml(season.values[label]??'—')}</strong><small>${label}</small></div>`).join('')}</div>`:'<div class="empty-state compact-empty">Season statistics are not currently available.</div>'}${profile.awards.length?`<div class="profile-section"><h3>Career honors</h3><div class="award-list">${profile.awards.slice(0,6).map(item=>`<span>${escapeHtml(item.count)} ${escapeHtml(item.name)}</span>`).join('')}</div></div>`:''}${profile.news.length?`<div class="profile-section"><h3>Latest news</h3>${profile.news.map(item=>`<a class="profile-news" href="${escapeHtml(item.url||'#')}" target="_blank" rel="noreferrer"><strong>${escapeHtml(item.headline)}</strong><small>${item.published?new Date(item.published).toLocaleDateString():''}</small></a>`).join('')}</div>`:''}`;
  } catch(error) { root.innerHTML = `${header}<div class="empty-state compact-empty">Season statistics are temporarily unavailable.</div>`; }
}

document.querySelector('#closePlayerDialog').onclick=()=>document.querySelector('#playerDialog').close();
document.querySelector('#playerDialog').onclick=event=>{if(event.target===event.currentTarget)event.currentTarget.close()};

async function loadRoster(teamId) {
  const root = document.querySelector('#rosterView'); root.innerHTML = '<div class="empty-state">Loading roster and coaches…</div>';
  try {
    const response = await fetch(`/api/teams/${teamId}/roster`); if (!response.ok) throw new Error('Roster unavailable');
    const roster = await response.json();
    rosterState.roster = roster; rosterState.query = ''; rosterState.position = 'all'; renderRosterData();
  } catch (error) { root.innerHTML = '<div class="empty-state">This roster is temporarily unavailable.</div>'; }
}

async function loadInjuries() {
  const root = document.querySelector('#injuryReport');
  try {
    const response = await fetch('/api/injuries'); if (!response.ok) throw new Error('Injuries unavailable');
    const payload = await response.json();
    document.querySelector('#injuryTimestamp').textContent = payload.timestamp ? `Updated ${new Date(payload.timestamp).toLocaleString()}` : 'Current report';
    root.innerHTML = payload.teams.length ? payload.teams.map(team => `<section class="panel injury-team"><div class="panel-title"><h2>${escapeHtml(team.displayName)}</h2><span class="pill">${team.injuries.length} listed</span></div>${team.injuries.map(item=>`<article class="injury-card">${item.headshot?`<img src="${escapeHtml(item.headshot)}" alt="">`:'<span class="player-placeholder"></span>'}<div><button class="injury-player" data-injury-player="${escapeHtml(item.athleteId||'')}" data-player-name="${escapeHtml(item.player)}" data-player-position="${escapeHtml(item.position)}" data-player-headshot="${escapeHtml(item.headshot||'')}" data-team-name="${escapeHtml(team.displayName)}"><strong>${escapeHtml(item.player)}</strong></button><small>${escapeHtml(item.position)} · ${item.date?new Date(item.date).toLocaleDateString():'Date unavailable'}</small><p>${escapeHtml(item.shortComment || item.detail || 'No additional details provided.')}</p>${item.returnDate?`<span class="return-date">Expected return: ${escapeHtml(item.returnDate)}</span>`:''}</div><span class="availability limited">${escapeHtml(item.status)}</span></article>`).join('')}</section>`).join('') : '<div class="panel empty-state">No current injuries are listed.</div>';
    root.querySelectorAll('.injury-player[data-injury-player]').forEach(button => button.onclick = () => openPlayerProfile(button.dataset.injuryPlayer, { name: button.dataset.playerName, position: button.dataset.playerPosition, headshot: button.dataset.playerHeadshot }, button.dataset.teamName));
  } catch (error) { root.innerHTML = '<div class="panel empty-state">The injury report is temporarily unavailable.</div>'; }
}

loadTeams(); loadInjuries();

const transactionState = { data: [], team: 'all', type: 'all' };
function renderTransactions() {
  const filtered = transactionState.data.filter(item => (transactionState.team === 'all' || item.team.id === transactionState.team) && (transactionState.type === 'all' || item.type === transactionState.type));
  document.querySelector('#transactionList').innerHTML = filtered.length ? `<div class="transaction-list">${filtered.map(item=>`<article class="transaction-item">${item.team.logo?`<img src="${escapeHtml(item.team.logo)}" alt="">`:''}<div><div class="transaction-meta"><span class="move-type">${escapeHtml(item.type)}</span><time>${item.date?new Date(item.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'Date unavailable'}</time></div><strong>${escapeHtml(item.team.displayName)}</strong><p>${escapeHtml(item.description)}</p></div></article>`).join('')}</div>` : '<div class="empty-state">No transactions match these filters.</div>';
}

async function loadTransactions() {
  try {
    const response = await fetch('/api/transactions'); if (!response.ok) throw new Error('Transactions unavailable');
    const payload = await response.json(); transactionState.data = payload.transactions;
    document.querySelector('#transactionTimestamp').textContent = `${payload.transactions.length} recent moves${payload.timestamp?` · Updated ${new Date(payload.timestamp).toLocaleString()}`:''}`;
    const teamPicker = document.querySelector('#transactionTeam');
    const uniqueTeams = [...new Map(payload.transactions.map(item => [item.team.id, item.team])).values()].sort((a,b)=>a.displayName.localeCompare(b.displayName));
    teamPicker.innerHTML = '<option value="all">All teams</option>' + uniqueTeams.map(team=>`<option value="${team.id}">${escapeHtml(team.displayName)}</option>`).join('');
    const typePicker = document.querySelector('#transactionType');
    const types = [...new Set(payload.transactions.map(item=>item.type))].sort();
    typePicker.innerHTML = '<option value="all">All moves</option>' + types.map(type=>`<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join('');
    teamPicker.onchange = () => { transactionState.team = teamPicker.value; renderTransactions(); };
    typePicker.onchange = () => { transactionState.type = typePicker.value; renderTransactions(); };
    renderTransactions();
  } catch (error) { document.querySelector('#transactionList').innerHTML = '<div class="empty-state">Transactions are temporarily unavailable.</div>'; }
}
loadTransactions();

const money = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
async function loadCapOverview() {
  const season = document.querySelector('#capSeason').value;
  const root = document.querySelector('#capOverview'); root.innerHTML = '<section class="panel empty-state">Loading official cap thresholds…</section>';
  try {
    const response = await fetch(`/api/finance/cap?season=${season}`); if (!response.ok) throw new Error('Cap data unavailable');
    const cap = await response.json();
    const levels = [['Salary cap',cap.cap],['Minimum payroll',cap.minimum],['Luxury tax',cap.tax],['First apron',cap.firstApron],['Second apron',cap.secondApron]];
    root.innerHTML = `<div class="cap-grid">${levels.map((level,index)=>`<section class="panel cap-card level-${index}"><small>${level[0]}</small><strong>${money(level[1])}</strong><div class="cap-meter"><span style="width:${Math.round(level[1]/cap.secondApron*100)}%"></span></div>${index?`<p>${money(level[1]-cap.cap)} ${level[1]>=cap.cap?'above':'below'} the salary cap</p>`:'<p>Base team spending limit</p>'}</section>`).join('')}</div><section class="panel exception-panel"><div><p class="eyebrow">MID-LEVEL EXCEPTIONS</p><h2>Available mechanisms</h2></div>${[['Non-taxpayer MLE',cap.exceptions.nonTaxpayerMidLevel],['Taxpayer MLE',cap.exceptions.taxpayerMidLevel],['Room MLE',cap.exceptions.roomMidLevel]].map(item=>`<div><small>${item[0]}</small><strong>${money(item[1])}</strong></div>`).join('')}<a href="${escapeHtml(cap.source)}" target="_blank" rel="noreferrer">Official NBA release ↗</a></section><div id="payrollRoot"><section class="panel empty-state">Loading team payroll commitments…</section></div>`;
    loadPayrolls(season, cap);
  } catch (error) { root.innerHTML = '<section class="panel empty-state">Official cap information is temporarily unavailable.</section>'; }
}
document.querySelector('#capSeason').onchange = loadCapOverview;
loadCapOverview();

function payrollStatus(value, cap) {
  if (value >= cap.secondApron) return ['Second apron','danger'];
  if (value >= cap.firstApron) return ['First apron','warning'];
  if (value >= cap.tax) return ['Tax team','warning'];
  if (value >= cap.cap) return ['Over cap','neutral'];
  return ['Under cap','good'];
}

async function loadPayrolls(season, cap) {
  const root = document.querySelector('#payrollRoot');
  try {
    const response = await fetch('/api/finance/payrolls'); if (!response.ok) throw new Error('Payrolls unavailable');
    const payload = await response.json();
    if (!payload.seasons.includes(season)) { root.innerHTML = '<section class="panel empty-state">Historical team payroll commitments are not available from this source.</section>'; return; }
    const ranked = [...payload.teams].sort((a,b)=>(b.salaries[season]||0)-(a.salaries[season]||0));
    root.innerHTML = `<section class="panel payroll-panel"><div class="panel-title"><div><p class="eyebrow">TEAM COMMITMENTS</p><h2>${season} payrolls</h2></div><div><select id="contractTeam" class="team-picker" aria-label="Select team contracts">${ranked.map(team=>`<option value="${team.abbreviation}">${escapeHtml(team.displayName)}</option>`).join('')}</select><p class="source-note">Basketball Reference · retrieved ${new Date(payload.retrievedAt).toLocaleString()}</p></div></div><div class="table-scroll"><table class="payroll-table"><thead><tr><th>#</th><th>Team</th><th>Committed</th><th>vs. cap</th><th>Position</th></tr></thead><tbody>${ranked.map((team,index)=>{const amount=team.salaries[season]||0;const state=payrollStatus(amount,cap);return `<tr data-payroll-team="${team.abbreviation}"><td>${index+1}</td><td><strong>${escapeHtml(team.displayName)}</strong></td><td>${money(amount)}</td><td class="${amount>=cap.cap?'over':'under'}">${amount>=cap.cap?'+':'−'}${money(Math.abs(amount-cap.cap))}</td><td><span class="payroll-status ${state[1]}">${state[0]}</span></td></tr>`}).join('')}</tbody></table></div></section><section class="panel contract-panel" id="contractPanel"><div class="empty-state">Loading player contracts…</div></section>`;
    const picker = document.querySelector('#contractTeam'); picker.onchange=()=>loadTeamContracts(picker.value,season);
    document.querySelectorAll('[data-payroll-team]').forEach(row=>row.onclick=()=>{picker.value=row.dataset.payrollTeam;loadTeamContracts(picker.value,season)});
    loadTeamContracts(picker.value, season);
  } catch (error) { root.innerHTML = '<section class="panel empty-state">Team payrolls are temporarily unavailable.</section>'; }
}

async function loadTeamContracts(abbreviation, season) {
  const root = document.querySelector('#contractPanel'); root.innerHTML = '<div class="empty-state">Loading player contracts…</div>';
  try {
    const response = await fetch(`/api/finance/teams/${abbreviation}/contracts`); if (!response.ok) throw new Error('Contracts unavailable');
    const payload = await response.json();
    const future = payload.seasons;
    root.innerHTML = `<div class="panel-title"><div><p class="eyebrow">PLAYER CONTRACTS</p><h2>${escapeHtml(abbreviation)} salary commitments</h2><p class="contract-key"><span class="option-badge player">PO</span> Player option <span class="option-badge team">TO</span> Team option</p></div><a class="source-link" href="${escapeHtml(payload.source)}" target="_blank" rel="noreferrer">View source ↗</a></div><div class="table-scroll"><table class="contract-table"><thead><tr><th>Player</th><th>Age</th>${future.map(year=>`<th>${year}</th>`).join('')}<th>Guaranteed</th></tr></thead><tbody>${payload.players.map(player=>`<tr><td><strong>${escapeHtml(player.name)}</strong></td><td>${player.age??'-'}</td>${future.map(year=>`<td class="${year===season?'current-contract':''}">${player.salaries[year]?money(player.salaries[year]):'—'}${player.options?.[year]?`<span class="option-badge ${player.options[year]==='Player option'?'player':'team'}" title="${escapeHtml(player.options[year])}">${player.options[year]==='Player option'?'PO':'TO'}</span>`:''}</td>`).join('')}<td>${player.guaranteed?money(player.guaranteed):'—'}</td></tr>`).join('')}</tbody></table></div><div id="capHoldPanel"><div class="empty-state">Loading projected cap holds…</div></div>`;
    loadCapHolds(abbreviation);
  } catch (error) { root.innerHTML = '<div class="empty-state">Player contracts are temporarily unavailable.</div>'; }
}

async function loadCapHolds(abbreviation) {
  const root = document.querySelector('#capHoldPanel');
  try {
    const response = await fetch(`/api/finance/teams/${abbreviation}/cap-holds`); if (!response.ok) throw new Error('Cap holds unavailable');
    const payload = await response.json();
    const rows = payload.holds.flatMap(player => Object.entries(player.holds).filter(([,amount])=>amount>0).map(([season,amount])=>({...player,season,amount}))).sort((a,b)=>a.season.localeCompare(b.season)||b.amount-a.amount);
    root.innerHTML = `<div class="cap-hold-heading"><div><p class="eyebrow">PROJECTED CAP HOLDS</p><h3>Upcoming free-agent charges</h3></div><a class="source-link" href="${escapeHtml(payload.source)}" target="_blank" rel="noreferrer">SalarySwish source ↗</a></div>${rows.length?`<div class="table-scroll"><table class="cap-hold-table"><thead><tr><th>Player</th><th>FA type</th><th>Position</th><th>Season</th><th>Cap hold</th></tr></thead><tbody>${rows.map(row=>`<tr><td><strong>${escapeHtml(row.name)}</strong></td><td><span class="fa-type ${row.type.toLowerCase()}">${row.type}</span></td><td>${escapeHtml(row.position)}</td><td>${row.season}</td><td>${money(row.amount)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state">No projected cap holds are listed.</div>'}<p class="cap-hold-note">Cap holds are projected offseason placeholders and can change when a player signs or a team renounces its rights.</p>`;
  } catch (error) { root.innerHTML = '<div class="empty-state">Projected cap holds are temporarily unavailable.</div>'; }
}

const freeAgentState = { players: [], status: 'Available', type: 'all' };
function renderFreeAgents() {
  const players = freeAgentState.players.filter(player => (freeAgentState.status === 'all' || player.availability === freeAgentState.status) && (freeAgentState.type === 'all' || player.type === freeAgentState.type));
  document.querySelector('#freeAgentTable').innerHTML = players.length ? `<div class="table-scroll"><table class="free-agent-table"><thead><tr><th>Player</th><th>Pos</th><th>Age</th><th>Type</th><th>Option/status</th><th>Previous</th><th>New team</th><th>PPG</th><th>RPG</th><th>APG</th></tr></thead><tbody>${players.map(player=>`<tr><td><strong>${escapeHtml(player.name)}</strong></td><td>${escapeHtml(player.position)}</td><td>${player.age??'-'}</td><td><span class="fa-type ${player.type.toLowerCase()}">${escapeHtml(player.type)}</span></td><td>${player.option?`<span class="fa-option">${escapeHtml(player.option)}</span>`:escapeHtml(player.availability)}</td><td>${escapeHtml(player.oldTeam||'—')}</td><td>${escapeHtml(player.newTeam||'—')}</td><td>${player.stats.ppg.toFixed(1)}</td><td>${player.stats.rpg.toFixed(1)}</td><td>${player.stats.apg.toFixed(1)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">No free agents match these filters.</div>';
}

async function loadFreeAgents() {
  try {
    const response = await fetch('/api/free-agents'); if (!response.ok) throw new Error('Free agents unavailable');
    const payload = await response.json(); freeAgentState.players = payload.players;
    document.querySelector('#freeAgentTimestamp').textContent = `${payload.players.length} tracked players · Official NBA tracker · Retrieved ${new Date(payload.retrievedAt).toLocaleString()}`;
    const status = document.querySelector('#freeAgentStatus'); const type = document.querySelector('#freeAgentType');
    status.onchange=()=>{freeAgentState.status=status.value;renderFreeAgents()}; type.onchange=()=>{freeAgentState.type=type.value;renderFreeAgents()};
    renderFreeAgents();
  } catch (error) { document.querySelector('#freeAgentTable').innerHTML = '<div class="empty-state">The free-agent tracker is temporarily unavailable.</div>'; }
}
loadFreeAgents();
