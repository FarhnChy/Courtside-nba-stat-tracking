const crypto = require('node:crypto');

function createBackgroundJobs({ store, fantasy, moves, news, clock = () => new Date(), secret = () => process.env.CRON_SECRET }) {
  let pending;
  async function run() {
    if (pending) return pending;
    pending = (async () => {
      const now = clock(), owner = crypto.randomUUID();
      const lease = await store.update('jobs-state', old => {
        if (old?.leaseUntil > +now) return old;
        return { ...old, owner, leaseUntil: +now + 300000 };
      });
      if (lease.owner !== owner) return { skipped: true, reason: 'A refresh is already running.' };
      const errors = []; let updated = 0, processed = 0;
      const started = Date.now();
      try {
        const discovery = store.discover ? await store.discover(lease.discoveryCursor || '0') : { ids: [], cursor: '0' };
        if (discovery.ids.length) await store.update('league-index', old => ({ ids: [...new Set([...(old?.ids || []), ...discovery.ids])] }));
        const index = await store.read('league-index');
        const ids = index?.ids || [], batchSize = Math.min(ids.length, 10);
        const cursor = (lease.cursor || 0) % Math.max(ids.length, 1);
        for (let i = 0; i < batchSize; i++) {
          if (Date.now() - started > 180000) break;
          try {
            const result = await fantasy.background(ids[(cursor + i) % ids.length]); updated++;
            if (result?.errors?.length) errors.push('NBA scores are unavailable for some league dates; previous scores are retained.');
          }
          catch (_) { errors.push('A league refresh failed; it will retry on a later run.'); }
          processed++;
        }
        let feedsAt = lease.feedsAt;
        if (!lease.feedsAt || +now - Date.parse(lease.feedsAt) >= 300000) {
          await Promise.all([
            moves.load().then(value => { if (value.stale) throw new Error('stale'); }).catch(() => errors.push('Some transaction sources are unavailable.')),
            news().then(value => store.update('news-snapshot', () => ({ at: now.toISOString(), value }))).catch(() => errors.push('News refresh failed; the previous snapshot is retained.'))
          ]);
          feedsAt = now.toISOString();
        }
        const result = { at: clock().toISOString(), updated, errors, registered: ids.length };
        await store.update('jobs-state', state => state?.owner === owner ? { ...state, ...result, cursor: (cursor + processed) % Math.max(ids.length, 1), discoveryCursor: discovery.cursor, feedsAt, leaseUntil: 0 } : state);
        return result;
      } catch (error) {
        await store.update('jobs-state', state => state?.owner === owner ? { ...state, leaseUntil: 0, errors: ['Refresh interrupted; retry required.'] } : state);
        throw error;
      }
    })().finally(() => { pending = null; });
    return pending;
  }
  async function handler(req, res) {
    const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
    if (!['GET', 'POST'].includes(req.method)) return send(405, { error: 'Use GET or POST.' });
    const expected = secret();
    if (!expected) return send(503, { error: 'Background jobs are not configured.' });
    const actual = req.headers.authorization || '';
    const hash = text => crypto.createHash('sha256').update(text).digest();
    if (!crypto.timingSafeEqual(hash(actual), hash(`Bearer ${expected}`))) return send(401, { error: 'Unauthorized.' });
    try { const result = await run(); return send(result.errors?.length ? 502 : 200, result); }
    catch (_) { return send(503, { error: 'Background refresh failed. Check storage and retry.' }); }
  }
  function start() {
    const refresh = () => run().catch(() => console.warn('Courtside background refresh failed; retrying on the next interval.'));
    refresh(); const timer = setInterval(refresh, 60000); timer.unref(); return () => clearInterval(timer);
  }
  return { run, handler, start };
}
module.exports = { createBackgroundJobs };
