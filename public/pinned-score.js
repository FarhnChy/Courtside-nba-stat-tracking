/* Keep the chosen game independent of the scoreboard's date and selection. */
(() => {
  const key = 'rimrelayPinnedScore';
  let saved;
  try { saved = JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) {}
  let game = saved?.game && /^\d+$/.test(String(saved.game.id)) ? saved.game : null;
  let corner = saved?.corner === 'left' ? 'left' : 'right';
  let desktop = null, revision = 0, busy = false;
  const panel = document.createElement('aside');
  panel.className = 'pinned-score';
  panel.setAttribute('aria-label', 'Pinned score');
  panel.innerHTML = '<div class="pin-header"><strong>COURTSIDE</strong><button type="button" data-close aria-label="Unpin score">Ã—</button></div><div data-score></div><p class="pin-status" role="status" data-status></p><div class="pin-actions"><button type="button" data-corner>Move corner</button><button type="button" data-desktop>Float on desktop</button></div>';
  document.body.append(panel);
  const persist = () => { try { if(game)localStorage.setItem(key, JSON.stringify({ game, corner }));else localStorage.removeItem(key); } catch (_) {} };
  const status = message => { panel.querySelector('[data-status]').textContent = message; };
  function render() {
    panel.hidden = !game;
    panel.dataset.corner = corner;
    if (!game) return;
    const score = panel.querySelector('[data-score]');
    score.replaceChildren();
    for (const side of [game.away, game.home]) {
      const row = document.createElement('div'); row.className = 'pin-team';
      const identity = document.createElement('span'); identity.className = 'pin-identity';
      const image = document.createElement('img'); image.src = new URL(teamLogoPath(side.abbreviation), location.href).href; image.alt = `${side.name || side.abbreviation} logo`; image.width = 36; image.height = 36;
      const name = document.createElement('span'); name.textContent = side.displayName || [side.city, side.name].filter(Boolean).join(' ') || side.abbreviation;
      identity.append(image, name);
      const points = document.createElement('b'); points.textContent = game.status.state === 'pre' ? 'â€”' : side.score ?? 'â€”';
      row.append(identity, points); score.append(row);
    }
    const detail = document.createElement('div'); detail.textContent = game.status.detail || 'Scheduled';
    detail.className = 'pin-status'; score.append(detail);
  }
  async function refresh() {
    if (!game || busy) return;
    busy = true;
    const version = revision, id = game.id;
    try {
      const response = await window.fetch(`/api/games/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Unavailable');
      const payload = await response.json();
      if (version !== revision) return;
      if (String(payload.game?.id) !== String(id) || !payload.game?.away || !payload.game?.home || !payload.game?.status) throw new Error('Invalid game');
      game = payload.game; persist(); render();
      status(`Updated ${new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })} Â· refreshes every 20s`);
    } catch (_) { if (version === revision) status('Update unavailable Â· showing last saved score. Retrying automatically.'); }
    finally { busy = false; if (version !== revision && game) refresh(); }
  }
  function addButtons() {
    document.querySelectorAll('.score-card').forEach(card => {
      if (card.querySelector('.pin-game')) return;
      const candidate = games.find(item => String(item.id) === card.dataset.id);
      if (!candidate?.raw) return;
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'pin-game';
      button.textContent = 'Pin score';
      button.setAttribute('aria-label', `Pin ${candidate.away} versus ${candidate.home} score`);
      button.addEventListener('keydown', event => event.stopPropagation());
      button.onclick = event => {
        event.stopPropagation();
        revision++; game = candidate.raw; persist(); render();
        status('Refreshing pinned scoreâ€¦'); refresh();
      };
      card.append(button);
    });
  }
  new MutationObserver(addButtons).observe(document.querySelector('#scoreGrid'), { childList:true, subtree:true });
  panel.querySelector('[data-close]').onclick = () => {
    revision++; game = null; persist(); render();
    if (desktop) desktop.close();
    document.querySelector('.pin-game')?.focus();
  };
  panel.querySelector('[data-corner]').onclick = () => { corner = corner === 'right' ? 'left' : 'right'; persist(); render(); };
  const floatButton = panel.querySelector('[data-desktop]');
  if (!window.documentPictureInPicture?.requestWindow) {
    floatButton.hidden = true;
    floatButton.title = 'Desktop floating requires a browser with Document Picture-in-Picture support.';
  }
  floatButton.onclick = async () => {
    if (desktop) { desktop.close(); return; }
    try {
      desktop = await window.documentPictureInPicture.requestWindow({ width:350, height:290 });
      desktop.document.title = 'Courtside Â· Pinned score';
      const style = desktop.document.createElement('link');
      style.rel = 'stylesheet'; style.href = new URL('pinned-score.css', location.href).href;
      desktop.document.head.append(style);
      desktop.document.body.className = 'pin-desktop';
      desktop.document.body.append(panel);
      floatButton.textContent = 'Back to corner';
      panel.querySelector('[data-corner]').hidden = true;
      desktop.addEventListener('pagehide', () => {
        document.body.append(panel); desktop = null;
        floatButton.textContent = 'Float on desktop';
        panel.querySelector('[data-corner]').hidden = false;
        render();
      }, { once:true });
    } catch (_) { status('Desktop window could not open. Your score stays pinned here.'); }
  };
  render(); addButtons();
  if (game) { status('Saved score Â· checking for updatesâ€¦'); refresh(); }
  window.setInterval(refresh, 20000);
})();
