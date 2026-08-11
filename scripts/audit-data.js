const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'data');
const staleDays = Number(process.env.COURTSIDE_STALE_DAYS || 7);
const strict = process.argv.includes('--strict');
const now = new Date();

function datesIn(source) {
  const matches = source.match(/\b20\d{2}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?Z?)?\b/g) || [];
  return matches
    .map(value => new Date(value.length === 10 ? `${value}T12:00:00Z` : value))
    .filter(date => Number.isFinite(date.getTime()));
}

const rows = fs.readdirSync(dataDir)
  .filter(file => file.endsWith('.js'))
  .map(file => {
    const fullPath = path.join(dataDir, file);
    const dates = datesIn(fs.readFileSync(fullPath, 'utf8')).sort((a, b) => b - a);
    const auditDates = dates.filter(date => date <= now);
    const latest = auditDates[0] || dates[0] || null;
    const ageDays = latest ? Math.floor((now - latest) / 86_400_000) : null;
    return { file, latest, ageDays };
  });

let stale = false;
for (const row of rows) {
  if (!row.latest) {
    console.log(`WARN ${row.file}: no dated entries found`);
    stale = true;
    continue;
  }
  const status = row.ageDays > staleDays ? 'WARN' : 'OK';
  if (status === 'WARN') stale = true;
  console.log(`${status} ${row.file}: latest ${row.latest.toISOString().slice(0, 10)} (${row.ageDays} days old)`);
}

if (strict && stale) process.exitCode = 1;
