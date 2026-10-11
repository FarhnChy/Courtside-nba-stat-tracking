(() => {
  const esc = escapeHtml;
  const state = { request:0, filter:'all', games:new Map(), moves:null, team:null, polling:false };
  const stamp = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : 'Time unavailable';
  const safeUrl = value => { try { const url = new URL(value); return ['https:','http:'].includes(url.protocol) ? url.href : ''; } catch (_) { return ''; } };
  const source = item => { const url = safeUrl(item.url || item.source); return url ? `<a href="${esc(url)}" target="_blank" rel="noreferrer">${esc(item.verification?.source || new URL(url).hostname)} ↗</a>` : `<span>${esc(item.verification?.source || item.source || 'Source unavailable')}</span>`; };
  const status = item => (item.verification?.status === 'official' || (item.verification?.status === 'confirmed' && /^NBA (trade|free-agent) tracker$/.test(item.verification.source) && /^https:\/\/(www\.)?nba\.com\//.test(safeUrl(item.url || item.source)))) ? 'official' : item.verification?.status === 'confirmed' ? 'confirmed' : 'reported';
  const labels = { reported:'Reported / rumors', confirmed:'Confirmed moves', official:'Official announcements' };
  const entry = item => `<article class="timeline-entry"><span class="pill">${labels[status(item)]}</span><p>${esc(item.headline || item.description)}</p><small><time>${esc(stamp(item.published || item.date))}</time> · ${source(item)}</small></article>`;
  async function get(url) { try { const response = await fetchApi(url); const data = await response.json(); return {...data, stale:Boolean(data.stale) || response.headers.get('x-courtside-cache') === 'stale'}; } catch (_) { return null; } }
  function timeline(items) {
    const root = document.querySelector('#tradeTimeline');
    const rows = items.filter(item => state.filter === 'all' || status(item) === state.filter).slice().sort((a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0));
    root.innerHTML = `<div class="panel-title"><h2>Trade-news timeline</h2></div><div class="timeline-filters" role="group" aria-label="Verification status">${Object.entries({all:'All updates',...labels}).map(([key,label])=>`<button class="secondary-action" data-timeline="${key}" aria-pressed="${state.filter===key}">${label}</button>`).join('')}</div><p class="muted">Reports may include agreements awaiting confirmation. Official status requires explicit source verification.</p><div class="timeline-scroll">${rows.map(entry).join('') || '<p class="empty-state">No updates in this category.</p>'}</div>`;
    root.querySelectorAll('[data-timeline]').forEach(button => button.onclick=()=>{state.filter=button.dataset.timeline;timeline(items);});
  }
  async function favorite() {
    const request = ++state.request;
    const root = document.querySelector('#favoriteDashboard');
    const team = hubState.teams.find(item => String(item.id) === String(hubState.favoriteTeam));
    root.hidden = false;
    if (!team) {
      root.innerHTML='<div class="favorite-head"><div><p class="eyebrow">YOUR COURTSIDE</p><h2>One team. Everything to follow.</h2><p>Bring your next game, injuries, moves, and news home.</p></div><button class="secondary-action" id="chooseFavorite">Choose your team</button></div>';
      root.querySelector('button').onclick=()=>document.querySelector('#userHubButton').click(); return;
    }
    const urls = [`/api/schedule?start=${dateValue(new Date())}&days=14`, '/api/injuries','/api/transactions','/api/news'];
    const [schedule, injuries, moves, news] = await Promise.all(urls.map(get));
    if (request !== state.request) return;
    const matches = item => String(item.team?.id) === String(team.id) || item.team?.abbreviation === team.abbreviation;
    const next = (schedule?.days || []).flatMap(day=>day.games).filter(game=> !game.status.completed && [game.away,game.home].some(side=>String(side.id)===String(team.id))).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date))[0];
    const hurt = injuries?.teams?.find(item=>String(item.id)===String(team.id) || item.displayName===team.displayName)?.injuries || [];
    const reports = (news?.updates || []).filter(item=>`${item.headline} ${item.description}`.toLowerCase().includes((team.name || team.displayName).toLowerCase())).slice(0,3);
    const card = (title, payload, content, empty) => `<article class="feed-section"><h3>${title}</h3>${payload ? `${payload.stale?'<p class="muted">Saved data · offline</p>':''}${content || `<p class="muted">${empty}</p>`}` : '<p class="muted">Temporarily unavailable. Retrying automatically.</p>'}</article>`;
    root.innerHTML=`<div class="favorite-head"><div><p class="eyebrow">YOUR TEAM</p><h2>${esc(team.displayName)}</h2></div><button class="secondary-action" id="changeFavorite">Change team</button></div><div class="team-feed">${card('Next game',schedule,next?`<strong>${esc(next.away.abbreviation)} at ${esc(next.home.abbreviation)}</strong><p>${esc(stamp(next.date))} · ${esc(next.status.detail)}</p><button class="secondary-action" id="favoriteGame">View game</button>`:'','No game in the next 14 days of the released schedule.')}${card('Injury report',injuries,hurt.slice(0,4).map(item=>`<p><strong>${esc(item.player)}</strong> · ${esc(item.status)}</p>`).join(''),'No injuries listed.')}${card('Team moves',moves,(moves?.transactions || []).filter(matches).slice(0,3).map(entry).join(''),'No team moves listed.')}${card('Latest news',news,reports.map(entry).join(''),'No matching stories in the latest news feed.')}</div>`;
    root.querySelector('#changeFavorite').onclick=()=>document.querySelector('#userHubButton').click();
    const gameButton=root.querySelector('#favoriteGame');
    if(gameButton)gameButton.onclick=async()=>{activateView('scores');await selectScoreDate(dateValue(new Date(next.date)));const match=games.find(game=>String(game.id)===String(next.id));if(match){selected=match;renderCards();enhanceScoreCards();loadGame(match.id);}};
  }
  function notify(key, title, body) {
    if (!hubState.notifications[key] || !('Notification' in window) || Notification.permission !== 'granted') return;
    try { new Notification(title, {body, tag:`courtside-${key}`, icon:'/courtside.png'}); } catch (_) { document.querySelector('#notificationNote').textContent='This browser cannot deliver desktop alerts. Try a supported desktop browser.'; }
  }
  async function poll() {
    if(state.polling) return;
    const team=hubState.favoriteTeam;
    if (!team || !Object.values(hubState.notifications).some(Boolean)) return;
    state.polling=true;
    try {
      if(state.team!==team){state.team=team;state.games.clear();state.moves=null;}
      const [board,moves]=await Promise.all([get(`/api/scoreboard?date=${dateValue(new Date())}`),hubState.notifications.moves?get('/api/transactions'):null]);
      if(team!==hubState.favoriteTeam) return;
      if(board && !board.stale) for(const game of board.games || []) {
        if(![game.away,game.home].some(side=>String(side.id)===String(team)))continue;
        const old=state.games.get(game.id), current=game.status;
        const close=current.state==='in' && current.period>=4 && /^\d+:\d+$/.test(current.clock) && Number(current.clock.split(':')[0])*60+Number(current.clock.split(':')[1])<=300 && Math.abs(Number(game.away.score)-Number(game.home.score))<=5;
        const body=`${game.away.abbreviation} ${game.away.score} — ${game.home.abbreviation} ${game.home.score}`;
        if(old){
          if(old.status.state==='pre' && current.state==='in')notify('tipoff','Tip-off',body);
          if(!old.status.completed && current.completed)notify('final','Final score',body);
          if(close && !old.closeSent)notify('close','Close game · '+current.clock,body);
        }
        state.games.set(game.id,{status:current,closeSent:old?.closeSent || close});
      }
      if(moves && !moves.stale){
        const relevant=(moves.transactions || []).filter(item=>String(item.team?.id)===String(team));
        const ids=new Set(relevant.map(item=>item.id || `${item.date}:${item.description}`));
        if(state.moves) for(const item of relevant) if(!state.moves.has(item.id || `${item.date}:${item.description}`))notify('moves',labels[status(item)],item.description);
        state.moves=ids;
      }
    } finally {state.polling=false;}
  }
  document.querySelector('#enableAlerts').onclick=async()=>{
    const note=document.querySelector('#notificationNote');
    if(!('Notification' in window)){note.textContent='Browser notifications are unavailable in this browser.';return;}
    try {const permission=await Notification.requestPermission();note.textContent=permission==='granted'?'Notifications enabled. Choose alert types and a favorite team. Keep Courtside open for delivery.':permission==='denied'?'Notifications blocked. You can allow them in browser site settings.':'Notifications remain off.';} catch (_) {note.textContent='Browser notifications are unavailable here.';}
  };
  window.CourtsideFeatures={favorite,timeline};
  favorite(); timeline(transactionState.data); poll();
  setInterval(poll,20_000);
  setInterval(()=>{if(hubState.favoriteTeam)favorite();},60_000);
})();
