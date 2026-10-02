const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

function failure(message, status = 503) { return Object.assign(new Error(message), { status }); }

// Each league is one atomic document. Compare-and-set prevents two managers
// from drafting the same player, even on separate Vercel instances.
function createStore(env = process.env) {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  const hosted = Boolean(url && token);
  const available = hosted || (!env.VERCEL && !url && !token);
  const directory = env.FANTASY_DATA_DIR || path.join(__dirname, '..', '.fantasy-data');
  const prefix = env.FANTASY_KEY_PREFIX || 'courtside:fantasy:v1:';
  let queue = Promise.resolve();
  async function command(args) {
    if (!available) throw failure('Fantasy storage is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN on the server.');
    const response = await fetch(url, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args), signal: AbortSignal.timeout(10000)
    });
    const payload = await response.json();
    if (!response.ok || payload.error) throw failure('Fantasy storage is temporarily unavailable. Please retry.');
    return payload.result;
  }
  function filename(id) {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw failure('Invalid storage key.', 400);
    return path.join(directory, `${id}.json`);
  }
  async function read(id) {
    if (!available) throw failure('Fantasy storage is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN on the server.');
    if (hosted) return command(['GET', prefix + id]);
    try { return await fs.readFile(filename(id), 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  async function update(id, change) {
    async function attempt() {
      for (let retry = 0; retry < 12; retry++) {
        const old = await read(id);
        const result = change(old ? JSON.parse(old) : null);
        const next = JSON.stringify(result);
        if (hosted) {
          const script = "local old=redis.call('GET',KEYS[1]); if (old or '')~=ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1";
          if (await command(['EVAL', script, 1, prefix + id, old || '', next]) === 1) return result;
        } else {
          await fs.mkdir(directory, { recursive: true });
          const temporary = `${filename(id)}.${crypto.randomUUID()}.tmp`;
          await fs.writeFile(temporary, next, { mode: 0o600 });
          await fs.rename(temporary, filename(id));
          return result;
        }
      }
      throw failure('Another manager changed the league. Refresh and try again.', 409);
    }
    if (hosted) return attempt();
    // Local mode supports a single Node process and survives restarts.
    const pending = queue.then(attempt);
    queue = pending.catch(() => {});
    return pending;
  }
  return { read: async id => { const raw = await read(id); return raw ? JSON.parse(raw) : null; }, update, available, mode: hosted ? 'hosted' : available ? 'local' : 'unconfigured' };
}

module.exports = { createStore, failure };
