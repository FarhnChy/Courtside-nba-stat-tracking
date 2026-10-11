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
    const nextSignature = JSON.stringify([league.id, league.status, league.picks.length, league.teams.map(team => [team.id, team.roster, team.ir]), league.nextDate, league.claims, league.trades, league.waivers, league.playoffs, league.queue]);
    if (signature === nextSignature) { updateScores(); return; }
    signature = nextSignature;
    const root = $('#leagueContent');
    if (league.status === 'lobby') {
      root.innerHTML = `<div class="fantasy-columns"><section class="fantasy-card"><h2>The managers</h2>${managers()}<p>Send the invite link to your friends. Starting the draft locks membership and scoring settings.</p>${league.me === league.commissioner ? `<button id="startDraft" class="primary-action" ${league.teams.length < 2 ? 'disabled' : ''}>Start snake draft</button>` : '<p>Waiting for the commissioner to start the draft.</p>'}</section><section class="fantasy-card"><h2>League rules</h2><p>${league.weeks} matchups, seven days each. Scoring starts the day after the draft finishes.</p><p>PTS 1 · REB 1.2 · AST 1.5 · STL 3 · BLK 3 · TO −1</p><p>${league.starters} utility starters. Lineups lock at midnight New York time. Set tomorrow’s lineup today; it carries forward until changed.</p><p>${league.rules.waiverHours ? `${league.rules.waiverHours}-hour waivers for dropped players` : 'First-come adds/drops'}. ${league.rules.irSlots} IR slots. ${league.rules.playoffTeams || 'No'} playoff teams. Automatic picks follow your queue, then alphabetical order.</p></section></div>`;
    } else if (league.status === 'draft') {
      const mine = league.nextTeam === league.me;
      root.innerHTML = `<section class="fantasy-turn"><p class="eyebrow">ROUND ${Math.floor(league.picks.length / league.teams.length) + 1} · PICK ${league.picks.length + 1} OF ${league.rosterSize * league.teams.length}</p><strong>${mine ? 'You’re on the clock' : `${html(teamName(league.nextTeam))} is picking`}</strong><p>${league.draftDeadline ? `Pick deadline: ${html(new Date(league.draftDeadline).toLocaleTimeString())}.` : 'No timer.'} Draft order: ${league.order.map(id => html(teamName(id))).join(' → ')}. Order reverses each round.</p>${mine || league.me === league.commissioner ? '<button id="autoPick" class="secondary-action">Make automatic pick</button>' : ''}</section><div class="fantasy-columns"><section class="fantasy-card"><h2>Available players</h2><p>Automatic picks use your queue, then alphabetical order. Save a queue while waiting for your turn.</p><div id="draftQueue"></div><label>Find a player<input id="playerSearch" type="search" placeholder="Name, team, or position"></label><div id="playerPool" class="fantasy-pool"></div></section><section class="fantasy-card"><h2>Draft board</h2>${league.picks.length ? [...league.picks].reverse().map((pick, index) => `<div class="fantasy-team"><div><strong>${html(player(pick.playerId).name)}</strong><small>${html(teamName(pick.teamId))}</small></div><span>#${league.picks.length - index}</span></div>`).join('') : '<p>The first pick is up.</p>'}</section></div>`;
      renderPool(); renderQueue();
    } else {
      root.innerHTML = `<div class="fantasy-turn"><strong>${league.matchup.week > league.weeks ? 'Playoffs - week ' + (league.matchup.week - league.weeks) : 'Week ' + league.matchup.week + ' of ' + league.weeks}</strong><p>Season starts ${html(league.startDate)}. Lineups for ${html(league.today)} are locked. Changes below apply ${html(league.nextDate)}, at midnight New York time.</p><p class="fantasy-help">PTS 1 · REB 1.2 · AST 1.5 · STL 3 · BLK 3 · TO −1. All positions eligible. Dropped players follow your league’s waiver rules. Trades and IR changes apply tomorrow.</p></div><div class="fantasy-columns"><div class="fantasy-stack"><section class="fantasy-card" id="matchups"></section><section class="fantasy-card" id="standings"></section><section class="fantasy-card"><h2>Recent activity</h2><div id="activity">${activity()}</div></section></div><div class="fantasy-stack"><form id="lineupForm" class="fantasy-card"><h2>Your next lineup</h2><p>Choose up to ${league.starters} starters for ${html(league.nextDate)}. Unselected players stay on your bench. Today’s locked lineup: ${me().todayLineup.map(id => html(player(id).name)).join(', ') || 'No starters'}.</p>${me().roster.map(id => `<label><input type="checkbox" name="starter" value="${html(id)}" ${me().nextLineup.includes(id) ? 'checked' : ''}>${html(player(id).name)} <small>· ${html(player(id).position)} / ${html(player(id).team)}</small></label>`).join('')}<button class="primary-action" type="submit">Save lineup</button></form><section class="fantasy-card"><h2>Add a player</h2><p>New players are eligible tomorrow. After adding, select them in your next lineup.</p><label>Drop a player${me().roster.length >= league.rosterSize ? ' (required)' : ' (optional)'}<select id="dropPlayer"><option value="">Choose a player</option>${me().roster.map(id => `<option value="${html(id)}">${html(player(id).name)}</option>`).join('')}</select></label><label>Find an available player<input id="playerSearch" type="search" placeholder="Name, team, or position"></label><div id="playerPool" class="fantasy-pool"></div></section></div></div><section class="fantasy-card fantasy-rules"><h2>League rosters</h2><div class="fantasy-columns">${league.teams.map(team => `<div><h3>${html(team.name)}</h3><p>${team.roster.map(id => html(player(id).name)).join(' · ')}</p></div>`).join('')}</div></section>`;
      root.insertAdjacentHTML('beforeend', advancedPanels());
      renderPool(); updateScores();
    }
  }
  function updateScores() {
    if (!$('#matchups')) return;
    const match = league.matchup;
    $('#matchups').innerHTML = `<h2>Week ${match.week} matchups</h2><p>${html(match.dates[0])} – ${html(match.dates.at(-1))} · ${match.complete ? 'Final' : 'Provisional'}</p>${match.pairs.map(([a, b]) => `<div class="fantasy-match"><div>${html(teamName(a))}<strong>${a ? (match.totals[a] || 0).toFixed(1) : '—'}</strong></div><em>VS</em><div>${html(teamName(b))}<strong>${b ? (match.totals[b] || 0).toFixed(1) : '—'}</strong></div></div>`).join('')}<p class="fantasy-help">${league.sync ? `Last checked ${html(new Date(league.sync.at).toLocaleString())}.${league.sync.errors.length ? ' Some NBA statistics are unavailable. Previous scores are retained.' : ''}${league.sync.remaining ? ` ${league.sync.remaining} previous days await final statistics or catch-up.` : ''}` : 'Waiting for the first box-score update.'} Scores refresh about every minute while this league is open, and through configured background jobs when closed. Final results require all seven days to be complete.</p>`;
    $('#standings').innerHTML = `<h2>Standings</h2><p>${league.standings.completedWeeks} completed matchup weeks. Points below include finalized weeks only.</p><div class="table-scroll"><table><thead><tr><th>Team</th><th>W</th><th>L</th><th>T</th><th>Points</th></tr></thead><tbody>${league.standings.rows.map(row => `<tr><td>${html(row.name)}</td><td>${row.wins}</td><td>${row.losses}</td><td>${row.ties}</td><td>${row.points.toFixed(1)}</td></tr>`).join('')}</tbody></table></div>`;
    $('#activity').innerHTML = activity();
  }
  function renderPool() {
    const query = ($('#playerSearch')?.value || '').toLowerCase();
    const taken = new Set(league.teams.flatMap(team => [...team.roster, ...(team.ir || [])]));
    const available = league.players.filter(player => !taken.has(player.id) && `${player.name} ${player.team} ${player.position}`.toLowerCase().includes(query));
    const canPick = league.status !== 'draft' || league.nextTeam === league.me;
    $('#playerPool').innerHTML = available.length ? available.map(player => `<div class="fantasy-team"><div><strong>${html(player.name)}</strong><small>${html(player.position)} · ${html(player.team)}</small></div><button class="secondary-action" data-player="${html(player.id)}" ${canPick ? '' : 'disabled'}>${league.status === 'draft' ? 'Draft' : league.waivers[player.id] ? 'Claim' : 'Add'}</button>${league.status === 'draft' ? `<button class="secondary-action" data-queue="${html(player.id)}" ${league.queue.includes(player.id) ? 'disabled' : ''}>Queue</button>` : league.waivers[player.id] ? `<small>Waivers clear ${html(new Date(league.waivers[player.id].until).toLocaleString())}</small>` : ''}</div>`).join('') : '<p class="fantasy-empty">No available players match.</p>';
  }
  function renderQueue() {
    if (!$('#draftQueue')) return;
    $('#draftQueue').innerHTML = '<h3>Your automatic pick queue</h3>' + (league.queue.length ? league.queue.map((id, i) => `<p>${i + 1}. ${html(player(id).name)} <button class="secondary-action" data-unqueue="${html(id)}">Remove</button></p>`).join('') : '<p>Your queue is empty. Add players in your preferred order.</p>');
  }
  function advancedPanels() {
    const options = ids => ids.map(id => `<option value="${html(id)}">${html(player(id).name)}</option>`).join('');
    const tradeRows = league.trades.map(t => `<div class="fantasy-card"><p>${html(teamName(t.from))} offers ${html(player(t.giveId).name)} for ${html(player(t.receiveId).name)} from ${html(teamName(t.to))}.</p><p>${html(t.status)} - expires ${html(new Date(t.expiresAt).toLocaleString())}</p>${t.status === 'pending' ? (t.to === league.me ? `<button class="primary-action" data-trade-action="acceptTrade" data-trade-id="${html(t.id)}">Accept</button> <button class="secondary-action" data-trade-action="rejectTrade" data-trade-id="${html(t.id)}">Reject</button>` : `<button class="secondary-action" data-trade-action="cancelTrade" data-trade-id="${html(t.id)}">Cancel offer</button>`) : ''}</div>`).join('');
    return `<div class="fantasy-columns fantasy-rules"><section class="fantasy-card"><h2>Waivers</h2><p>${league.rules.waiverHours ? league.rules.waiverHours + '-hour hold on dropped players. Use Claim in the player pool. Successful claims move to the back of the priority order; your claims stay private.' : 'Waivers are off for this league.'}</p><p>Priority: ${league.waiverOrder.map(id => html(teamName(id))).join(' / ')}</p>${league.claims.map(c => `<p>${html(player(c.playerId).name)}${c.dropId ? ' (drop ' + html(player(c.dropId).name) + ')' : ''} <button class="secondary-action" data-cancel-claim="${html(c.playerId)}">Cancel claim</button></p>`).join('')}</section><section class="fantasy-card"><h2>Injured reserve - ${me().ir.length}/${league.rules.irSlots}</h2><p>Only players currently listed Out or Injured Reserve by ESPN can be reserved. IR players remain owned and cannot start.</p>${league.rules.irSlots ? me().roster.map(id => `<p>${html(player(id).name)} <button class="secondary-action" data-ir="${html(id)}">Move to IR</button></p>`).join('') : ''}${me().ir.length ? `<label>Drop to make room when activating<select id="irDrop"><option value="">No drop</option>${options(me().roster)}</select></label>${me().ir.map(id => `<p>${html(player(id).name)} <button class="secondary-action" data-activate="${html(id)}">Activate</button></p>`).join('')}` : ''}</section></div><section class="fantasy-card fantasy-rules"><h2>Trades</h2><form id="tradeForm"><div class="fantasy-fields"><label>You give<select name="giveId" required>${options(me().roster)}</select></label><label>You receive<select name="receive" required>${league.teams.filter(t => t.id !== league.me).map(t => `<optgroup label="${html(t.name)}">${t.roster.map(id => `<option value="${html(t.id)}:${html(id)}">${html(player(id).name)}</option>`).join('')}</optgroup>`).join('')}</select></label></div><button class="primary-action" type="submit">Propose trade</button></form><p>One active player for one active player. Offers expire in 48 hours. Accepted trades apply to tomorrow’s lineup.</p>${tradeRows}</section><section class="fantasy-card fantasy-rules"><h2>Playoffs</h2>${league.playoffs ? `<p>Seeds: ${league.playoffs.seeds.map((id, i) => (i + 1) + '. ' + html(teamName(id))).join(' / ')}</p>${league.playoffs.rounds.map((r, i) => `<h3>Round ${i + 1}</h3>${r.pairs.map(([a, b]) => `<p>${html(teamName(a))} vs ${html(teamName(b))}${r.winners ? ' - Winner: ' + html(teamName(r.winners[r.pairs.findIndex(p => p[0] === a)])) : ''}</p>`).join('')}`).join('')}${league.playoffs.champion ? '<strong>Champion: ' + html(teamName(league.playoffs.champion)) + '</strong>' : ''}` : `<p>${league.rules.playoffTeams ? 'Top ' + league.rules.playoffTeams + ' teams qualify after all regular-season results are final. Seeding uses wins, ties, then points; remaining ties use manager join order. Each round lasts seven days. Tied playoff scores favor the higher seed.' : 'Playoffs are off for this league.'}</p>`}</section>`;
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
    for (const field of ['capacity', 'rosterSize', 'starters', 'weeks', 'draftSeconds', 'waiverHours', 'irSlots', 'playoffTeams']) data[field] = Number(data[field]);
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
    if (event.target.id === 'tradeForm') {
      event.preventDefault(); const data = Object.fromEntries(new FormData(event.target));
      const [teamId, receiveId] = data.receive.split(':');
      perform(() => action({ action: 'trade', giveId: data.giveId, teamId, receiveId })); return;
    }
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
    if (button.dataset.queue) perform(() => action({ action: 'queue', players: [...league.queue, button.dataset.queue] }));
    if (button.dataset.unqueue) perform(() => action({ action: 'queue', players: league.queue.filter(id => id !== button.dataset.unqueue) }));
    if (button.dataset.cancelClaim) perform(() => action({ action: 'cancelClaim', playerId: button.dataset.cancelClaim }));
    if (button.dataset.tradeAction) perform(() => action({ action: button.dataset.tradeAction, tradeId: button.dataset.tradeId }));
    if (button.dataset.ir) perform(() => action({ action: 'ir', playerId: button.dataset.ir }));
    if (button.dataset.activate) perform(() => action({ action: 'activate', playerId: button.dataset.activate, dropId: $('#irDrop').value }));
    if (button.dataset.player) {
      const playerId = button.dataset.player;
      const body = league.status === 'draft' ? { action: 'pick', playerId, pickNumber: league.picks.length } : { action: league.waivers[playerId] ? 'claim' : 'addDrop', playerId, dropId: $('#dropPlayer').value, date: league.nextDate };
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
