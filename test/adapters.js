const assert = require('node:assert/strict');
const espn = require('../lib/espn');
const finance = require('../lib/finance');

const event = espn.normalizeEvent({
  id: '123456789', date: '2026-01-01T00:00Z', status: { period: 2, displayClock: '4:20', type: { state: 'in', completed: false, shortDetail: 'Q2' } },
  competitions: [{ venue: { fullName: 'Test Arena' }, competitors: [
    { homeAway: 'away', score: '51', linescores: [{ value: 25 }, { value: 26 }], team: { id: '1', abbreviation: 'AWY', name: 'Away', location: 'Away City' } },
    { homeAway: 'home', score: '49', linescores: [{ value: 20 }, { value: 29 }], team: { id: '2', abbreviation: 'HME', name: 'Home', location: 'Home City' } }
  ] }]
});
assert.equal(event.away.score, 51);
assert.deepEqual(event.home.lineScores.map(period => period.value), [20, 29]);
assert.equal(event.status.state, 'in');

const summary = espn.normalizeSummary({ boxscore: { players: [{ team: { id: '1', displayName: 'A Team' }, statistics: [{ labels: ['PTS'], athletes: [{ athlete: { id: '42', displayName: 'Test Player', jersey: '7', headshot: { href: 'https://example.com/player.png' } }, stats: ['21'] }] }] }] } });
const boxPlayer = summary.boxscore[0].sections[0].athletes[0];
assert.equal(boxPlayer.name, 'Test Player');
assert.equal(boxPlayer.headshot, 'https://example.com/player.png');
assert.equal(boxPlayer.jersey, '7');

const standings = espn.normalizeStandings({ season: { displayName: '2025-26' }, children: [{ name: 'Eastern Conference', standings: { entries: [{ team: { id: '1', abbreviation: 'AAA', displayName: 'A Team' }, stats: [
  { name: 'playoffSeed', value: 1 }, { name: 'wins', value: 60 }, { name: 'losses', value: 22 }, { name: 'winPercent', displayValue: '.732' }
] }] } }] });
assert.equal(standings.conferences[0].id, 'east');
assert.equal(standings.conferences[0].teams[0].wins, 60);

assert.equal(finance.capOverview('2026-27').secondApron, 221686000);
assert.throws(() => finance.capOverview('1900-01'), /Unsupported/);
console.log('✓ Provider normalization and finance invariants verified');
