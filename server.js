const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const espn = require('./lib/espn');
const finance = require('./lib/finance');

const root = path.join(__dirname, 'public');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png' };

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/api/health') return json(res, 200, { ok: true, provider: 'espn-site-api' });
  if (urlPath === '/api/finance/cap') {
    try {
      const season = new URL(req.url, 'http://localhost').searchParams.get('season') || '2026-27';
      return json(res, 200, finance.capOverview(season));
    } catch (error) { return json(res, 400, { error: error.message }); }
  }
  if (urlPath === '/api/finance/payrolls') {
    try { return json(res, 200, await finance.payrolls()); }
    catch (error) { return json(res, 502, { error: 'Payroll source unavailable', detail: error.message }); }
  }
  if (urlPath === '/api/free-agents') {
    try { return json(res, 200, await finance.freeAgents()); }
    catch (error) { return json(res, 502, { error: 'Free-agent tracker unavailable', detail: error.message }); }
  }
  const capHoldMatch = urlPath.match(/^\/api\/finance\/teams\/([A-Z]{3})\/cap-holds$/);
  if (capHoldMatch) {
    try { return json(res, 200, await finance.capHolds(capHoldMatch[1])); }
    catch (error) { return json(res, 502, { error: 'Cap holds unavailable', detail: error.message }); }
  }
  const contractMatch = urlPath.match(/^\/api\/finance\/teams\/([A-Z]{3})\/contracts$/);
  if (contractMatch) {
    try { return json(res, 200, await finance.teamContracts(contractMatch[1])); }
    catch (error) { return json(res, 502, { error: 'Team contracts unavailable', detail: error.message }); }
  }
  if (urlPath === '/api/scoreboard') {
    try {
      const date = new URL(req.url, 'http://localhost').searchParams.get('date') || '';
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json(res, 400, { error: 'Date must be YYYY-MM-DD' });
      return json(res, 200, await espn.scoreboard(date));
    } catch (error) { return json(res, 502, { error: 'Live scoreboard unavailable', detail: error.message }); }
  }
  if (urlPath === '/api/standings') {
    try {
      const season = new URL(req.url, 'http://localhost').searchParams.get('season') || '';
      if (season && !/^\d{4}$/.test(season)) return json(res, 400, { error: 'Season must be a four-digit ending year' });
      return json(res, 200, await espn.standings(season));
    } catch (error) { return json(res, 502, { error: 'Live standings unavailable', detail: error.message }); }
  }
  if (urlPath === '/api/teams') {
    try { return json(res, 200, await espn.teamsList()); }
    catch (error) { return json(res, 502, { error: 'Team directory unavailable', detail: error.message }); }
  }
  const rosterMatch = urlPath.match(/^\/api\/teams\/(\d+)\/roster$/);
  if (rosterMatch) {
    try { return json(res, 200, await espn.roster(rosterMatch[1])); }
    catch (error) { return json(res, 502, { error: 'Roster unavailable', detail: error.message }); }
  }
  if (urlPath === '/api/injuries') {
    try { return json(res, 200, await espn.injuries()); }
    catch (error) { return json(res, 502, { error: 'Injury report unavailable', detail: error.message }); }
  }
  if (urlPath === '/api/transactions') {
    try { return json(res, 200, await espn.transactions()); }
    catch (error) { return json(res, 502, { error: 'Transactions unavailable', detail: error.message }); }
  }
  const playerMatch = urlPath.match(/^\/api\/players\/(\d+)$/);
  if (playerMatch) {
    try { return json(res, 200, await espn.playerOverview(playerMatch[1])); }
    catch (error) { return json(res, 502, { error: 'Player profile unavailable', detail: error.message }); }
  }
  const gameMatch = urlPath.match(/^\/api\/games\/(\d+)$/);
  if (gameMatch) {
    try { return json(res, 200, await espn.summary(gameMatch[1])); }
    catch (error) { return json(res, 502, { error: 'Game summary unavailable', detail: error.message }); }
  }
  const requested = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const file = path.resolve(root, requested);
  const relative = path.relative(root, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN' });
    res.end(data);
  });
});

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';
  server.listen(port, host, () => console.log(`Courtside running at http://${host}:${port}`));
}

module.exports = { server };
