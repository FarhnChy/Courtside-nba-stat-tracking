const teams = {
  BOS:{name:'Celtics',city:'Boston',color:'#087a52'},NYK:{name:'Knicks',city:'New York',color:'#f58426'},
  CLE:{name:'Cavaliers',city:'Cleveland',color:'#7b1636'},MIL:{name:'Bucks',city:'Milwaukee',color:'#1d684b'},
  OKC:{name:'Thunder',city:'Oklahoma City',color:'#1677c8'},DEN:{name:'Nuggets',city:'Denver',color:'#fdb827'},
  LAL:{name:'Lakers',city:'Los Angeles',color:'#552583'},GSW:{name:'Warriors',city:'Golden State',color:'#1d428a'},
  MIN:{name:'Timberwolves',city:'Minnesota',color:'#0c2340'},PHX:{name:'Suns',city:'Phoenix',color:'#e56020'},
  ORL:{name:'Magic',city:'Orlando',color:'#178bd1'},PHI:{name:'76ers',city:'Philadelphia',color:'#d9283e'}
};
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
async function fetchApi(url) {
  let lastError;
  for(let attempt=0;attempt<2;attempt++)try{const response=await window.fetch(url);if(!response.ok)throw new Error(`Request failed (${response.status})`);try{localStorage.setItem(`apiCache:${url}`,await response.clone().text())}catch(_){}return response}catch(error){lastError=error}
  const cached=localStorage.getItem(`apiCache:${url}`);if(cached!=null)return new Response(cached,{status:200,headers:{'content-type':'application/json','x-courtside-cache':'stale'}});throw lastError;
}
const loadingState = (kind='cards') => `<div class="loading-state ${kind}" aria-label="Loading content" aria-busy="true">${Array.from({length:kind==='table'?6:3},(_,index)=>`<span class="skeleton skeleton-${index}"></span>`).join('')}</div>`;
const errorState = (message,retry) => `<div class="empty-state designed-empty"><strong>${escapeHtml(message)}</strong><span>Live data could not be refreshed. Saved data will appear automatically when available.</span><button class="secondary-action" data-retry="${retry}">Try again</button></div>`;
const savedHub = (() => { try { return JSON.parse(localStorage.getItem('courtsideHub') || '{}'); } catch (_) { return {}; } })();
const hubState = {
  theme: savedHub.theme === 'light' ? 'light' : 'dark',
  favoriteTeam: savedHub.favoriteTeam || '',
  fantasy: savedHub.fantasy || null,
  notifications: { games:false, injuries:false, moves:false, ...(savedHub.notifications || {}) },
  teams: []
};
const saveHub = () => localStorage.setItem('courtsideHub', JSON.stringify({ theme:hubState.theme, favoriteTeam:hubState.favoriteTeam, fantasy:hubState.fantasy, notifications:hubState.notifications }));
function applyTheme(theme) {
  hubState.theme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = hubState.theme;
  document.querySelector('meta[name="theme-color"]').content = hubState.theme === 'light' ? '#f4f6fa' : '#09111f';
  document.querySelectorAll('[data-theme-choice]').forEach(button=>button.classList.toggle('active',button.dataset.themeChoice===hubState.theme));
  saveHub();
}
function updateHubIdentity() {
  const favorite = hubState.teams.find(team=>String(team.id)===String(hubState.favoriteTeam));
  const avatar = document.querySelector('#avatarContent');
  avatar.innerHTML = favorite?.logo ? `<img src="${escapeHtml(favorite.logo)}" alt="">` : '★';
  const open = document.querySelector('#openFavoriteTeam'); open.disabled = !favorite;
  open.textContent = favorite ? `Open ${favorite.abbreviation || 'team'} page` : 'Open team page';
  renderFavoriteDashboard();
}
function renderFantasyStatus() {
  const root = document.querySelector('#fantasyStatus');
  root.innerHTML = hubState.fantasy ? `<strong>${escapeHtml(hubState.fantasy.team)}</strong> · ${escapeHtml(hubState.fantasy.league)}<br><small>Saved locally · provider syncing is not connected yet</small>` : 'No fantasy league saved yet.';
}
function populateFavoriteTeams(teamList) {
  hubState.teams = teamList;
  const picker = document.querySelector('#favoriteTeam');
  picker.innerHTML = '<option value="">No favorite selected</option>' + teamList.map(team=>`<option value="${escapeHtml(team.id)}">${escapeHtml(team.displayName)}</option>`).join('');
  picker.value = hubState.favoriteTeam;
  updateHubIdentity();
}
applyTheme(hubState.theme);
document.querySelector('#userHubButton').onclick=()=>{renderFantasyStatus();document.querySelector('#userHubDialog').showModal()};
document.querySelector('#closeUserHub').onclick=()=>document.querySelector('#userHubDialog').close();
document.querySelector('#userHubDialog').onclick=event=>{if(event.target===event.currentTarget)event.currentTarget.close()};
document.querySelectorAll('[data-theme-choice]').forEach(button=>button.onclick=()=>applyTheme(button.dataset.themeChoice));
document.querySelector('#favoriteTeam').onchange=event=>{hubState.favoriteTeam=event.target.value;saveHub();updateHubIdentity()};
document.querySelector('#openFavoriteTeam').onclick=()=>{if(hubState.favoriteTeam){document.querySelector('#userHubDialog').close();openTeamRoster(hubState.favoriteTeam)}};
document.querySelectorAll('[data-notification]').forEach(input=>{input.checked=Boolean(hubState.notifications[input.dataset.notification]);input.onchange=()=>{hubState.notifications[input.dataset.notification]=input.checked;saveHub();document.querySelector('#notificationNote').textContent='Preferences saved. Browser delivery will be added with live alert support.'}});
const showFantasyForm = () => { const form=document.querySelector('#fantasyForm');form.hidden=false;document.querySelector('#fantasyLeagueName').value=hubState.fantasy?.league||'';document.querySelector('#fantasyTeamName').value=hubState.fantasy?.team||'';document.querySelector('#fantasyLeagueName').focus() };
document.querySelector('#startFantasy').onclick=showFantasyForm;
document.querySelector('#checkFantasy').onclick=()=>{if(hubState.fantasy)renderFantasyStatus();else showFantasyForm()};
document.querySelector('#fantasyForm').onsubmit=event=>{event.preventDefault();hubState.fantasy={league:document.querySelector('#fantasyLeagueName').value.trim(),team:document.querySelector('#fantasyTeamName').value.trim()};saveHub();event.currentTarget.hidden=true;renderFantasyStatus()};
const games=[
 {id:1,away:'BOS',home:'NYK',as:87,hs:84,status:'LIVE',detail:'Q4 · 6:42',records:['44–16','38–22'],prob:[61,39]},
 {id:2,away:'DEN',home:'OKC',as:112,hs:118,status:'FINAL',detail:'Final',records:['40–21','48–12'],prob:[0,100]},
 {id:3,away:'LAL',home:'GSW',as:null,hs:null,status:'UPCOMING',detail:'10:00 PM',records:['36–24','34–27'],prob:[46,54]}
];
let selected=games[0], dayOffset=0;
const logo=(code,cls='team-logo')=>teams[code]?.logo?`<img class="${cls} real-team-logo" src="${escapeHtml(teams[code].logo)}" alt="${escapeHtml(teams[code].name||code)} logo">`:`<span class="${cls}" style="--team:${teams[code]?.color||'#334155'}">${code}</span>`;
function dateValue(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function renderDates(){const root=document.querySelector('#dates');root.innerHTML='';for(let i=-3;i<=3;i++){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+i+dayOffset);root.innerHTML+=`<button class="date ${i===0?'active':''}" data-score-date="${dateValue(d)}"><span>${d.toLocaleDateString('en-US',{weekday:'short'})}</span><strong>${d.getDate()}</strong></button>`}root.querySelectorAll('[data-score-date]').forEach(button=>button.onclick=()=>selectScoreDate(button.dataset.scoreDate));const chosen=new Date();chosen.setDate(chosen.getDate()+dayOffset);const picker=document.querySelector('#calendarDate');if(picker)picker.value=dateValue(chosen)}
function renderCards(){document.querySelector('#scoreGrid').innerHTML=games.map(g=>`<article class="score-card ${selected.id===g.id?'selected':''}" data-id="${g.id}"><div class="score-meta"><span class="${g.status==='LIVE'?'live':''}">${g.detail}</span><span>${g.status==='UPCOMING'?'MATCHUP':'NBA'}</span></div>${teamLine(g.away,g.records[0],g.as,g.status==='FINAL'&&g.as>g.hs)}${teamLine(g.home,g.records[1],g.hs,g.status==='FINAL'&&g.hs>g.as)}</article>`).join('');document.querySelectorAll('.score-card').forEach(c=>c.onclick=()=>{selected=games.find(g=>g.id==c.dataset.id);renderCards();renderGame()})}
function teamLine(code,record,score,winner){return `<div class="team-row ${winner?'winner':''}"><button class="score-team-link" data-score-team="${escapeHtml(teams[code]?.id||'')}" aria-label="Open ${escapeHtml(teams[code]?.city||code)} roster">${logo(code)}</button><div><div class="team-name">${teams[code].city} <span class="team-full">${teams[code].name}</span></div><div class="record">${record}</div></div><div class="team-score">${score??'—'}</div></div>`}
const shots=[['made',18,48],['miss',28,20],['made',37,67],['miss',48,87],['made',55,35],['made',64,71],['miss',73,17],['made',82,50],['miss',89,82],['made',43,13],['miss',67,43],['made',32,81]];
const plays=[['6:42','J. Brunson','Driving layup made · 2 PTS'],['7:03','J. Tatum','25-foot three missed'],['7:18','K. Porziņģis','Defensive rebound'],['7:31','M. Bridges','Personal foul · 3rd'],['7:46','J. Brown','Pullup jumper made · 2 PTS']];
function renderGame(){const g=selected,a=teams[g.away],h=teams[g.home];document.querySelector('#gameCenter').innerHTML=`<div class="panel-title"><h2>Game center</h2><span class="pill">${g.detail}</span></div><div class="game-scoreboard"><div class="big-team">${logo(g.away,'team-logo big-logo')}<div><strong>${a.name}</strong><div class="record">${g.records[0]}</div></div></div><div><div class="score-main">${g.as??'—'}<small>–</small>${g.hs??'—'}</div><div class="status-live">${g.status==='LIVE'?'● LIVE · '+g.detail:g.detail}</div></div><div class="big-team">${logo(g.home,'team-logo big-logo')}<div><strong>${h.name}</strong><div class="record">${g.records[1]}</div></div></div></div><div class="prob"><div class="prob-labels"><span>${g.away} ${g.prob[0]}%</span><span>LIVE WIN PROBABILITY</span><span>${g.home} ${g.prob[1]}%</span></div><div class="prob-bar"><span style="width:${g.prob[0]}%"></span><span style="width:${g.prob[1]}%"></span></div></div><div class="tabs"><button class="active">Shot chart</button><button>Team stats</button><button>Box score</button><button>Play-by-play</button></div><div class="court-wrap"><div class="court"><span class="hoop"></span>${shots.map(s=>`<span class="shot ${s[0]}" style="left:${s[1]}%;top:${s[2]}%">${s[0]==='made'?'○':'×'}</span>`).join('')}</div><div class="play-list">${plays.map(p=>`<div class="play"><time>${p[0]}</time><div><strong>${p[1]}</strong>${p[2]}</div></div>`).join('')}</div></div>`}
function renderSide(){document.querySelector('#leaders').innerHTML='<div class="panel-title"><h2>Game leaders</h2><span class="pill">PTS</span></div><div class="empty-state compact-empty">Select a game to load its scoring leaders.</div>';document.querySelector('#injuries').innerHTML=`<div class="panel-title"><h2>Injury report</h2><span class="pill">Demo</span></div>${[['M. Robinson','NYK · C','OUT'],['A. Horford','BOS · C','GTD'],['O. Anunoby','NYK · SF','ACTIVE']].map(x=>`<div class="injury-row"><span>✚</span><div><strong>${x[0]}</strong><small>${x[1]}</small></div><span class="tag">${x[2]}</span></div>`).join('')}`}
const standings=[['CLE',49,11,'.817','—','8–2'],['BOS',44,16,'.733','5.0','7–3'],['NYK',38,22,'.633','11.0','6–4'],['MIL',35,25,'.583','14.0','7–3'],['ORL',33,28,'.541','16.5','5–5'],['PHI',31,29,'.517','18.0','6–4']];
function renderStandings(){document.querySelector('#standingsTable').innerHTML=`<table class="standings-table"><thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th><th>L10</th></tr></thead><tbody>${standings.map((r,i)=>`<tr><td>${i+1}</td><td>${logo(r[0],'mini-logo')}<b>${teams[r[0]].city} ${teams[r[0]].name}</b></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td><td>${r[5]}</td></tr>`).join('')}</tbody></table>`}
const match=(a,ap,b,bp)=>`<div class="matchup"><div class="fav"><span>${a}</span><b>${ap}%</b></div><div><span>${b}</span><span>${bp}%</span></div></div>`;
function renderPredict(){document.querySelector('#bracket').innerHTML='<div class="empty-state feature-hold"><strong>Playoff model coming later</strong><br>This section will use current rosters, standings, injuries, and team strength once the model is ready.</div>';document.querySelector('#modelCard').innerHTML='<div class="empty-state feature-hold"><strong>No forecast published</strong><br>There is currently no title favorite or championship probability.</div>'}
const futures=[['NBA champion',[['BOS','24.8%'],['OKC','22.1%'],['CLE','15.6%'],['DEN','12.4%']]],['MVP award',[['OKC','S. Gilgeous-Alexander'],['DEN','N. Jokić'],['MIL','G. Antetokounmpo'],['BOS','J. Tatum']]],['No. 1 seed',[['CLE','East · 78%'],['OKC','West · 84%'],['BOS','East · 19%'],['DEN','West · 11%']]]];
function renderFutures(){document.querySelector('#futuresGrid').innerHTML='<section class="panel empty-state feature-hold"><strong>Season futures coming later</strong><br>No current odds or award predictions are published yet.</section>'}
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
document.querySelector('#prevDay').onclick=()=>{dayOffset--;renderDates()};document.querySelector('#nextDay').onclick=()=>{dayOffset++;renderDates()};
renderDates();renderCards();renderGame();renderSide();renderStandings();renderPredict();renderFutures();

// Live data layer. The demo above remains an offline fallback.
const live = { date: new Date(), timer: null, summaries: new Map(), source: 'demo' };
const isoDate = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
function selectScoreDate(value) { const [year,month,day]=value.split('-').map(Number); const next=new Date(year,month-1,day,12); const today=new Date(); today.setHours(12,0,0,0); live.date=next; dayOffset=Math.round((next-today)/86400000); renderDates(); loadScoreboard(); }
const statusLabel = status => status.state === 'in' && status.period ? `Q${status.period} · ${status.clock}` : status.detail;

function installLiveGames(payload) {
  if (!payload.games.length) {
    games.splice(0, games.length);
    document.querySelector('#scoreGrid').innerHTML = '<div class="empty-state designed-empty schedule-empty"><strong>No NBA games scheduled</strong><span>This date is clear. Browse another day or catch up around the league.</span><div><button class="secondary-action" data-empty-view="transactionsView">Latest moves</button><button class="secondary-action" data-empty-view="standings">Standings</button></div></div>';
    document.querySelector('#gameCenter').innerHTML = '<div class="empty-state designed-empty"><strong>Nothing on the scoreboard today</strong><span>Game details will appear here as soon as a matchup is selected.</span></div>';
    document.querySelector('#leaders').innerHTML = '<div class="panel-title"><h2>Game leaders</h2><span class="pill">PTS</span></div><div class="empty-state compact-empty">No game is selected.</div>';
    return;
  }
  const normalized = payload.games.map(game => {
    for (const side of [game.away, game.home]) teams[side.abbreviation] = { id: side.id, name: side.name, city: side.city, color: side.color, logo: side.logo };
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
    const response = await fetchApi(`/api/scoreboard?date=${isoDate(live.date)}`);
    if (!response.ok) throw new Error('Feed unavailable');
    const payload = await response.json(); live.source = 'live'; installLiveGames(payload);
    if (status) status.textContent = `${payload.season || 'NBA'} · Live feed · refreshes every 20s`;
  } catch (error) { live.source = 'demo'; if (status) status.textContent = 'Offline demo · live feed unavailable'; }
}

function summaryTabs(summary, active = 'box') {
  const game = selected;
  renderGameLeaders(summary);
  const button = (id, label) => `<button class="summary-tab ${active===id?'active':''}" data-summary-tab="${id}">${label}</button>`;
  const content = active === 'box' ? renderBoxScore(summary.boxscore) : active === 'stats' ? renderTeamStats(summary.teamStats) : renderPlayByPlay(summary.plays);
  const lineTeams = [summary.game?.away, summary.game?.home].filter(Boolean); const periods = Math.max(4,...lineTeams.map(team=>team.lineScores?.length||0));
  const finalGame = game.status === 'FINAL';
  const awayWon = finalGame && Number(game.as) > Number(game.hs);
  const homeWon = finalGame && Number(game.hs) > Number(game.as);
  const lineScore = lineTeams.length===2 ? `<div class="table-scroll"><table class="line-score"><caption class="sr-only">Quarter by quarter scoring</caption><thead><tr><th>Team</th>${Array.from({length:periods},(_,i)=>`<th>${i<4?i+1:`OT${i-3}`}</th>`).join('')}<th>T</th></tr></thead><tbody>${lineTeams.map((team,index)=>`<tr><td>${escapeHtml(team.abbreviation)}</td>${Array.from({length:periods},(_,i)=>`<td>${team.lineScores?.[i]?.value??'—'}</td>`).join('')}<td><strong class="${index===0&&awayWon||index===1&&homeWon?'winning-score':''}">${team.score}</strong></td></tr>`).join('')}</tbody></table></div>`:'';
  const context = [game.raw?.venue,...(game.raw?.broadcasts||[])].filter(Boolean).join(' · ');
  document.querySelector('#gameCenter').innerHTML = `<div class="panel-title"><div><h2>${escapeHtml(game.away)} at ${escapeHtml(game.home)}</h2>${context?`<p class="game-context">${escapeHtml(context)}</p>`:''}</div><span class="pill">${escapeHtml(game.detail)}</span></div><div class="game-scoreboard compact"><button class="big-team summary-team-link" data-summary-team="${escapeHtml(teams[game.away]?.id||'')}">${logo(game.away,'team-logo big-logo')}<strong>${escapeHtml(teams[game.away].name)}</strong></button><div class="score-main"><span class="${awayWon?'winning-score':''}">${game.as}</span><small>–</small><span class="${homeWon?'winning-score':''}">${game.hs}</span></div><button class="big-team summary-team-link" data-summary-team="${escapeHtml(teams[game.home]?.id||'')}">${logo(game.home,'team-logo big-logo')}<strong>${escapeHtml(teams[game.home].name)}</strong></button></div>${lineScore}<div class="tabs">${button('box','Box score')}${button('stats','Team stats')}${button('plays','Play-by-play')}</div><div class="summary-content">${content}</div>`;
  document.querySelectorAll('[data-summary-tab]').forEach(el => el.onclick = () => summaryTabs(summary, el.dataset.summaryTab));
  document.querySelectorAll('[data-summary-team]').forEach(el=>el.onclick=()=>{if(el.dataset.summaryTeam)openTeamRoster(el.dataset.summaryTeam)});
  document.querySelectorAll('.box-player[data-player-id]').forEach(button => {
    button.onclick = () => openPlayerProfile(button.dataset.playerId, {
      name: button.dataset.playerName, position: button.dataset.playerPosition,
      headshot: button.dataset.playerHeadshot, jersey: button.dataset.playerJersey
    }, button.dataset.teamName);
  });
}

function renderGameLeaders(summary) {
  const root = document.querySelector('#leaders');
  const players = (summary.boxscore || []).flatMap(group => group.sections.flatMap(section => {
    const pointsIndex = section.labels.findIndex(label => String(label).toUpperCase() === 'PTS');
    if (pointsIndex < 0) return [];
    return section.athletes
      .filter(player => !player.didNotPlay && Number.isFinite(Number(player.stats[pointsIndex])))
      .map(player => ({ id: player.id, name: player.name, team: group.team.abbreviation, teamName: group.team.displayName, position: player.position, points: Number(player.stats[pointsIndex]), headshot: player.headshot }));
  })).sort((a, b) => b.points - a.points).slice(0, 3);
  root.innerHTML = `<div class="panel-title"><h2>Game leaders</h2><span class="pill">PTS</span></div>${players.length
    ? players.map((player,index)=>`<button class="stat-row leader-row leader-button" data-leader-id="${escapeHtml(player.id||'')}" data-leader-name="${escapeHtml(player.name)}" data-leader-position="${escapeHtml(player.position)}" data-leader-headshot="${escapeHtml(player.headshot||'')}" data-leader-team="${escapeHtml(player.teamName)}"><span class="rank">${String(index+1).padStart(2,'0')}</span>${player.headshot?`<img class="leader-photo" src="${escapeHtml(player.headshot)}" alt="">`:'<span class="player-placeholder leader-photo"></span>'}<span class="leader-copy"><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml([player.team,player.position].filter(Boolean).join(' · '))}</small></span><span class="stat-value">${player.points}</span></button>`).join('')
    : '<div class="empty-state compact-empty">Scoring leaders will appear when box-score stats are available.</div>'}`;
  root.querySelectorAll('[data-leader-id]').forEach(button=>button.onclick=()=>openPlayerProfile(button.dataset.leaderId,{name:button.dataset.leaderName,position:button.dataset.leaderPosition,headshot:button.dataset.leaderHeadshot},button.dataset.leaderTeam));
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
  document.querySelectorAll('.score-team-link[data-score-team]').forEach(button=>button.onclick=event=>{event.stopPropagation();if(button.dataset.scoreTeam)openTeamRoster(button.dataset.scoreTeam)});
}

document.querySelector('#scoreGrid').addEventListener('click', event => { const card = event.target.closest('.score-card'); if (card && live.source === 'live') setTimeout(() => { enhanceScoreCards(); loadGame(card.dataset.id); }, 0); });
enhanceScoreCards();
document.querySelector('#prevDay').onclick = () => { live.date.setDate(live.date.getDate()-1); dayOffset--; renderDates(); loadScoreboard(); };
document.querySelector('#nextDay').onclick = () => { live.date.setDate(live.date.getDate()+1); dayOffset++; renderDates(); loadScoreboard(); };
document.querySelector('#calendarDate').onchange = event => { if (event.target.value) selectScoreDate(event.target.value); };
document.querySelector('#calendarButton').onclick = () => { const picker=document.querySelector('#calendarDate'); if (typeof picker.showPicker==='function') picker.showPicker(); else picker.click(); };
document.querySelector('#liveHome').onclick = () => { live.date=new Date(); dayOffset=0; renderDates(); activateView('scores'); loadScoreboard(); };
loadScoreboard(); live.timer = setInterval(() => loadScoreboard(true), 20_000);

const liveStandings = { conference: 'east', data: null };
function currentSeasonEndYear() { const now = new Date(); return now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear(); }

function renderLiveStandings() {
  const conference = liveStandings.data?.conferences.find(item => item.id === liveStandings.conference);
  const root = document.querySelector('#standingsTable');
  if (!conference?.teams.length) { root.innerHTML = '<div class="empty-state">Standings are not available for this season.</div>'; return; }
  document.querySelector('#standingsSeason').textContent = `${liveStandings.data.season || currentSeasonEndYear()} SEASON · LIVE DATA`;
  root.innerHTML = `<div class="table-scroll"><table class="standings-table live-standings"><thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th><th>HOME</th><th>AWAY</th><th>CONF</th><th>L10</th><th>STRK</th><th>DIFF</th></tr></thead><tbody>${conference.teams.map(team => `<tr class="standing-team" data-standing-team="${escapeHtml(team.id)}" tabindex="0"><td><span class="seed ${team.seed<=6?'playoff':team.seed<=10?'playin':''}">${team.seed}</span></td><td>${team.logo?`<img class="team-mark" src="${escapeHtml(team.logo)}" alt="">`:''}<b>${escapeHtml(team.displayName)}</b></td><td>${team.wins}</td><td>${team.losses}</td><td>${escapeHtml(team.pct)}</td><td>${escapeHtml(team.gb)}</td><td>${escapeHtml(team.home)}</td><td>${escapeHtml(team.away)}</td><td>${escapeHtml(team.conference)}</td><td>${escapeHtml(team.lastTen)}</td><td>${escapeHtml(team.streak)}</td><td>${escapeHtml(team.differential)}</td></tr>`).join('')}</tbody></table></div><div class="standings-key"><span><i class="key-playoff"></i> Playoff seed</span><span><i class="key-playin"></i> Play-in position</span></div>`;
  root.querySelectorAll('[data-standing-team]').forEach(row=>{const open=()=>openTeamRoster(row.dataset.standingTeam);row.onclick=open;row.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open()}}});
}

function openTeamRoster(teamId) { const picker=document.querySelector('#teamPicker'); if ([...picker.options].some(option=>option.value===teamId)) picker.value=teamId; activateView('teamsView'); loadRoster(teamId); }

async function loadStandings() {
  const root = document.querySelector('#standingsTable'); root.innerHTML = loadingState('table');
  try {
    const response = await fetchApi(`/api/standings?season=${currentSeasonEndYear()}`);
    if (!response.ok) throw new Error('Standings unavailable');
    liveStandings.data = await response.json(); renderLiveStandings();
  } catch (error) { root.innerHTML = errorState('Standings are temporarily unavailable','standings'); }
}

document.querySelectorAll('#conferencePicker button').forEach(button => button.onclick = () => {
  liveStandings.conference = button.dataset.conference;
  document.querySelectorAll('#conferencePicker button').forEach(item => item.classList.toggle('active', item === button));
  renderLiveStandings();
});
loadStandings();

async function loadTeams() {
  const picker = document.querySelector('#teamPicker');
  document.querySelector('#rosterView').innerHTML=loadingState('table');
  try {
    const response = await fetchApi('/api/teams'); if (!response.ok) throw new Error('Teams unavailable');
    const payload = await response.json();
    picker.innerHTML = payload.teams.map(team => `<option value="${team.id}">${escapeHtml(team.displayName)}</option>`).join('');
    populateFavoriteTeams(payload.teams);
    picker.onchange = () => loadRoster(picker.value);
    if (payload.teams[0]) loadRoster(payload.teams[0].id);
  } catch (error) { document.querySelector('#rosterView').innerHTML = errorState('Team directory is temporarily unavailable','teams'); }
}

const rosterState = { roster: null, query: '', position: 'all', mode: 'players' };
let currentProfileCandidate = null;
function renderRosterData() {
  const roster = rosterState.roster; const root = document.querySelector('#rosterView');
  if (!roster) return;
  const query = rosterState.query.toLowerCase();
  document.querySelectorAll('#rosterMode button').forEach(button=>button.classList.toggle('active',button.dataset.rosterMode===rosterState.mode));
  const players = roster.players.filter(player => (!query || player.name.toLowerCase().includes(query)) && (rosterState.position === 'all' || player.position === rosterState.position));
  const positions = [...new Set(roster.players.map(player=>player.position).filter(Boolean))].sort();
  root.innerHTML = `<div class="roster-heading">${roster.team.logo?`<img src="${escapeHtml(roster.team.logo)}" alt="">`:''}<div><p class="eyebrow">CURRENT ROSTER</p><h2>${escapeHtml(roster.team.displayName)}</h2><span>${roster.players.length} players · ${players.length} shown</span></div><div class="coach-list"><small>COACHING STAFF</small>${roster.coaches.length?roster.coaches.map(coach=>`<strong>${escapeHtml(coach.name)}</strong>`).join(''):'<strong>Not listed</strong>'}</div></div><div class="roster-tools"><label><span>Search roster</span><input id="rosterSearch" type="search" value="${escapeHtml(rosterState.query)}" placeholder="Player name"></label><label><span>Position</span><select id="rosterPosition"><option value="all">All positions</option>${positions.map(position=>`<option value="${escapeHtml(position)}" ${rosterState.position===position?'selected':''}>${escapeHtml(position)}</option>`).join('')}</select></label></div><div class="table-scroll"><table class="roster-table"><caption class="sr-only">${escapeHtml(roster.team.displayName)} current roster</caption><thead><tr><th>Player</th><th>#</th><th>Pos</th><th>Age</th><th>Height</th><th>Weight</th><th>Experience</th><th>College</th><th>Status</th></tr></thead><tbody>${players.map(player=>`<tr class="profile-row" data-player-id="${player.id}" tabindex="0"><td><div class="player-cell">${player.headshot?`<img src="${escapeHtml(player.headshot)}" alt="">`:'<span class="player-placeholder"></span>'}<strong>${escapeHtml(player.name)}</strong></div></td><td>${escapeHtml(player.jersey)}</td><td>${escapeHtml(player.position)}</td><td>${escapeHtml(player.age)}</td><td>${escapeHtml(player.height)}</td><td>${escapeHtml(player.weight)}</td><td>${player.experience===0?'R':escapeHtml(player.experience)}</td><td>${escapeHtml(player.college)}</td><td><span class="availability ${player.injuries.length?'limited':'active'}">${escapeHtml(player.injuries[0]?.status || player.status)}</span></td></tr>`).join('')}</tbody></table></div>${players.length?'':'<div class="empty-state">No roster players match this filter.</div>'}`;
  const coachList = root.querySelector('.coach-list'); if (coachList) coachList.remove();
  const rosterTools = root.querySelector('.roster-tools'); const playerTable = rosterTools?.nextElementSibling;
  const coaching = document.createElement('section'); coaching.className='coaching-roster'; coaching.innerHTML=`<div class="coaching-heading"><p class="eyebrow">COACHING STAFF</p><h3>${roster.coaches.length} staff members</h3></div><div class="coaching-grid">${roster.coaches.length?roster.coaches.map(coach=>`<article class="coach-profile">${coach.headshot?`<img src="${escapeHtml(coach.headshot)}" alt="${escapeHtml(coach.name)}">`:`<span class="coach-avatar">${escapeHtml(coach.name.split(' ').map(part=>part[0]).slice(0,2).join(''))}</span>`}<div><strong>${escapeHtml(coach.name)}</strong><span>${escapeHtml(coach.role||'Coach')}</span>${coach.record?`<small>${coach.record.years} NBA head-coaching seasons · ${coach.record.wins}–${coach.record.losses}${coach.record.titles?` · ${coach.record.titles}× champion`:''}</small>`:''}</div></article>`).join(''):'<div class="empty-state">Coaching staff information is unavailable.</div>'}</div>`; root.append(coaching);
  const showCoaches=rosterState.mode==='coaches'; if(rosterTools)rosterTools.hidden=showCoaches;if(playerTable)playerTable.hidden=showCoaches;coaching.hidden=!showCoaches;
  const search = document.querySelector('#rosterSearch'); const position = document.querySelector('#rosterPosition');
  search.oninput = () => { rosterState.query = search.value; renderRosterData(); const next=document.querySelector('#rosterSearch'); next.focus(); next.setSelectionRange(next.value.length,next.value.length); };
  position.onchange = () => { rosterState.position = position.value; renderRosterData(); };
  root.querySelectorAll('[data-player-id]').forEach(row => { const open=()=>openPlayerProfile(row.dataset.playerId); row.onclick=open; row.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open()}}; });
}

function playerProfileHeader(player, teamName) {
  const bio = [player.position, player.height, player.weight, player.age && player.age !== '-' ? `Age ${player.age}` : ''].filter(Boolean).join(' · ');
  const portrait = player.headshot ? `<img src="${escapeHtml(player.headshot)}" alt="${escapeHtml(player.name)} headshot">` : `<span class="profile-placeholder" aria-hidden="true">${escapeHtml(player.name?.split(' ').map(part=>part[0]).slice(0,2).join('')||'NBA')}</span>`;
  return `<div class="player-profile-head">${portrait}<div><p class="eyebrow">${escapeHtml(teamName)}${player.jersey?` · #${escapeHtml(player.jersey)}`:''}</p><h2 id="playerDialogTitle">${escapeHtml(player.name)}</h2>${bio?`<p>${escapeHtml(bio)}</p>`:''}<button class="secondary-action add-comparison" data-compare-player="${escapeHtml(player.id||'')}">Add to comparison</button></div></div>`;
}

async function openPlayerProfile(id, playerOverride = null, teamOverride = '') {
  const player = playerOverride || rosterState.roster?.players.find(item => String(item.id) === String(id)); if (!player || !id) return;
  const teamName = teamOverride || rosterState.roster?.team?.displayName || 'NBA'; currentProfileCandidate={...player,id,teamName};
  const dialog = document.querySelector('#playerDialog'); const root = document.querySelector('#playerProfile');
  const header = playerProfileHeader(player, teamName);
  root.innerHTML = `${header}<div class="empty-state compact-empty">Loading season statistics…</div>`; dialog.showModal();
  try {
    const response = await fetchApi(`/api/players/${id}`); if (!response.ok) throw new Error('Profile unavailable'); const profile=await response.json();
    const history = profile.history || []; const latest = history[history.length-1]; const detailedPlayer={...player,position:profile.positions||player.position}; const detailedHeader=playerProfileHeader(detailedPlayer,teamName); currentProfileCandidate={...detailedPlayer,id,teamName,profile,latest};
    root.innerHTML = `${detailedHeader}${latest?`<div class="profile-stats">${['PTS','REB','AST','FG%'].map(label=>`<div><strong>${escapeHtml(latest.values[label]??'—')}</strong><small>${label}</small></div>`).join('')}</div><div class="profile-section"><h3>NBA season history</h3><div class="table-scroll"><table class="career-table"><thead><tr><th>Season</th><th>Team</th><th>GP</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>FG%</th><th>3P%</th><th>FT%</th><th>STL</th><th>BLK</th></tr></thead><tbody>${history.map(row=>`<tr><td><strong>${escapeHtml(row.season)}</strong></td><td>${escapeHtml(row.team)}</td>${['GP','MIN','PTS','REB','AST','FG%','3P%','FT%','STL','BLK'].map(label=>`<td>${escapeHtml(row.values[label]??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`:'<div class="empty-state compact-empty">Career statistics are not currently available.</div>'}${profile.awards?.length?`<div class="profile-section"><h3>Career accolades</h3><div class="accolade-grid">${profile.awards.map(award=>`<article><strong>${escapeHtml(award.count)} ${escapeHtml(award.name)}</strong><small>${escapeHtml((award.seasons||[]).join(' · '))}</small></article>`).join('')}</div></div>`:''}`;
  } catch(error) { root.innerHTML = `${header}<div class="empty-state compact-empty">Season statistics are temporarily unavailable.</div>`; }
}

document.querySelector('#closePlayerDialog').onclick=()=>document.querySelector('#playerDialog').close();
document.querySelector('#playerDialog').onclick=event=>{if(event.target===event.currentTarget)event.currentTarget.close()};

async function loadRoster(teamId) {
  const root = document.querySelector('#rosterView'); root.innerHTML = loadingState('table');
  try {
    const response = await fetchApi(`/api/teams/${teamId}/roster`); if (!response.ok) throw new Error('Roster unavailable');
    const roster = await response.json();
    rosterState.roster = roster; rosterState.query = ''; rosterState.position = 'all'; renderTeamDashboard(roster); renderRosterData();
  } catch (error) { root.innerHTML = errorState('This roster is temporarily unavailable','roster'); }
}

document.querySelectorAll('#rosterMode button').forEach(button=>button.onclick=()=>{rosterState.mode=button.dataset.rosterMode;renderRosterData()});

async function loadInjuries() {
  const root = document.querySelector('#injuryReport');
  root.innerHTML=loadingState('cards');
  try {
    const response = await fetchApi('/api/injuries'); if (!response.ok) throw new Error('Injuries unavailable');
    const payload = await response.json();
    document.querySelector('#injuryTimestamp').textContent = payload.timestamp ? `Updated ${new Date(payload.timestamp).toLocaleString()}` : 'Current report';
    root.innerHTML = payload.teams.length ? payload.teams.map(team => `<section class="panel injury-team"><div class="panel-title"><h2>${escapeHtml(team.displayName)}</h2><span class="pill">${team.injuries.length} listed</span></div>${team.injuries.map(item=>`<article class="injury-card">${item.headshot?`<img src="${escapeHtml(item.headshot)}" alt="">`:'<span class="player-placeholder"></span>'}<div><button class="injury-player" data-injury-player="${escapeHtml(item.athleteId||'')}" data-player-name="${escapeHtml(item.player)}" data-player-position="${escapeHtml(item.position)}" data-player-headshot="${escapeHtml(item.headshot||'')}" data-team-name="${escapeHtml(team.displayName)}"><strong>${escapeHtml(item.player)}</strong></button><small>${escapeHtml(item.position)} · ${item.date?new Date(item.date).toLocaleDateString():'Date unavailable'}</small><p>${escapeHtml(item.shortComment || item.detail || 'No additional details provided.')}</p>${item.returnDate?`<span class="return-date">Expected return: ${escapeHtml(item.returnDate)}</span>`:''}</div><span class="availability limited">${escapeHtml(item.status)}</span></article>`).join('')}</section>`).join('') : '<div class="panel empty-state">No current injuries are listed.</div>';
    root.querySelectorAll('.injury-player[data-injury-player]').forEach(button => button.onclick = () => openPlayerProfile(button.dataset.injuryPlayer, { name: button.dataset.playerName, position: button.dataset.playerPosition, headshot: button.dataset.playerHeadshot }, button.dataset.teamName));
  } catch (error) { root.innerHTML = `<section class="panel">${errorState('The injury report is temporarily unavailable','injuries')}</section>`; }
}

loadTeams(); loadInjuries();

const transactionState = { data: [], team: 'all', type: 'all' };
function renderTransactions() {
  const filtered = transactionState.data.filter(item => (transactionState.team === 'all' || item.team.id === transactionState.team) && (transactionState.type === 'all' || item.type === transactionState.type));
  document.querySelector('#transactionList').innerHTML = filtered.length ? `<div class="transaction-list">${filtered.map(item=>`<article class="transaction-item">${item.player?.headshot?`<img class="transaction-player-photo" src="${escapeHtml(item.player.headshot)}" alt="${escapeHtml(item.player.name)}">`:item.team.logo?`<img src="${escapeHtml(item.team.logo)}" alt="">`:''}<div><div class="transaction-meta"><span class="move-type">${escapeHtml(item.type)}</span><time>${item.date?`${item.dateLabel?`${escapeHtml(item.dateLabel)} `:''}${new Date(item.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`:'Date unavailable'}</time></div><strong>${escapeHtml(item.team.displayName)}</strong><p>${escapeHtml(item.description)}</p>${item.contract?`<div class="move-contract"><strong>${item.contract.years} year${item.contract.years===1?'':'s'} · ${money(item.contract.value)}</strong>${item.contract.details?`<span>${escapeHtml(item.contract.details)}</span>`:''}</div>`:''}<a class="transaction-link" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">View source ↗</a></div></article>`).join('')}</div>` : '<div class="empty-state">No transactions match these filters.</div>';
  document.querySelectorAll('.transaction-item').forEach((card,index)=>{card.tabIndex=0;const open=event=>{if(event?.target?.closest('a'))return;openTransactionDetail(filtered[index])};card.onclick=open;card.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open(event)}}});
}

async function loadTransactions() {
  document.querySelector('#transactionList').innerHTML=loadingState('cards');
  try {
    const response = await fetchApi('/api/transactions'); if (!response.ok) throw new Error('Transactions unavailable');
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
  } catch (error) { document.querySelector('#transactionList').innerHTML = errorState('Transactions are temporarily unavailable','transactions'); }
}
loadTransactions();

const money = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
async function loadCapOverview() {
  const season = document.querySelector('#capSeason').value;
  const root = document.querySelector('#capOverview'); root.innerHTML = `<section class="panel">${loadingState('cards')}</section>`;
  try {
    const response = await fetchApi(`/api/finance/cap?season=${season}`); if (!response.ok) throw new Error('Cap data unavailable');
    const cap = await response.json();
    const levels = [['Salary cap',cap.cap],['Minimum payroll',cap.minimum],['Luxury tax',cap.tax],['First apron',cap.firstApron],['Second apron',cap.secondApron]];
    root.innerHTML = `<div class="finance-layout"><div class="finance-overview-column"><div class="cap-grid">${levels.map((level,index)=>`<section class="panel cap-card level-${index}"><small>${level[0]}</small><strong>${money(level[1])}</strong><div class="cap-meter"><span style="width:${Math.round(level[1]/cap.secondApron*100)}%"></span></div>${index?`<p>${money(level[1]-cap.cap)} ${level[1]>=cap.cap?'above':'below'} the salary cap</p>`:'<p>Base team spending limit</p>'}</section>`).join('')}</div><section class="panel exception-panel"><div><p class="eyebrow">MID-LEVEL EXCEPTIONS</p><h2>Available mechanisms</h2></div>${[['Non-taxpayer MLE',cap.exceptions.nonTaxpayerMidLevel],['Taxpayer MLE',cap.exceptions.taxpayerMidLevel],['Room MLE',cap.exceptions.roomMidLevel]].map(item=>`<div><small>${item[0]}</small><strong>${money(item[1])}</strong></div>`).join('')}<a href="${escapeHtml(cap.source)}" target="_blank" rel="noreferrer">Official NBA release ↗</a></section></div><div id="payrollRoot"><section class="panel empty-state payroll-loading">Loading team payroll commitments…</section></div></div>`;
    loadPayrolls(season, cap);
  } catch (error) { root.innerHTML = `<section class="panel">${errorState('Official cap information is temporarily unavailable','finance')}</section>`; }
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
    const response = await fetchApi('/api/finance/payrolls'); if (!response.ok) throw new Error('Payrolls unavailable');
    const payload = await response.json();
    if (!payload.seasons.includes(season)) { root.innerHTML = '<section class="panel empty-state">Historical team payroll commitments are not available from this source.</section>'; return; }
    const ranked = [...payload.teams].sort((a,b)=>(b.salaries[season]||0)-(a.salaries[season]||0));
    root.innerHTML = `<section class="panel payroll-panel"><div class="panel-title"><div><p class="eyebrow">ALL-TEAM COMMITMENTS</p><h2>${season} payrolls</h2></div><p class="source-note">Basketball Reference · retrieved ${new Date(payload.retrievedAt).toLocaleString()}</p></div><div class="table-scroll compact-payroll-scroll"><table class="payroll-table compact-payroll-table"><thead><tr><th>#</th><th>Team</th><th>Committed</th><th>Position</th></tr></thead><tbody>${ranked.map((team,index)=>{const amount=team.salaries[season]||0;const state=payrollStatus(amount,cap);return `<tr data-payroll-team="${team.abbreviation}" tabindex="0"><td>${index+1}</td><td><strong>${escapeHtml(team.displayName)}</strong></td><td>${money(amount)}</td><td><span class="payroll-status ${state[1]}">${state[0]}</span></td></tr>`}).join('')}</tbody></table></div></section><section class="panel contract-panel" id="contractPanel"><div class="contract-controls"><div><p class="eyebrow">SELECTED TEAM FINANCES</p><h2>Player contracts</h2></div><label><span>Team</span><select id="contractTeam" class="team-picker" aria-label="Select team contracts">${ranked.map(team=>`<option value="${team.abbreviation}">${escapeHtml(team.displayName)}</option>`).join('')}</select></label><label><span>Starting season</span><select id="contractSeason" class="team-picker" aria-label="Select contract season">${payload.seasons.map(year=>`<option value="${year}" ${year===season?'selected':''}>${year}</option>`).join('')}</select></label></div><div id="contractContent"><div class="empty-state">Loading player contracts…</div></div></section>`;
    const picker = document.querySelector('#contractTeam'); const seasonPicker = document.querySelector('#contractSeason');
    const refreshContracts=()=>loadTeamContracts(picker.value,seasonPicker.value);
    picker.onchange=refreshContracts; seasonPicker.onchange=refreshContracts;
    document.querySelectorAll('[data-payroll-team]').forEach(row=>{const open=()=>{picker.value=row.dataset.payrollTeam;refreshContracts()};row.onclick=open;row.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open()}}});
    refreshContracts();
  } catch (error) { root.innerHTML = `<section class="panel">${errorState('Team payrolls are temporarily unavailable','finance')}</section>`; }
}

async function loadTeamContracts(abbreviation, season) {
  const root = document.querySelector('#contractContent'); root.innerHTML = '<div class="empty-state">Loading player contracts…</div>';
  try {
    const response = await fetchApi(`/api/finance/teams/${abbreviation}/contracts`); if (!response.ok) throw new Error('Contracts unavailable');
    const payload = await response.json();
    const start = Math.max(0,payload.seasons.indexOf(season)); const future = payload.seasons.slice(start,start+2); if(!future.length)future.push(...payload.seasons.slice(0,2));
    root.innerHTML = `<div class="selected-team-heading"><div><h3>${escapeHtml(abbreviation)} salary commitments</h3><p class="contract-key"><span class="option-badge player">PO</span> Player option <span class="option-badge team">TO</span> Team option</p></div><a class="source-link" href="${escapeHtml(payload.source)}" target="_blank" rel="noreferrer">View source ↗</a></div><div class="table-scroll"><table class="contract-table"><thead><tr><th>Player</th><th>Age</th>${future.map(year=>`<th>${year}</th>`).join('')}<th>Guaranteed</th></tr></thead><tbody>${payload.players.map(player=>`<tr><td><strong>${escapeHtml(player.name)}</strong></td><td>${player.age??'-'}</td>${future.map(year=>`<td class="${year===season?'current-contract':''}">${player.salaries[year]?money(player.salaries[year]):'—'}${player.options?.[year]?`<span class="option-badge ${player.options[year]==='Player option'?'player':'team'}" title="${escapeHtml(player.options[year])}">${player.options[year]==='Player option'?'PO':'TO'}</span>`:''}</td>`).join('')}<td>${player.guaranteed?money(player.guaranteed):'—'}</td></tr>`).join('')}</tbody></table></div><button class="secondary-action show-cap-holds" id="showCapHolds">I want to see projected cap holds</button><div id="capHoldPanel" hidden></div>`;
    document.querySelector('#showCapHolds').onclick=event=>{event.currentTarget.hidden=true;const panel=document.querySelector('#capHoldPanel');panel.hidden=false;panel.innerHTML='<div class="empty-state compact-empty">Loading projected cap holds…</div>';loadCapHolds(abbreviation)};
  } catch (error) { root.innerHTML = '<div class="empty-state">Player contracts are temporarily unavailable.</div>'; }
}

async function loadCapHolds(abbreviation) {
  const root = document.querySelector('#capHoldPanel');
  try {
    const response = await fetchApi(`/api/finance/teams/${abbreviation}/cap-holds`); if (!response.ok) throw new Error('Cap holds unavailable');
    const payload = await response.json();
    const rows = payload.holds.flatMap(player => Object.entries(player.holds).filter(([,amount])=>amount>0).map(([season,amount])=>({...player,season,amount}))).sort((a,b)=>a.season.localeCompare(b.season)||b.amount-a.amount);
    root.innerHTML = `<div class="cap-hold-heading"><div><p class="eyebrow">PROJECTED CAP HOLDS</p><h3>Upcoming free-agent charges</h3></div><a class="source-link" href="${escapeHtml(payload.source)}" target="_blank" rel="noreferrer">SalarySwish source ↗</a></div>${rows.length?`<div class="table-scroll"><table class="cap-hold-table"><thead><tr><th>Player</th><th>FA type</th><th>Position</th><th>Season</th><th>Cap hold</th></tr></thead><tbody>${rows.map(row=>`<tr><td><strong>${escapeHtml(row.name)}</strong></td><td><span class="fa-type ${row.type.toLowerCase()}">${row.type}</span></td><td>${escapeHtml(row.position)}</td><td>${row.season}</td><td>${money(row.amount)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state">No projected cap holds are listed.</div>'}<p class="cap-hold-note">Cap holds are projected offseason placeholders and can change when a player signs or a team renounces its rights.</p>`;
  } catch (error) { root.innerHTML = '<div class="empty-state">Projected cap holds are temporarily unavailable.</div>'; }
}

const freeAgentState = { players: [], status: localStorage.getItem('freeAgentStatus') || 'Available', type: localStorage.getItem('freeAgentType') || 'all', position:'all', sort:'best', query:'' };
function renderFreeAgents() {
  const score=player=>(Number(player.stats?.ppg)||0)+(Number(player.stats?.rpg)||0)*.7+(Number(player.stats?.apg)||0)*.8;
  const players = freeAgentState.players.filter(player => (freeAgentState.status === 'all' || player.availability === freeAgentState.status) && (freeAgentState.type === 'all' || player.type === freeAgentState.type) && (freeAgentState.position==='all'||player.position===freeAgentState.position) && (!freeAgentState.query||player.name.toLowerCase().includes(freeAgentState.query))).sort((a,b)=>freeAgentState.sort==='name'?a.name.localeCompare(b.name):freeAgentState.sort==='age'?(a.age??99)-(b.age??99):freeAgentState.sort==='ppg'?(b.stats?.ppg||0)-(a.stats?.ppg||0):score(b)-score(a));
  document.querySelector('#freeAgentTable').innerHTML = players.length ? `<div class="table-scroll"><table class="free-agent-table"><thead><tr><th>Player</th><th>Pos</th><th>Age</th><th>Type</th><th>Option/status</th><th>Previous</th><th>New team</th><th>PPG</th><th>RPG</th><th>APG</th></tr></thead><tbody>${players.map(player=>`<tr><td><button class="box-player free-agent-player" data-free-agent-id="${escapeHtml(player.id||'')}" data-player-name="${escapeHtml(player.name)}" data-player-position="${escapeHtml(player.position)}" data-player-headshot="${escapeHtml(player.headshot||'')}" data-team-name="${escapeHtml(player.newTeam||player.oldTeam||'NBA free agent')}"><span class="player-cell">${player.headshot?`<img src="${escapeHtml(player.headshot)}" alt="">`:'<span class="player-placeholder"></span>'}<strong>${escapeHtml(player.name)}</strong></span></button></td><td>${escapeHtml(player.position)}</td><td>${player.age??'-'}</td><td><span class="fa-type ${player.type.toLowerCase()}">${escapeHtml(player.type)}</span></td><td>${player.option?`<span class="fa-option">${escapeHtml(player.option)}</span>`:escapeHtml(player.availability)}</td><td>${escapeHtml(player.oldTeam||'—')}</td><td>${escapeHtml(player.newTeam||'—')}</td><td>${player.stats.ppg.toFixed(1)}</td><td>${player.stats.rpg.toFixed(1)}</td><td>${player.stats.apg.toFixed(1)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">No free agents match these filters.</div>';
  if(!players.length)document.querySelector('#freeAgentTable').innerHTML='<div class="empty-state designed-empty"><strong>No free agents match</strong><span>Try changing the search, position, status, or free-agent type.</span><button class="secondary-action" data-clear-free-agents>Clear filters</button></div>';
  document.querySelectorAll('.free-agent-player[data-free-agent-id]').forEach(button=>button.onclick=()=>openPlayerProfile(button.dataset.freeAgentId,{name:button.dataset.playerName,position:button.dataset.playerPosition,headshot:button.dataset.playerHeadshot},button.dataset.teamName));
  if(freeAgentState.sort==='best'&&freeAgentState.status==='Available')document.querySelectorAll('.free-agent-player .player-cell').forEach((cell,index)=>{if(index<10)cell.insertAdjacentHTML('beforeend',`<span class="best-available-rank">#${index+1} best available</span>`)});
}

async function loadFreeAgents() {
  document.querySelector('#freeAgentTable').innerHTML=loadingState('table');
  try {
    const response = await fetchApi('/api/free-agents'); if (!response.ok) throw new Error('Free agents unavailable');
    const payload = await response.json(); freeAgentState.players = payload.players;
    document.querySelector('#freeAgentTimestamp').textContent = `${payload.players.length} tracked players · Official NBA tracker · Retrieved ${new Date(payload.retrievedAt).toLocaleString()} · Best available uses recent PPG, RPG and APG`;
    const status = document.querySelector('#freeAgentStatus'); const type = document.querySelector('#freeAgentType'); const position=document.querySelector('#freeAgentPosition'); const sort=document.querySelector('#freeAgentSort'); const search=document.querySelector('#freeAgentSearch'); status.value=freeAgentState.status;type.value=freeAgentState.type;
    position.innerHTML='<option value="all">All positions</option>'+[...new Set(payload.players.map(player=>player.position).filter(Boolean))].sort().map(value=>`<option>${escapeHtml(value)}</option>`).join('');
    status.onchange=()=>{freeAgentState.status=status.value;localStorage.setItem('freeAgentStatus',status.value);renderFreeAgents()}; type.onchange=()=>{freeAgentState.type=type.value;localStorage.setItem('freeAgentType',type.value);renderFreeAgents()}; position.onchange=()=>{freeAgentState.position=position.value;renderFreeAgents()};sort.onchange=()=>{freeAgentState.sort=sort.value;renderFreeAgents()};search.oninput=()=>{freeAgentState.query=search.value.trim().toLowerCase();renderFreeAgents()};
    renderFreeAgents();
  } catch (error) { document.querySelector('#freeAgentTable').innerHTML = errorState('The free-agent tracker is temporarily unavailable','free-agents'); }
}
loadFreeAgents();

// Cross-feature navigation and personalized surfaces.
const comparisonState = [];
let searchTimer = null;
const searchDialog=document.querySelector('#searchDialog');
document.querySelector('#searchButton').onclick=()=>{searchDialog.showModal();setTimeout(()=>document.querySelector('#globalSearchInput').focus(),0)};
document.querySelector('#closeSearch').onclick=()=>searchDialog.close();
searchDialog.onclick=event=>{if(event.target===searchDialog)searchDialog.close()};
document.querySelector('#globalSearchInput').oninput=event=>{clearTimeout(searchTimer);const query=event.target.value.trim();const root=document.querySelector('#searchResults');if(query.length<2){root.innerHTML='<div class="empty-state compact-empty">Enter at least two characters.</div>';return}root.innerHTML='<div class="empty-state compact-empty">Searching players, teams, and games…</div>';searchTimer=setTimeout(async()=>{try{const response=await fetch(`/api/search?q=${encodeURIComponent(query)}`);if(!response.ok)throw new Error();const payload=await response.json();root.innerHTML=payload.results.length?payload.results.map((item,index)=>`<button class="search-result" data-search-index="${index}">${item.logo||item.headshot?`<img src="${escapeHtml(item.logo||item.headshot)}" alt="">`:'<span class="search-icon">⌕</span>'}<span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.subtitle)}</small></span><em>${escapeHtml(item.kind)}</em></button>`).join(''):'<div class="empty-state compact-empty">No matching players, teams, or games.</div>';root.querySelectorAll('[data-search-index]').forEach(button=>button.onclick=()=>{const item=payload.results[Number(button.dataset.searchIndex)];searchDialog.close();if(item.kind==='team')openTeamRoster(item.id);else if(item.kind==='player')openPlayerProfile(item.id,{id:item.id,name:item.name,position:item.position,headshot:item.headshot},item.teamName);else{activateView('scores');const game=games.find(game=>String(game.id)===String(item.id));if(game){selected=game;renderCards();loadGame(game.id)}}})}catch(_){root.innerHTML='<div class="empty-state compact-empty">Search is temporarily unavailable. Try again.</div>'}},250)};

async function renderFavoriteDashboard() {
  const root=document.querySelector('#favoriteDashboard'); const favorite=hubState.teams.find(team=>String(team.id)===String(hubState.favoriteTeam));
  if(!favorite){root.hidden=true;return}root.hidden=false;root.innerHTML='<div class="panel empty-state compact-empty">Loading your favorite team…</div>';
  try{const [roster,standingPayload,injuryPayload,movesPayload]=await Promise.all([fetch(`/api/teams/${favorite.id}/roster`).then(r=>r.ok?r.json():Promise.reject()),fetch(`/api/standings?season=${currentSeasonEndYear()}`).then(r=>r.ok?r.json():null),fetch('/api/injuries').then(r=>r.ok?r.json():null),fetch('/api/transactions').then(r=>r.ok?r.json():null)]);const standing=standingPayload?.conferences.flatMap(group=>group.teams).find(team=>String(team.id)===String(favorite.id));const injuries=injuryPayload?.teams.find(team=>team.displayName===favorite.displayName)?.injuries||[];const moves=(movesPayload?.transactions||[]).filter(item=>item.team.abbreviation===favorite.abbreviation||String(item.team.id)===String(favorite.id)).slice(0,2);const game=games.find(item=>item.away===favorite.abbreviation||item.home===favorite.abbreviation);root.innerHTML=`<div class="favorite-head">${favorite.logo?`<img src="${escapeHtml(favorite.logo)}" alt="">`:''}<div><p class="eyebrow">YOUR TEAM</p><h2>${escapeHtml(favorite.displayName)}</h2><p>${standing?`${standing.wins}–${standing.losses} · ${standing.seed} seed`:'Season record loading'}</p></div><button class="secondary-action" id="favoriteTeamPage">Open team dashboard</button></div><div class="favorite-metrics"><div><small>Next/current game</small><strong>${game?`${game.away} ${game.detail} ${game.home}`:'No game today'}</strong></div><div><small>Roster</small><strong>${roster.players.length} players</strong></div><div><small>Injuries</small><strong>${injuries.length} listed</strong></div><div><small>Latest move</small><strong>${escapeHtml(moves[0]?.description||'No recent move')}</strong></div></div>`;document.querySelector('#favoriteTeamPage').onclick=()=>openTeamRoster(favorite.id)}catch(_){root.innerHTML='<div class="panel empty-state compact-empty">Favorite-team summary is temporarily unavailable.</div>'}
}

async function renderTeamDashboard(roster) {
  const root=document.querySelector('#teamDashboard');root.innerHTML='<section class="panel empty-state compact-empty">Loading team dashboard…</section>';
  try{const [standingPayload,injuryPayload,movesPayload]=await Promise.all([fetch(`/api/standings?season=${currentSeasonEndYear()}`).then(r=>r.ok?r.json():null),fetch('/api/injuries').then(r=>r.ok?r.json():null),fetch('/api/transactions').then(r=>r.ok?r.json():null)]);const standing=standingPayload?.conferences.flatMap(group=>group.teams).find(team=>String(team.id)===String(roster.team.id));const injuries=injuryPayload?.teams.find(team=>team.displayName===roster.team.displayName)?.injuries||[];const moves=(movesPayload?.transactions||[]).filter(item=>item.team.abbreviation===roster.team.abbreviation).slice(0,3);root.innerHTML=`<section class="team-summary-grid"><article class="panel"><small>Season</small><strong>${standing?`${standing.wins}–${standing.losses}`:'—'}</strong><span>${standing?`${standing.seed} seed · ${standing.lastTen} last 10`:'Standings unavailable'}</span></article><article class="panel"><small>Availability</small><strong>${injuries.length}</strong><span>players on injury report</span></article><article class="panel"><small>Roster</small><strong>${roster.players.length}</strong><span>${roster.coaches.length} coaches listed</span></article><article class="panel team-recent-moves"><small>Recent moves</small>${moves.length?moves.map(move=>`<span>${escapeHtml(move.description)}</span>`).join(''):'<span>No recent moves.</span>'}</article></section>`}catch(_){root.innerHTML=''}
}

function updateCompareTray(){const tray=document.querySelector('#compareTray');tray.hidden=!comparisonState.length;document.querySelector('#compareCount').textContent=`${comparisonState.length} player${comparisonState.length===1?'':'s'} selected`;document.querySelector('#openComparison').disabled=comparisonState.length<2}
document.querySelector('#playerDialog').addEventListener('click',event=>{if(!event.target.closest('.add-comparison')||!currentProfileCandidate)return;if(!comparisonState.some(player=>String(player.id)===String(currentProfileCandidate.id))&&comparisonState.length<3)comparisonState.push(currentProfileCandidate);updateCompareTray()});
document.querySelector('#clearComparison').onclick=()=>{comparisonState.splice(0);updateCompareTray()};
document.querySelector('#openComparison').onclick=()=>{const labels=['PTS','REB','AST','FG%','3P%','FT%'];document.querySelector('#comparisonContent').innerHTML=`<h2 id="comparisonTitle">Player comparison</h2><div class="comparison-grid">${comparisonState.map(player=>`<article>${player.headshot?`<img src="${escapeHtml(player.headshot)}" alt="">`:''}<h3>${escapeHtml(player.name)}</h3><p>${escapeHtml(player.teamName)} · ${escapeHtml(player.position)}</p>${labels.map(label=>`<div><span>${label}</span><strong>${escapeHtml(player.latest?.values?.[label]??'—')}</strong></div>`).join('')}</article>`).join('')}</div>`;document.querySelector('#comparisonDialog').showModal()};
document.querySelector('#closeComparison').onclick=()=>document.querySelector('#comparisonDialog').close();

function openTransactionDetail(item){if(!item)return;const root=document.querySelector('#transactionDetail');root.innerHTML=`<p class="eyebrow">${escapeHtml(item.type)} · ${item.date?new Date(item.date).toLocaleDateString():'Date unavailable'}</p><h2 id="transactionDialogTitle">${escapeHtml(item.team.displayName)}</h2><div class="transaction-detail-head">${item.player?.headshot?`<img src="${escapeHtml(item.player.headshot)}" alt="">`:item.team.logo?`<img src="${escapeHtml(item.team.logo)}" alt="">`:''}<p>${escapeHtml(item.description)}</p></div>${item.contract?`<section class="profile-section"><h3>Contract terms</h3><p>${item.contract.years} year${item.contract.years===1?'':'s'} · ${money(item.contract.value)}${item.contract.details?` · ${escapeHtml(item.contract.details)}`:''}</p></section>`:''}<section class="profile-section"><h3>Verification</h3><p>This move is shown from the linked league or reporting source.</p><a class="source-link" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">Open original source ↗</a></section>`;document.querySelector('#transactionDialog').showModal()}
document.querySelector('#closeTransactionDialog').onclick=()=>document.querySelector('#transactionDialog').close();
document.querySelectorAll('[data-refresh]').forEach(button=>button.onclick=()=>{button.disabled=true;button.textContent='Refreshing…';const tasks={transactions:loadTransactions,'free-agents':loadFreeAgents,standings:loadStandings,injuries:loadInjuries,finance:loadCapOverview};const task=tasks[button.dataset.refresh]?.();Promise.resolve(task).finally(()=>{button.disabled=false;button.textContent='Refresh'})});
document.body.addEventListener('click',event=>{const view=event.target.closest('[data-empty-view]');if(view)activateView(view.dataset.emptyView);const retry=event.target.closest('[data-retry]');if(retry){const tasks={transactions:loadTransactions,'free-agents':loadFreeAgents,standings:loadStandings,injuries:loadInjuries,finance:loadCapOverview,teams:loadTeams,roster:()=>loadRoster(document.querySelector('#teamPicker').value)};tasks[retry.dataset.retry]?.()}if(event.target.closest('[data-clear-free-agents]')){freeAgentState.status='all';freeAgentState.type='all';freeAgentState.position='all';freeAgentState.sort='best';freeAgentState.query='';document.querySelector('#freeAgentStatus').value='all';document.querySelector('#freeAgentType').value='all';document.querySelector('#freeAgentPosition').value='all';document.querySelector('#freeAgentSort').value='best';document.querySelector('#freeAgentSearch').value='';renderFreeAgents()}});
