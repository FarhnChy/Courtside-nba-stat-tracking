(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const html = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem('courtsideFantasyTeams') || '[]'); if (!Array.isArray(saved)) saved = []; } catch (_) {}
  let league = null, key = '', busy = false, syncing = false, polling = false, generation = 0, signature = '', lastSync = 0;
  function notice(text = '', error = false) { $('#fantasyNotice').textContent = text; $('#fantasyNotice').dataset.error = String(error); }
  function newKey() { return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24)))).replaceAll('+', '-').replaceAll('/', '_'); }
  function remember(data, token) {
    saved = saved.filter(item => item.id !== data.id); saved.push({ id: data.id, key: token, name: data.name });
    try { localStorage.setItem('courtsideFantasyTeams', JSON.stringify(saved)); }
    catch (_) { notice('This browser cannot save your team key. Open “My recovery key” and save it before leaving.'); }
  }
  async function request(path, { token = key, body } = {}) {
    const response = await fetch(`/api/fantasy/${path}`, { method: body === undefined ? 'GET' : 'POST', cache: 'no-store', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Fantasy request failed.');
    return result;
  }
  async function perform(fn) {
    if (busy) return;
    busy = true; generation++; notice();
    const buttons = [...document.querySelectorAll('button:not(:disabled)')]; buttons.forEach(button => { button.disabled = true; });
    try { await fn(); } catch (error) { notice(error.message, true); }
    finally { busy = false; buttons.forEach(button => { if (button.isConnected) button.disabled = false; }); }
  }
  function savedList() {
    $('#savedLeagues').innerHTML = saved.length ? `<h2>My leagues</h2>${saved.map(item => `<button class="secondary-action" data-open="${html(item.id)}">${html(item.name)}</button>`).join('')}` : '';
  }
  function enter(data, token, showKey = false) {
    generation++; key = token; league = data; signature = ''; lastSync = 0; remember(data, token);
    $('#welcome').hidden = true; $('#leagueView').hidden = false; history.replaceState(null, '', `#league=${data.id}`); render();
    if (showKey) recovery();
  }
  function recovery() { $('#copyRecovery').textContent = 'Copy recovery key'; $('#recoveryValue').value = `${league.id}.${key}`; $('#recoveryDialog').showModal(); }
  const player = id => league.players.find(player => player.id === id) || { id, name: 'Unknown player', position: '', team: '' };
  const teamName = id => league.teams.find(team => team.id === id)?.name || 'Bye';
  const me = () => league.teams.find(team => team.id === league.me);
  function heading() {
    $('#leagueHeading').innerHTML = `<div class="fantasy-heading"><div><p class="eyebrow">${html(league.status === 'lobby' ? 'LEAGUE LOBBY' : league.status === 'draft' ? 'DRAFT ROOM' : 'HEAD-TO-HEAD POINTS')}</p><h1>${html(league.name)}</h1><p>${html(me().name)} · ${league.teams.length}/${league.capacity} managers · ${league.rosterSize} roster spots · ${league.starters} starters</p></div><div class="fantasy-invite"><p>Invite your friends</p><code>${html(league.id)}</code> <button class="secondary-action" id="copyInvite">Copy invite link</button><p class="fantasy-help">${league.status === 'lobby' ? 'Anyone with this invite can join until the draft starts.' : 'League membership is locked for this draft and season.'}</p></div></div>`;
  }
  function activity() { return `<div class="fantasy-activity">${league.activity.map(item => `<p><time>${html(new Date(item.at).toLocaleString())}</time>${html(item.text)}</p>`).join('')}</div>`; }
  function managers() {
    return league.teams.map(team => `<div class="fantasy-team"><div><strong>${html(team.name)}</strong><small>${team.id === league.commissioner ? 'Commissioner' : 'Manager'}${team.id === league.me ? ' · You' : ''}</small></div><span>${team.roster.length}/${league.rosterSize} players</span></div>`).join('');
  }
  function render() {
    heading();
    const nextSignature = JSON.stringify([league.id, league.status, league.picks.length, league.teams.map(team => [team.id, team.roster]), league.nextDate]);
    if (signature === nextSignature) { updateScores(); return; }
    signature = nextSignature;
    const root = $('#leagueContent');
    if (league.status === 'lobby') {
      root.innerHTML = `<div class="fantasy-columns"><section class="fantasy-card"><h2>The managers</h2>${managers()}<p>Send the invite link to your friends. Starting the draft locks membership and scoring settings.</p>${league.me === league.commissioner ? `<button id="startDraft" class="primary-action" ${league.teams.length < 2 ? 'disabled' : ''}>Start snake draft</button>` : '<p>Waiting for the commissioner to start the draft.</p>'}</section><section class="fantasy-card"><h2>League rules</h2><p>${league.weeks} matchups, seven days each. Scoring starts the day after the draft finishes.</p><p>PTS 1 · REB 1.2 · AST 1.5 · STL 3 · BLK 3 · TO −1</p><p>${league.starters} utility starters. Lineups lock at midnight New York time. Set tomorrow’s lineup today; it carries forward until changed.</p><p>First-come adds/drops. No waivers, trades, or playoffs yet. Automatic draft picks use alphabetical order, not player rankings.</p></section></div>`;
    } else if (league.status === 'draft') {
      const mine = league.nextTeam === league.me;
      root.innerHTML = `<section class="fantasy-turn"><p class="eyebrow">ROUND ${Math.floor(league.picks.length / league.teams.length) + 1} · PICK ${league.picks.length + 1} OF ${league.rosterSize * league.teams.length}</p><strong>${mine ? 'You’re on the clock' : `${html(teamName(league.nextTeam))} is picking`}</strong><p>No timer. Draft order: ${league.order.map(id => html(teamName(id))).join(' → ')}. Order reverses each round.</p>${mine || league.me === league.commissioner ? '<button id="autoPick" class="secondary-action">Pick first alphabetically</button>' : ''}</section><div class="fantasy-columns"><section class="fantasy-card"><h2>Available players</h2><label>Find a player<input id="playerSearch" type="search" placeholder="Name, team, or position"></label><div id="playerPool" class="fantasy-pool"></div></section><section class="fantasy-card"><h2>Draft board</h2>${league.picks.length ? [...league.picks].reverse().map((pick, index) => `<div class="fantasy-team"><div><strong>${html(player(pick.playerId).name)}</strong><small>${html(teamName(pick.teamId))}</small></div><span>#${league.picks.length - index}</span></div>`).join('') : '<p>The first pick is up.</p>'}</section></div>`;
      renderPool();
    } else {
      root.innerHTML = `<div class="fantasy-turn"><strong>Week ${league.matchup.week} of ${league.weeks}</strong><p>Season starts ${html(league.startDate)}. Lineups for ${html(league.today)} are locked. Changes below apply ${html(league.nextDate)}, at midnight New York time.</p><p class="fantasy-help">PTS 1 · REB 1.2 · AST 1.5 · STL 3 · BLK 3 · TO −1. All positions eligible. Adds/drops are first come, first served.</p></div><div class="fantasy-columns"><div class="fantasy-stack"><section class="fantasy-card" id="matchups"></section><section class="fantasy-card" id="standings"></section><section class="fantasy-card"><h2>Recent activity</h2><div id="activity">${activity()}</div></section></div><div class="fantasy-stack"><form id="lineupForm" class="fantasy-card"><h2>Your next lineup</h2><p>Choose up to ${league.starters} starters for ${html(league.nextDate)}. Unselected players stay on your bench. Today’s locked lineup: ${me().todayLineup.map(id => html(player(id).name)).join(', ') || 'No starters'}.</p>${me().roster.map(id => `<label><input type="checkbox" name="starter" value="${html(id)}" ${me().nextLineup.includes(id) ? 'checked' : ''}>${html(player(id).name)} <small>· ${html(player(id).position)} / ${html(player(id).team)}</small></label>`).join('')}<button class="primary-action" type="submit">Save lineup</button></form><section class="fantasy-card"><h2>Add a player</h2><p>New players are eligible tomorrow. After adding, select them in your next lineup.</p><label>Drop a player${me().roster.length >= league.rosterSize ? ' (required)' : ' (optional)'}<select id="dropPlayer"><option value="">Choose a player</option>${me().roster.map(id => `<option value="${html(id)}">${html(player(id).name)}</option>`).join('')}</select></label><label>Find an available player<input id="playerSearch" type="search" placeholder="Name, team, or position"></label><div id="playerPool" class="fantasy-pool"></div></section></div></div><section class="fantasy-card fantasy-rules"><h2>League rosters</h2><div class="fantasy-columns">${league.teams.map(team => `<div><h3>${html(team.name)}</h3><p>${team.roster.map(id => html(player(id).name)).join(' · ')}</p></div>`).join('')}</div></section>`;
      renderPool(); updateScores();
    }
  }
  function updateScores() {
    if (!$('#matchups')) return;
    const match = league.matchup;
    $('#matchups').innerHTML = `<h2>Week ${match.week} matchups</h2><p>${html(match.dates[0])} – ${html(match.dates.at(-1))} · ${match.complete ? 'Final' : 'Provisional'}</p>${match.pairs.map(([a, b]) => `<div class="fantasy-match"><div>${html(teamName(a))}<strong>${a ? (match.totals[a] || 0).toFixed(1) : '—'}</strong></div><em>VS</em><div>${html(teamName(b))}<strong>${b ? (match.totals[b] || 0).toFixed(1) : '—'}</strong></div></div>`).join('')}<p class="fantasy-help">${league.sync ? `Last checked ${html(new Date(league.sync.at).toLocaleString())}.${league.sync.errors.length ? ' Some NBA statistics are unavailable. Previous scores are retained.' : ''}${league.sync.remaining ? ` ${league.sync.remaining} previous days await final statistics or catch-up.` : ''}` : 'Waiting for the first box-score update.'} Scores refresh about every minute while this league is open. Final results require all seven days to be complete.</p>`;
    $('#standings').innerHTML = `<h2>Standings</h2><p>${league.standings.completedWeeks} completed matchup weeks. Points below include finalized weeks only.</p><div class="table-scroll"><table><thead><tr><th>Team</th><th>W</th><th>L</th><th>T</th><th>Points</th></tr></thead><tbody>${league.standings.rows.map(row => `<tr><td>${html(row.name)}</td><td>${row.wins}</td><td>${row.losses}</td><td>${row.ties}</td><td>${row.points.toFixed(1)}</td></tr>`).join('')}</tbody></table></div>`;
    $('#activity').innerHTML = activity();
  }
  function renderPool() {
    const query = ($('#playerSearch')?.value || '').toLowerCase();
    const taken = new Set(league.teams.flatMap(team => team.roster));
    const available = league.players.filter(player => !taken.has(player.id) && `${player.name} ${player.team} ${player.position}`.toLowerCase().includes(query));
    const canPick = league.status !== 'draft' || league.nextTeam === league.me;
    $('#playerPool').innerHTML = available.length ? available.map(player => `<div class="fantasy-team"><div><strong>${html(player.name)}</strong><small>${html(player.position)} · ${html(player.team)}</small></div><button class="secondary-action" data-player="${html(player.id)}" ${canPick ? '' : 'disabled'}>${league.status === 'draft' ? 'Draft' : 'Add'}</button></div>`).join('') : '<p class="fantasy-empty">No available players match.</p>';
  }
  async function action(body) {
    league = await request(`leagues/${league.id}/actions`, { body });
    signature = ''; render();
  }
  async function syncScores() {
    if (!league || league.status !== 'active' || syncing || busy) return;
    const id = league.id, token = key, version = generation;
    syncing = true; lastSync = Date.now();
    try {
      const updated = await request(`leagues/${id}/sync`, { token, body: {} });
      if (generation === version && league?.id === id) { league = updated; render(); }
    } catch (error) { if (generation === version) notice(`Scores could not refresh: ${error.message}`, true); }
    finally { syncing = false; }
  }
  $('#createLeague').onsubmit = event => {
    event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));
    for (const field of ['capacity', 'rosterSize', 'starters', 'weeks']) data[field] = Number(data[field]);
    perform(async () => {
      const token = newKey(); data.id = [...crypto.getRandomValues(new Uint8Array(9))].map(value => value.toString(16).padStart(2, '0')).join('');
      // Save credentials before a write: a lost response must not orphan a team.
      remember({ id: data.id, name: data.name }, token); savedList();
      const result = await request('leagues', { token, body: data }); enter(result, token, true);
    });
  };
  $('#joinLeague').onsubmit = event => {
    event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); const id = data.code.trim().toLowerCase();
    perform(async () => { const existing = saved.find(item => item.id === id); const token = existing?.key || newKey(); remember({ id, name: existing?.name || data.teamName }, token); savedList(); const result = await request(`leagues/${id}/join`, { token, body: { teamName: data.teamName } }); enter(result, token, !existing); });
  };
  $('#recoverTeam').onsubmit = event => {
    event.preventDefault(); const value = new FormData(event.currentTarget).get('recovery').trim();
    perform(async () => { const match = value.match(/^([a-f0-9]{18})\.([\w-]{32})$/); if (!match) throw new Error('Enter the full private recovery key, including the league code and dot.'); enter(await request(`leagues/${match[1]}`, { token: match[2] }), match[2]); $('#recoverTeam').reset(); });
  };
  $('#allLeagues').onclick = () => { generation++; league = null; key = ''; signature = ''; $('#leagueView').hidden = true; $('#welcome').hidden = false; history.replaceState(null, '', location.pathname); notice(); savedList(); };
  $('#showRecovery').onclick = recovery;
  $('#closeRecovery').onclick = () => { $('#recoveryDialog').close(); $('#recoveryValue').value = ''; };
  $('#recoveryDialog').addEventListener('close', () => { $('#recoveryValue').value = ''; });
  $('#copyRecovery').onclick = async () => { try { await navigator.clipboard.writeText($('#recoveryValue').value); $('#copyRecovery').textContent = 'Copied'; } catch (_) { $('#recoveryValue').select(); } };
  $('#refreshLeague').onclick = () => perform(async () => { league = await request(`leagues/${league.id}`); render(); lastSync = 0; });
  document.addEventListener('input', event => { if (event.target.id === 'playerSearch') renderPool(); });
  document.addEventListener('submit', event => {
    if (event.target.id !== 'lineupForm') return;
    event.preventDefault(); const players = new FormData(event.target).getAll('starter');
    perform(async () => { await action({ action: 'lineup', date: league.nextDate, players }); notice(`Lineup saved for ${league.nextDate}.`); });
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    if (button.dataset.open) perform(async () => { const item = saved.find(item => item.id === button.dataset.open); enter(await request(`leagues/${item.id}`, { token: item.key }), item.key); });
    if (button.id === 'copyInvite') {
      const link = `${location.origin}/fantasy.html#join=${league.id}`;
      if (navigator.clipboard) navigator.clipboard.writeText(link).then(() => notice('Invite link copied. Share it with your friends.')).catch(() => notice(`Share this invite link: ${link}`));
      else notice(`Share this invite link: ${link}`);
    }
    if (button.id === 'startDraft') perform(async () => { notice('Loading NBA rosters and starting the draft…'); await action({ action: 'start' }); notice(); });
    if (button.id === 'autoPick') perform(() => action({ action: 'autoPick', pickNumber: league.picks.length }));
    if (button.dataset.player) {
      const playerId = button.dataset.player;
      const body = league.status === 'draft' ? { action: 'pick', playerId, pickNumber: league.picks.length } : { action: 'addDrop', playerId, dropId: $('#dropPlayer').value, date: league.nextDate };
      perform(() => action(body));
    }
  });
  async function poll() {
    if (!league || busy || polling || document.hidden) return;
    const id = league.id, version = generation; polling = true;
    try { const updated = await request(`leagues/${id}`); if (generation === version && league?.id === id) { league = updated; render(); } }
    catch (error) { if (generation === version) notice(`League updates paused: ${error.message}`, true); }
    finally { polling = false; }
    if (Date.now() - lastSync >= 60000) syncScores();
  }
  async function initialize() {
    savedList();
    try {
      const config = await request('config');
      if (!config.available) { notice('Online fantasy is not configured yet. The site owner needs to connect shared league storage before you can create or join a league.', true); document.querySelectorAll('#welcome button[type=submit]').forEach(button => { button.disabled = true; }); return; }
      if (config.storage === 'local') notice('Leagues are saved on this server. Friends must connect to this same running server to play together.');
      const params = new URLSearchParams(location.hash.slice(1));
      const invite = params.get('join'); if (/^[a-f0-9]{18}$/.test(invite || '')) { $('#joinLeague [name=code]').value = invite; $('#joinLeague [name=teamName]').focus(); }
      const selected = saved.find(item => item.id === params.get('league'));
      if (selected) enter(await request(`leagues/${selected.id}`, { token: selected.key }), selected.key);
    } catch (error) { notice(error.message, true); }
  }
  setInterval(poll, 5000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  initialize();
})();
