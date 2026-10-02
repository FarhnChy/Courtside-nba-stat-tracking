// Optional real-browser integration test. Requires Node 22+ and Edge/Chromium.
// No npm/browser download and no production league data are used.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { createStore } = require('../lib/fantasy-store');
const { createFantasyHandler } = require('../lib/fantasy-api');
const { requestHandler } = require('../server');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'courtside-fantasy-browser-'));
  const artifacts = path.resolve(__dirname, '..', '.visual-profile-fantasy');
  const handler = createFantasyHandler({
    store: createStore({ FANTASY_DATA_DIR: path.join(temporary, 'leagues') }),
    catalogLoader: async () => Array.from({ length: 24 }, (_, i) => ({ id: String(i + 1), name: `Test Player ${String(i + 1).padStart(2, '0')}`, team: i % 2 ? 'NYK' : 'BOS', position: i % 3 ? 'G' : 'C' })),
    provider: { scoreboard: async () => ({ games: [] }) }
  });
  const server = http.createServer((req, res) => {
    const route = new URL(req.url, 'http://localhost').pathname;
    return route.startsWith('/api/fantasy/') ? handler(req, res, route) : requestHandler(req, res);
  });
  let browser, socket;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const executable = process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const profile = path.join(temporary, 'browser');
    browser = spawn(executable, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    let launchError; browser.on('error', error => { launchError = error; });
    let port;
    for (let i = 0; i < 100; i++) {
      if (launchError) throw launchError;
      try { port = (await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch (_) { await delay(200); }
    }
    assert.ok(port, 'browser should start');
    const debug = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    socket = new WebSocket(debug.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let nextId = 0; const waiting = new Map(); const errors = [];
    socket.onmessage = event => {
      const payload = JSON.parse(event.data);
      if (payload.method === 'Runtime.exceptionThrown') errors.push(payload.params.exceptionDetails.text + ': ' + (payload.params.exceptionDetails.exception?.description || ''));
      if (!payload.id) return;
      const pending = waiting.get(payload.id); if (!pending) return;
      waiting.delete(payload.id); clearTimeout(pending.timer);
      if (payload.error) pending.reject(new Error(payload.error.message)); else pending.resolve(payload.result);
    };
    function send(method, params = {}, sessionId) {
      return new Promise((resolve, reject) => {
        const id = ++nextId;
        const timer = setTimeout(() => { waiting.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
        waiting.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    }
    async function page(mobile = false) {
      const { browserContextId } = await send('Target.createBrowserContext');
      const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
      const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
      await send('Runtime.enable', {}, sessionId); await send('Page.enable', {}, sessionId);
      await send('Emulation.setDeviceMetricsOverride', { width: mobile ? 390 : 1440, height: mobile ? 844 : 1000, deviceScaleFactor: 1, mobile }, sessionId);
      const evaluate = async expression => {
        const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
        return result.result.value;
      };
      const wait = async expression => {
        for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(100); }
        throw new Error(`Browser condition timed out: ${expression}; notice: ${await evaluate('document.querySelector("#fantasyNotice")?.textContent')}; runtime errors: ${errors.join('; ')}`);
      };
      return { sessionId, evaluate, wait, navigate: url => send('Page.navigate', { url }, sessionId) };
    }
    const owner = await page(); const friend = await page(true);
    await owner.navigate(`${base}/fantasy.html`); await owner.wait('document.querySelector("#createLeague") && document.querySelector("#fantasyNotice").textContent.includes("saved on this server")');
    await owner.evaluate(`(() => { const form = document.querySelector('#createLeague'); form.elements.name.value = 'Browser Friends'; form.elements.teamName.value = 'Home Team'; form.elements.capacity.value = '2'; form.elements.rosterSize.value = '6'; form.elements.starters.value = '3'; form.requestSubmit(); })()`);
    await owner.wait('document.querySelector("#recoveryDialog").open');
    const recovery = await owner.evaluate('document.querySelector("#recoveryValue").value');
    const id = recovery.split('.')[0];
    await owner.evaluate('document.querySelector("#closeRecovery").click()');
    await friend.navigate(`${base}/fantasy.html#join=${id}`);
    await friend.wait(`document.querySelector('#joinLeague [name=code]')?.value === '${id}'`);
    await friend.evaluate(`document.querySelector('#joinLeague [name=teamName]').value = 'Away Team'; document.querySelector('#joinLeague').requestSubmit()`);
    await friend.wait('document.querySelector("#recoveryDialog").open'); await friend.evaluate('document.querySelector("#closeRecovery").click()');
    await owner.wait('document.querySelector("#startDraft") && !document.querySelector("#startDraft").disabled');
    await owner.evaluate('document.querySelector("#startDraft").click()');
    await owner.wait('Boolean(document.querySelector("#autoPick"))');
    for (let pick = 0; pick < 12; pick++) {
      await owner.wait(`document.querySelector('.fantasy-turn .eyebrow')?.textContent.includes('PICK ${pick + 1} OF') && !document.querySelector('#autoPick').disabled`);
      await owner.evaluate('document.querySelector("#autoPick").click()');
    }
    await owner.wait('Boolean(document.querySelector("#lineupForm"))');
    await friend.wait('Boolean(document.querySelector("#lineupForm"))');
    await owner.evaluate(`document.querySelectorAll('#lineupForm input').forEach((input, i) => input.checked = i >= 3); document.querySelector('#lineupForm').requestSubmit()`);
    await owner.wait('document.querySelector("#fantasyNotice").textContent.includes("Lineup saved")');
    await owner.evaluate('document.querySelector("#playerSearch").value = "Test Player 13"; document.querySelector("#playerSearch").dispatchEvent(new Event("input", {bubbles:true}))');
    assert.equal(await owner.evaluate('document.querySelectorAll("#playerPool [data-player]").length'), 1);
    await owner.evaluate(`document.querySelector('#dropPlayer').selectedIndex = 1; document.querySelector('#playerPool [data-player]').click()`);
    await owner.wait('document.querySelector("#lineupForm").textContent.includes("Test Player 13")');
    assert.equal(await friend.evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'league screen fits mobile width');
    const recovered = await page(); await recovered.navigate(`${base}/fantasy.html`); await recovered.wait('document.querySelector("#fantasyNotice")?.textContent.includes("saved on this server")');
    await recovered.evaluate(`document.querySelector('#recoverTeam [name=recovery]').value = ${JSON.stringify(recovery)}; document.querySelector('#recoverTeam').requestSubmit()`);
    await recovered.wait('Boolean(document.querySelector("#lineupForm"))');
    assert.equal(await recovered.evaluate('document.querySelector("#lineupForm").textContent.includes("Test Player 13")'), true, 'recovered team sees persisted roster');
    await fs.mkdir(artifacts, { recursive: true });
    for (const [label, target] of [['desktop', owner], ['mobile', friend]]) {
      const screenshot = await send('Page.captureScreenshot', { format: 'png' }, target.sessionId);
      await fs.writeFile(path.join(artifacts, `fantasy-${label}.png`), Buffer.from(screenshot.data, 'base64'));
    }
    assert.deepEqual(errors, [], 'browser should have no runtime exceptions');
    await send('Browser.close');
    console.log('✓ Two-browser create/join, snake draft, daily lineup, add/drop, recovery, and mobile layout verified');
    console.log(`Screenshots: ${artifacts}`);
  } finally {
    socket?.close();
    if (browser && browser.exitCode === null) { browser.kill(); await delay(500); }
    await new Promise(resolve => server.close(resolve));
    assert.ok(path.resolve(temporary).startsWith(path.resolve(os.tmpdir()) + path.sep));
    await fs.rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
