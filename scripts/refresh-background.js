const base = process.env.COURTSIDE_BASE_URL;
const secret = process.env.CRON_SECRET;
async function main() {
  if (!base || !secret) { console.log('Background refresh skipped: configure COURTSIDE_BASE_URL and CRON_SECRET.'); return; }
  const url = new URL('/api/jobs/refresh', base);
  if (url.protocol !== 'https:') throw new Error('COURTSIDE_BASE_URL must use HTTPS.');
  const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${secret}` }, redirect: 'error', signal: AbortSignal.timeout(240000) });
  if (!response.ok) throw new Error(`Background refresh returned HTTP ${response.status}.`);
  console.log('Courtside background refresh completed.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
