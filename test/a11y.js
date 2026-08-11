const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');

for (const dialog of ['searchDialog', 'comparisonDialog', 'transactionDialog', 'userHubDialog', 'fantasyDialog', 'playerDialog']) {
  const pattern = new RegExp(`<dialog[^>]+id="${dialog}"[^>]+aria-labelledby="[^"]+"`);
  assert.match(html, pattern, `${dialog} should expose an accessible title`);
}

for (const id of ['calendarDate', 'teamPicker', 'scheduleStart', 'scheduleRange', 'scheduleTeam', 'scheduleStatus', 'profileImageInput', 'transactionTeam', 'transactionType', 'capSeason', 'freeAgentSearch']) {
  const pattern = new RegExp(`<(?:input|select)[^>]+id="${id}"[^>]+(?:aria-label|placeholder)=`);
  assert.match(html, pattern, `${id} should be labeled or clearly named`);
}

for (const id of ['searchButton', 'calendarButton', 'userHubButton', 'fantasyHubButton']) {
  const pattern = new RegExp(`<button[^>]+id="${id}"[^>]+aria-label="[^"]+"`);
  assert.match(html, pattern, `${id} should have an aria-label`);
}

assert.equal(html.includes('aria-live="polite"'), true, 'live status regions should announce updates politely');
assert.equal(appSource.includes('onkeydown'), true, 'interactive table rows should support keyboard activation');

console.log('✓ Static accessibility guardrails verified');
