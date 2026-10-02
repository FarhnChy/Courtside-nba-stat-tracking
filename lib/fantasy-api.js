const crypto = require('node:crypto');
const { createStore, failure } = require('./fantasy-store');
const { createFantasy } = require('./fantasy');
const espn = require('./espn');

function createFantasyHandler({ store = createStore(), provider = espn, clock, catalogLoader } = {}) {
  const fantasy = createFantasy({ store, provider, clock, catalogLoader });
  function send(res, status, value) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    res.end(JSON.stringify(value));
  }
  async function body(req) {
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw failure('Send JSON to this endpoint.', 415);
    let size = 0; const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 8192) throw failure('Request is too large.', 413);
      chunks.push(chunk);
    }
    try {
      const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
      return value;
    } catch (_) { throw failure('Invalid JSON request.', 400); }
  }
  async function limit(req, create) {
    const address = process.env.VERCEL ? req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress : req.socket?.remoteAddress;
    const id = crypto.createHash('sha256').update(String(address || 'unknown')).digest('hex').slice(0, 24);
    const now = Date.now();
    await store.update(`limit-${id}`, old => {
      const state = old || {};
      if (!state.minute || now - state.minute >= 60000) { state.minute = now; state.requests = 0; }
      if (!state.hour || now - state.hour >= 3600000) { state.hour = now; state.creates = 0; }
      if (state.requests >= 240 || (create && state.creates >= 10)) throw failure('Too many requests. Please try again later.', 429);
      state.requests++; if (create) state.creates++; return state;
    });
  }
  return async function fantasyHandler(req, res, route) {
    try {
      if (req.method === 'GET' && route === '/api/fantasy/config') return send(res, 200, { available: store.available, storage: store.mode });
      if (!['GET', 'POST'].includes(req.method)) return send(res, 405, { error: 'Use GET or POST.' });
      if (req.method === 'POST' && req.headers.origin) {
        let origin;
        try { origin = new URL(req.headers.origin); } catch (_) { throw failure('Invalid request origin.', 403); }
        if (origin.host !== req.headers.host) throw failure('Cross-site requests are not allowed.', 403);
      }
      const token = req.headers.authorization?.match(/^Bearer ([\w-]{32})$/)?.[1];
      if (!token) throw failure('A private team key is required.', 401);
      await limit(req, req.method === 'POST' && route === '/api/fantasy/leagues');
      if (route === '/api/fantasy/leagues' && req.method === 'POST') return send(res, 201, await fantasy.create(await body(req), token));
      const match = route.match(/^\/api\/fantasy\/leagues\/([a-f0-9]{18})(?:\/(join|actions|sync))?$/);
      if (!match) return send(res, 404, { error: 'Fantasy endpoint not found.' });
      const [, id, action] = match;
      if (!action && req.method === 'GET') return send(res, 200, await fantasy.get(id, token));
      if (req.method !== 'POST' || !action) return send(res, 405, { error: 'Method not allowed.' });
      const input = await body(req);
      if (action === 'join') return send(res, 200, await fantasy.join(id, input, token));
      if (action === 'actions') return send(res, 200, await fantasy.action(id, token, input));
      return send(res, 200, await fantasy.sync(id, token));
    } catch (error) {
      return send(res, error.status || 503, { error: error.status ? error.message : 'Fantasy is temporarily unavailable. Please try again.' });
    }
  };
}

module.exports = { createFantasyHandler };
