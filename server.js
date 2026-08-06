const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createProvider } = require('./providers/provider');

const root = path.join(__dirname, 'public');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
const provider = createProvider();

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache'
  });
  res.end(JSON.stringify(payload));
}

function requestOptions(url) {
  return {
    date: url.searchParams.get('date') || undefined,
    search: url.searchParams.get('search') || undefined,
    team: url.searchParams.get('team') || undefined
  };
}

async function apiResponse(url, res) {
  const urlPath = url.pathname;
  const options = requestOptions(url);

  if (urlPath === '/api/health') {
    return sendJson(res, 200, await provider.getHealth());
  }

  if (urlPath === '/api/bootstrap') {
    return sendJson(res, 200, await provider.getBootstrap(options));
  }

  if (urlPath === '/api/games') {
    return sendJson(res, 200, await provider.getGames(options));
  }

  if (urlPath === '/api/teams') {
    return sendJson(res, 200, await provider.getTeams(options));
  }

  if (urlPath === '/api/players') {
    return sendJson(res, 200, await provider.getPlayers(options));
  }

  if (urlPath === '/api/injuries') {
    return sendJson(res, 200, await provider.getInjuries(options));
  }

  if (urlPath.startsWith('/api/games/')) {
    const id = urlPath.split('/').pop();
    const gamePayload = await provider.getGame(id, options);
    if (!gamePayload) return sendJson(res, 404, { error: 'game_not_found' });
    return sendJson(res, 200, gamePayload);
  }

  if (urlPath === '/api/standings') {
    return sendJson(res, 200, await provider.getStandings(options));
  }

  if (urlPath === '/api/predictions') {
    return sendJson(res, 200, await provider.getPredictions(options));
  }

  if (urlPath === '/api/transactions' && provider.getTransactions) {
    return sendJson(res, 200, await provider.getTransactions(options));
  }

  if (urlPath === '/api/coaches' && provider.getCoaches) {
    return sendJson(res, 200, await provider.getCoaches(options));
  }

  return sendJson(res, 404, { error: 'api_route_not_found' });
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, 'http://localhost');
  const urlPath = decodeURIComponent(requestUrl.pathname);
  requestUrl.pathname = urlPath;
  if (urlPath.startsWith('/api/')) {
    return apiResponse(requestUrl, res).catch((error) => {
      console.error(error);
      sendJson(res, 500, { error: 'internal_server_error' });
    });
  }

  const requested = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const file = path.resolve(root, requested);
  if (!file.startsWith(path.resolve(root))) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => console.log(`Courtside running at http://localhost:${port}`));
