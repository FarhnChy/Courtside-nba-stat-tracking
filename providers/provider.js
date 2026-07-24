const fs = require('node:fs');
const path = require('node:path');
const { createBalldontlieProvider } = require('./balldontlieProvider');
const { createDemoProvider } = require('./demoProvider');

function loadLocalEnv(root = path.join(__dirname, '..')) {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function createProvider() {
  loadLocalEnv();

  const providerName = (process.env.NBA_DATA_PROVIDER || 'demo').toLowerCase();
  if (providerName === 'balldontlie' || providerName === 'bdl') {
    return createBalldontlieProvider();
  }

  return createDemoProvider();
}

module.exports = { createProvider, loadLocalEnv };
