const injuries = [
  {
    id: 'injury-robinson-demo',
    player: 'M. Robinson',
    team: 'NYK',
    position: 'C',
    status: 'OUT',
    detail: 'Demo availability note',
    source: 'manual-demo',
    updatedAt: '2026-02-20T18:00:00.000Z'
  },
  {
    id: 'injury-horford-demo',
    player: 'A. Horford',
    team: 'BOS',
    position: 'C',
    status: 'GTD',
    detail: 'Demo availability note',
    source: 'manual-demo',
    updatedAt: '2026-02-20T18:00:00.000Z'
  },
  {
    id: 'injury-anunoby-demo',
    player: 'O. Anunoby',
    team: 'NYK',
    position: 'SF',
    status: 'ACTIVE',
    detail: 'Demo availability note',
    source: 'manual-demo',
    updatedAt: '2026-02-20T18:00:00.000Z'
  }
];

const sectionAvailability = {
  free: {
    games: 'real-provider',
    teams: 'real-provider',
    players: 'real-provider',
    standings: 'demo-fallback',
    injuries: 'manual-or-paid-provider',
    leaders: 'demo-or-paid-provider',
    boxScores: 'paid-provider',
    plays: 'paid-provider',
    shotCharts: 'paid-tracking-provider',
    predictions: 'local-model-or-demo'
  }
};

module.exports = { injuries, sectionAvailability };
