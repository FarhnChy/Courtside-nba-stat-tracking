const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');

async function run() {
  const pending = [], installed = [], status = {};
  const context = vm.createContext({
    document: { querySelector: () => status },
    live: { date: 'first' }, isoDate: value => value,
    fetchApi: () => new Promise(resolve => pending.push(resolve)),
    installLiveGames: payload => installed.push(payload.season),
  });
  vm.runInContext(source.slice(source.indexOf('let scoreboardRequest ='), source.indexOf('function summaryTabs')), context);
  const first = context.loadScoreboard();
  context.live.date = 'second';
  const second = context.loadScoreboard();
  const response = (season, stale = false) => ({ ok:true, json:async () => ({ season }), headers:{ get:() => stale ? 'stale' : null } });
  pending[1](response('second')); await second;
  pending[0](response('first')); await first;
  assert.deepEqual(installed, ['second'], 'a late date response must not overwrite the current scoreboard');
  const cached = context.loadScoreboard(); pending[2](response('saved', true)); await cached;
  assert.match(status.textContent, /Offline.*saved scores/, 'cached scores must be labeled offline');

  vm.runInContext(source.slice(source.indexOf('const teamLogoPath ='), source.indexOf('const logo=')), context);
  for (const code of 'ATL BOS BKN CHA CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX POR SAC SAS TOR UTA WAS NO NY GS SA UTAH WSH PHO'.split(' ')) {
    const file = vm.runInContext(`teamLogoPath('${code}')`, context);
    const bytes = fs.readFileSync(path.join(__dirname, '../public', file));
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG', `${code} has a bundled logo`);
  }
  console.log('✓ Score request ordering, offline labels, and all team logos verified');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
