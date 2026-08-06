let appData = null;
let selectedGameId = null;
let dayOffset = 0;
let activeConference = 'East';
let activeTransactionTeam = 'ALL';
let refreshTimer = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

function team(code) {
  return appData.teams[code] || { code, city: code, name: '', color: '#5aa8ff' };
}

function logo(code, className = 'team-logo') {
  return `<span class="${className}" style="--team:${team(code).color}">${code}</span>`;
}

function gameDetail(game) {
  if (game.status === 'LIVE') return `Q${game.period} - ${game.clock}`;
  if (game.status === 'FINAL') return 'Final';
  return game.clock;
}

function isoForOffset(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function readableDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderLoading() {
  $('#scoreGrid').innerHTML = '<section class="panel state-panel">Loading schedule...</section>';
  $('#gameCenter').innerHTML = '<div class="panel-title"><h2>Game center</h2></div><p class="empty">Connecting to Courtside API.</p>';
  $('#leaders').innerHTML = '<div class="panel-title"><h2>Game leaders</h2></div><p class="empty">Waiting for game data.</p>';
  $('#injuries').innerHTML = '<div class="panel-title"><h2>Injury report</h2></div><p class="empty">Waiting for availability data.</p>';
}

function renderError(message) {
  $('#scoreGrid').innerHTML = `<section class="panel state-panel"><h2>Data unavailable</h2><p class="empty">${message}</p><button class="primary" id="retryLoad">Retry</button></section>`;
  $('#gameCenter').innerHTML = '<div class="panel-title"><h2>Game center</h2></div><p class="empty">The API did not return dashboard data.</p>';
  $('#retryLoad').onclick = loadBootstrap;
}

async function loadBootstrap() {
  renderLoading();
  try {
    const response = await fetch(`/api/bootstrap?date=${isoForOffset(dayOffset)}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    appData = await response.json();
    selectedGameId = appData.games[0]?.id || null;
    renderApp();
  } catch (error) {
    renderError(error.message);
  }
}

function scheduleLiveRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  if (!appData?.games?.some((game) => game.status === 'LIVE')) return;
  refreshTimer = setTimeout(() => loadGamesForSelectedDate({ silent: true }), 15000);
}

async function loadGamesForSelectedDate(options = {}) {
  if (!options.silent) $('#scoreGrid').innerHTML = '<section class="panel state-panel">Loading games...</section>';
  try {
    const response = await fetch(`/api/games?date=${isoForOffset(dayOffset)}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    const payload = await response.json();
    const previousGameId = selectedGameId;
    appData = { ...appData, meta: payload.meta, teams: payload.teams, games: payload.games };
    selectedGameId = appData.games.some((game) => game.id === previousGameId) ? previousGameId : appData.games[0]?.id || null;
    renderDates();
    renderSource();
    renderCards();
    renderGame();
    renderSide();
    scheduleLiveRefresh();
  } catch (error) {
    renderError(error.message);
  }
}

async function loadTransactions() {
  $('#transactionBoard').innerHTML = '<p class="empty">Loading roster moves...</p>';
  try {
    const route = activeTransactionTeam === 'ALL'
      ? '/api/transactions'
      : `/api/transactions?team=${encodeURIComponent(activeTransactionTeam)}`;
    const response = await fetch(route, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    const payload = await response.json();
    appData = { ...appData, transactions: payload.transactions || [], transactionMeta: payload.meta };
    renderTransactions();
  } catch (error) {
    $('#transactionBoard').innerHTML = `<p class="empty">Transactions unavailable: ${error.message}</p>`;
  }
}

function selectedGame() {
  return appData.games.find((game) => game.id === selectedGameId) || appData.games[0];
}

function renderDates() {
  const root = $('#dates');
  root.innerHTML = '';

  for (let i = -3; i <= 3; i += 1) {
    const date = new Date();
    date.setDate(date.getDate() + i + dayOffset);
    root.innerHTML += `<button class="date ${i === 0 ? 'active' : ''}" data-offset="${i}">${date.toLocaleDateString('en-US', { weekday: 'short' })}<strong>${date.getDate()}</strong></button>`;
  }

  $$('.date').forEach((button) => {
    button.onclick = () => {
      dayOffset += Number(button.dataset.offset);
      loadGamesForSelectedDate();
    };
  });
}

function teamLine(side, opponent, winner) {
  const current = team(side.team);
  return `
    <div class="team-row ${winner ? 'winner' : ''}">
      ${logo(side.team)}
      <div>
        <div class="team-name">${current.city} <span class="team-full">${current.name}</span></div>
        <div class="record">${side.record}</div>
      </div>
      <div class="team-score">${side.score ?? '-'}</div>
    </div>
  `;
}

function hasWinner(game) {
  return Number.isFinite(game.away.score) && Number.isFinite(game.home.score);
}

function renderCards() {
  if (!appData.games.length) {
    $('#scoreGrid').innerHTML = `<section class="panel state-panel"><h2>No games</h2><p class="empty">No games were returned for ${readableDate(isoForOffset(dayOffset))}.</p></section>`;
    return;
  }

  $('#scoreGrid').innerHTML = appData.games.map((game) => {
    const awayWinner = hasWinner(game) && game.away.score > game.home.score;
    const homeWinner = hasWinner(game) && game.home.score > game.away.score;
    return `
      <article class="score-card ${selectedGameId === game.id ? 'selected' : ''} ${game.status === 'LIVE' ? 'live-game' : ''}" data-id="${game.id}">
        <div class="score-meta">
          <span class="${game.status === 'LIVE' ? 'live' : ''}">${gameDetail(game)}</span>
          <span>${game.status === 'UPCOMING' ? 'MATCHUP' : 'NBA'}</span>
        </div>
        ${teamLine(game.away, game.home, awayWinner)}
        ${teamLine(game.home, game.away, homeWinner)}
      </article>
    `;
  }).join('');

  $$('.score-card').forEach((card) => {
    card.onclick = () => {
      selectedGameId = card.dataset.id;
      renderCards();
      renderGame();
      renderSide();
    };
  });
}

function renderGame() {
  const game = selectedGame();
  if (!game) {
    $('#gameCenter').innerHTML = '<div class="panel-title"><h2>Game center</h2></div><p class="empty">Select a date with games to see game details.</p>';
    return;
  }

  const away = team(game.away.team);
  const home = team(game.home.team);
  const status = game.status === 'LIVE' ? `LIVE - ${gameDetail(game)}` : gameDetail(game);
  const shots = game.shots.length
    ? game.shots.map((shot) => `<span class="shot ${shot.result}" style="left:${shot.x}%;top:${shot.y}%">${shot.result === 'made' ? 'o' : 'x'}</span>`).join('')
    : '<span class="court-empty">No shot detail</span>';
  const plays = game.plays.length
    ? game.plays.map((play) => `<div class="play"><time>${play.clock}</time><div><strong>${play.player}</strong>${play.text}</div></div>`).join('')
    : '<p class="empty">Play-by-play will appear when the feed starts.</p>';

  $('#gameCenter').innerHTML = `
    <div class="panel-title"><h2>Game center</h2><span class="pill">${game.arena}</span></div>
    <div class="game-scoreboard">
      <div class="big-team">${logo(game.away.team, 'team-logo big-logo')}<div><strong>${away.name}</strong><div class="record">${game.away.record}</div></div></div>
      <div><div class="score-main">${game.away.score ?? '-'}<small>-</small>${game.home.score ?? '-'}</div><div class="status-live">${status}</div></div>
      <div class="big-team">${logo(game.home.team, 'team-logo big-logo')}<div><strong>${home.name}</strong><div class="record">${game.home.record}</div></div></div>
    </div>
    <div class="prob">
      <div class="prob-labels">
        <span>${game.away.team} ${game.away.winProbability}%</span>
        <span>${game.status === 'LIVE' ? 'LIVE WIN PROBABILITY' : 'PREGAME WIN PROBABILITY'}</span>
        <span>${game.home.team} ${game.home.winProbability}%</span>
      </div>
      <div class="prob-bar"><span style="width:${game.away.winProbability}%"></span><span style="width:${game.home.winProbability}%"></span></div>
    </div>
    <div class="tabs"><button class="active">Shot chart</button><button>Team stats</button><button>Box score</button><button>Play-by-play</button></div>
    <div class="court-wrap">
      <div class="court"><span class="hoop"></span>${shots}</div>
      <div class="play-list">${plays}</div>
    </div>
  `;
}

function renderSide() {
  const game = selectedGame();
  if (!game) {
    $('#leaders').innerHTML = '<div class="panel-title"><h2>Game leaders</h2></div><p class="empty">No game selected.</p>';
    $('#injuries').innerHTML = '<div class="panel-title"><h2>Injury report</h2></div><p class="empty">No game selected.</p>';
    return;
  }

  const leaders = game.leaders.length
    ? game.leaders.map((leader, index) => `<div class="stat-row"><span class="rank">0${index + 1}</span><div><strong>${leader.player}</strong><small>${leader.team} - ${leader.position}</small></div><span class="stat-value">${leader.points}</span></div>`).join('')
    : '<p class="empty">Leaders populate after box score data arrives.</p>';
  const injuries = game.injuries.length
    ? game.injuries.map((injury) => `<div class="injury-row"><span>+</span><div><strong>${injury.player}</strong><small>${injury.team} - ${injury.position}</small></div><span class="tag">${injury.status}</span></div>`).join('')
    : '<p class="empty">No injury updates for this game.</p>';

  $('#leaders').innerHTML = `<div class="panel-title"><h2>Game leaders</h2><span class="pill">PTS</span></div>${leaders}`;
  $('#injuries').innerHTML = `<div class="panel-title"><h2>Injury report</h2><span class="pill">${game.injuries.length} updates</span></div>${injuries}`;
}

function renderStandingsControls() {
  const control = $('.segmented');
  control.innerHTML = Object.keys(appData.standings).map((conference) => `<button class="${conference === activeConference ? 'active' : ''}" data-conference="${conference}">${conference}</button>`).join('');
  $$('.segmented button').forEach((button) => {
    button.onclick = () => {
      activeConference = button.dataset.conference;
      renderStandings();
    };
  });
}

function renderStandings() {
  renderStandingsControls();
  const rows = appData.standings[activeConference] || [];
  $('#standingsTable').innerHTML = `
    <table class="standings-table">
      <thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th><th>L10</th></tr></thead>
      <tbody>
        ${rows.map((row, index) => {
          const current = team(row.team);
          return `<tr><td>${index + 1}</td><td>${logo(row.team, 'mini-logo')}<b>${current.city} ${current.name}</b></td><td>${row.wins}</td><td>${row.losses}</td><td>${row.pct}</td><td>${row.gb}</td><td>${row.last10}</td></tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

function matchup(row) {
  return `<div class="matchup"><div class="fav"><span>${row.favorite}</span><b>${row.favoriteOdds}%</b></div><div><span>${row.underdog}</span><span>${row.underdogOdds}%</span></div></div>`;
}

function renderPredict(randomize = false) {
  const prediction = appData.predictions;
  const semifinal = prediction.bracket.semifinals[1];
  const dynamicOdds = randomize ? Math.floor(55 + Math.random() * 30) : semifinal.favoriteOdds;
  const secondSemifinal = { ...semifinal, favoriteOdds: dynamicOdds, underdogOdds: 100 - dynamicOdds };
  const titleTeam = team(prediction.titleFavorite.team);

  $('#bracket').innerHTML = `
    <div class="panel-title"><h2>Eastern Conference</h2><span class="pill">${prediction.simulations.toLocaleString()} sims</span></div>
    <div class="rounds">
      <div><div class="round-title">First round</div>${prediction.bracket.firstRound.map(matchup).join('')}</div>
      <div><div class="round-title">Semifinals</div>${matchup(prediction.bracket.semifinals[0])}${matchup(secondSemifinal)}</div>
      <div><div class="round-title">Conference final</div>${prediction.bracket.conferenceFinal.map(matchup).join('')}<div class="round-title" style="margin-top:35px">Finals winner</div>${prediction.bracket.finals.map(matchup).join('')}</div>
    </div>
  `;

  $('#modelCard').innerHTML = `
    <div class="panel-title"><h2>Model outlook</h2><span class="pill">${prediction.modelVersion}</span></div>
    <div class="champion">${logo(prediction.titleFavorite.team, 'team-logo big-logo')}<small class="muted">TITLE FAVORITE</small><br><strong>${titleTeam.city} ${titleTeam.name}</strong><p><b style="color:var(--green)">${prediction.titleFavorite.odds}</b> championship odds</p></div>
    ${prediction.modelFactors.map((factor) => `<div class="factor"><div class="factor-head"><span>${factor.label}</span><b>${factor.value}</b></div><div class="factor-track"><span style="width:${factor.value}%"></span></div></div>`).join('')}
  `;
}

function renderFutures() {
  $('#futuresGrid').innerHTML = appData.futures.map((future) => `
    <section class="panel future-card">
      <h2>${future.market}</h2>
      ${future.entries.map((entry) => {
        const current = team(entry.team);
        return `<div class="odds-row">${logo(entry.team, 'mini-logo')}<span>${current.city} ${current.name}</span><b>${entry.value}</b></div>`;
      }).join('')}
    </section>
  `).join('');
}

function transactionDate(value) {
  if (!value) return 'Date TBD';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderTransactionControls() {
  const control = $('#transactionTeam');
  const teamCodes = Object.keys(appData.teams).sort();
  control.innerHTML = '<option value="ALL">All teams</option>' + teamCodes
    .map((code) => `<option value="${code}" ${code === activeTransactionTeam ? 'selected' : ''}>${team(code).city} ${team(code).name}</option>`)
    .join('');
  control.value = activeTransactionTeam;
}

function renderTransactions() {
  renderTransactionControls();
  const rows = (appData.transactions || [])
    .filter((move) => activeTransactionTeam === 'ALL' || move.team === activeTransactionTeam)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  if (!rows.length) {
    $('#transactionBoard').innerHTML = '<p class="empty">No roster moves returned for this filter.</p>';
    return;
  }

  const label = appData.transactionMeta?.provider || appData.meta?.provider || 'Courtside API';
  $('#transactionBoard').innerHTML = `
    <div class="panel-title"><h2>Latest moves</h2><span class="pill">${label}</span></div>
    <div class="transaction-list">
      ${rows.map((move) => {
        const code = move.team || 'NBA';
        const source = move.sourceUrl ? `<a href="${move.sourceUrl}" target="_blank" rel="noreferrer">${move.source || 'Source'}</a>` : `<span>${move.source || 'ESPN'}</span>`;
        return `
          <article class="transaction-row">
            ${logo(code, 'mini-logo')}
            <div>
              <div class="transaction-head"><strong>${move.player || team(code).city + ' ' + team(code).name}</strong><span>${transactionDate(move.date)}</span></div>
              <p>${move.text || move.description || move.type || 'Roster move'}</p>
              <small>${move.category || move.type || 'Transaction'} - ${source}</small>
            </div>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function renderSource() {
  const isDemo = appData.meta.dataQuality === 'demo-only';
  const label = isDemo ? 'Demo API data' : appData.meta.provider;
  const fallback = appData.meta.fallbackReason ? ` - fallback: ${appData.meta.fallbackReason}` : '';
  const gameFallback = appData.meta.gameFallback ? ' - demo games shown' : '';
  $('.section-heading .muted').textContent = `${readableDate(isoForOffset(dayOffset))} - All times ET - ${label}${fallback}${gameFallback}`;
  $('#providerStatus').textContent = isDemo ? 'DEMO' : appData.meta.source.toUpperCase();
}

function renderApp() {
  renderSource();
  renderDates();
  renderCards();
  renderGame();
  renderSide();
  renderStandings();
  renderTransactions();
  renderPredict();
  renderFutures();
  scheduleLiveRefresh();
}

$$('#nav button').forEach((button) => {
  button.onclick = () => {
    $$('#nav button').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    $$('.view').forEach((view) => view.classList.remove('active-view'));
    $(`#${button.dataset.view}`).classList.add('active-view');
  };
});

$('#prevDay').onclick = () => {
  dayOffset -= 1;
  loadGamesForSelectedDate();
};

$('#nextDay').onclick = () => {
  dayOffset += 1;
  loadGamesForSelectedDate();
};

$('#simulate').onclick = () => {
  const button = $('#simulate');
  button.textContent = 'Simulating...';
  setTimeout(() => {
    renderPredict(true);
    button.textContent = 'Run simulation';
  }, 550);
};

$('#transactionTeam').onchange = () => {
  activeTransactionTeam = $('#transactionTeam').value;
  renderTransactions();
};

$('#refreshTransactions').onclick = loadTransactions;

loadBootstrap();
