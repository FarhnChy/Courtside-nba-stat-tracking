const teams = {
  BOS: { code: 'BOS', name: 'Celtics', city: 'Boston', conference: 'East', color: '#087a52' },
  NYK: { code: 'NYK', name: 'Knicks', city: 'New York', conference: 'East', color: '#f58426' },
  CLE: { code: 'CLE', name: 'Cavaliers', city: 'Cleveland', conference: 'East', color: '#7b1636' },
  MIL: { code: 'MIL', name: 'Bucks', city: 'Milwaukee', conference: 'East', color: '#1d684b' },
  OKC: { code: 'OKC', name: 'Thunder', city: 'Oklahoma City', conference: 'West', color: '#1677c8' },
  DEN: { code: 'DEN', name: 'Nuggets', city: 'Denver', conference: 'West', color: '#fdb827' },
  LAL: { code: 'LAL', name: 'Lakers', city: 'Los Angeles', conference: 'West', color: '#552583' },
  GSW: { code: 'GSW', name: 'Warriors', city: 'Golden State', conference: 'West', color: '#1d428a' },
  MIN: { code: 'MIN', name: 'Timberwolves', city: 'Minnesota', conference: 'West', color: '#0c2340' },
  PHX: { code: 'PHX', name: 'Suns', city: 'Phoenix', conference: 'West', color: '#e56020' },
  ORL: { code: 'ORL', name: 'Magic', city: 'Orlando', conference: 'East', color: '#178bd1' },
  PHI: { code: 'PHI', name: '76ers', city: 'Philadelphia', conference: 'East', color: '#d9283e' },
  ATL: { code: 'ATL', name: 'Hawks', city: 'Atlanta', conference: 'East', color: '#c8102e' },
  MIA: { code: 'MIA', name: 'Heat', city: 'Miami', conference: 'East', color: '#98002e' },
  IND: { code: 'IND', name: 'Pacers', city: 'Indiana', conference: 'East', color: '#002d62' },
  BKN: { code: 'BKN', name: 'Nets', city: 'Brooklyn', conference: 'East', color: '#111111' },
  CHA: { code: 'CHA', name: 'Hornets', city: 'Charlotte', conference: 'East', color: '#1d8cab' },
  CHI: { code: 'CHI', name: 'Bulls', city: 'Chicago', conference: 'East', color: '#ce1141' },
  DAL: { code: 'DAL', name: 'Mavericks', city: 'Dallas', conference: 'West', color: '#00538c' },
  DET: { code: 'DET', name: 'Pistons', city: 'Detroit', conference: 'East', color: '#1d42ba' },
  HOU: { code: 'HOU', name: 'Rockets', city: 'Houston', conference: 'West', color: '#ce1141' },
  LAC: { code: 'LAC', name: 'Clippers', city: 'LA', conference: 'West', color: '#c8102e' },
  MEM: { code: 'MEM', name: 'Grizzlies', city: 'Memphis', conference: 'West', color: '#5d76a9' },
  NOP: { code: 'NOP', name: 'Pelicans', city: 'New Orleans', conference: 'West', color: '#85714d' },
  POR: { code: 'POR', name: 'Trail Blazers', city: 'Portland', conference: 'West', color: '#e03a3e' },
  SAC: { code: 'SAC', name: 'Kings', city: 'Sacramento', conference: 'West', color: '#5a2d81' },
  SAS: { code: 'SAS', name: 'Spurs', city: 'San Antonio', conference: 'West', color: '#8a8d8f' },
  TOR: { code: 'TOR', name: 'Raptors', city: 'Toronto', conference: 'East', color: '#ce1141' },
  UTA: { code: 'UTA', name: 'Jazz', city: 'Utah', conference: 'West', color: '#002b5c' },
  WAS: { code: 'WAS', name: 'Wizards', city: 'Washington', conference: 'East', color: '#002b5c' }
};

const games = [
  {
    id: 'game-bos-nyk',
    date: '2026-02-20',
    status: 'LIVE',
    period: 4,
    clock: '6:42',
    arena: 'Madison Square Garden',
    away: { team: 'BOS', score: 87, record: '44-16', winProbability: 61 },
    home: { team: 'NYK', score: 84, record: '38-22', winProbability: 39 },
    leaders: [
      { player: 'J. Tatum', team: 'BOS', position: 'SF', points: 31 },
      { player: 'J. Brunson', team: 'NYK', position: 'PG', points: 27 },
      { player: 'J. Brown', team: 'BOS', position: 'SG', points: 22 }
    ],
    injuries: [
      { player: 'M. Robinson', team: 'NYK', position: 'C', status: 'OUT' },
      { player: 'A. Horford', team: 'BOS', position: 'C', status: 'GTD' },
      { player: 'O. Anunoby', team: 'NYK', position: 'SF', status: 'ACTIVE' }
    ],
    shots: [
      { result: 'made', x: 18, y: 48 },
      { result: 'miss', x: 28, y: 20 },
      { result: 'made', x: 37, y: 67 },
      { result: 'miss', x: 48, y: 87 },
      { result: 'made', x: 55, y: 35 },
      { result: 'made', x: 64, y: 71 },
      { result: 'miss', x: 73, y: 17 },
      { result: 'made', x: 82, y: 50 },
      { result: 'miss', x: 89, y: 82 },
      { result: 'made', x: 43, y: 13 },
      { result: 'miss', x: 67, y: 43 },
      { result: 'made', x: 32, y: 81 }
    ],
    plays: [
      { clock: '6:42', player: 'J. Brunson', text: 'Driving layup made - 2 PTS' },
      { clock: '7:03', player: 'J. Tatum', text: '25-foot three missed' },
      { clock: '7:18', player: 'K. Porzingis', text: 'Defensive rebound' },
      { clock: '7:31', player: 'M. Bridges', text: 'Personal foul - 3rd' },
      { clock: '7:46', player: 'J. Brown', text: 'Pullup jumper made - 2 PTS' }
    ]
  },
  {
    id: 'game-den-okc',
    date: '2026-02-20',
    status: 'FINAL',
    period: 4,
    clock: '0:00',
    arena: 'Paycom Center',
    away: { team: 'DEN', score: 112, record: '40-21', winProbability: 0 },
    home: { team: 'OKC', score: 118, record: '48-12', winProbability: 100 },
    leaders: [],
    injuries: [],
    shots: [],
    plays: []
  },
  {
    id: 'game-lal-gsw',
    date: '2026-02-20',
    status: 'UPCOMING',
    period: null,
    clock: '10:00 PM',
    arena: 'Chase Center',
    away: { team: 'LAL', score: null, record: '36-24', winProbability: 46 },
    home: { team: 'GSW', score: null, record: '34-27', winProbability: 54 },
    leaders: [],
    injuries: [],
    shots: [],
    plays: []
  }
];

const players = [
  { id: 'player-tatum', firstName: 'Jayson', lastName: 'Tatum', displayName: 'J. Tatum', team: 'BOS', position: 'SF', jersey: '0' },
  { id: 'player-brown', firstName: 'Jaylen', lastName: 'Brown', displayName: 'J. Brown', team: 'BOS', position: 'SG', jersey: '7' },
  { id: 'player-porzingis', firstName: 'Kristaps', lastName: 'Porzingis', displayName: 'K. Porzingis', team: 'BOS', position: 'C', jersey: '8' },
  { id: 'player-brunson', firstName: 'Jalen', lastName: 'Brunson', displayName: 'J. Brunson', team: 'NYK', position: 'PG', jersey: '11' },
  { id: 'player-bridges', firstName: 'Mikal', lastName: 'Bridges', displayName: 'M. Bridges', team: 'NYK', position: 'SF', jersey: '25' },
  { id: 'player-robinson', firstName: 'Mitchell', lastName: 'Robinson', displayName: 'M. Robinson', team: 'NYK', position: 'C', jersey: '23' },
  { id: 'player-shai', firstName: 'Shai', lastName: 'Gilgeous-Alexander', displayName: 'S. Gilgeous-Alexander', team: 'OKC', position: 'PG', jersey: '2' },
  { id: 'player-jokic', firstName: 'Nikola', lastName: 'Jokic', displayName: 'N. Jokic', team: 'DEN', position: 'C', jersey: '15' },
  { id: 'player-giannis', firstName: 'Giannis', lastName: 'Antetokounmpo', displayName: 'G. Antetokounmpo', team: 'MIL', position: 'PF', jersey: '34' }
];

const standings = {
  East: [
    { team: 'CLE', wins: 49, losses: 11, pct: '.817', gb: '-', last10: '8-2' },
    { team: 'BOS', wins: 44, losses: 16, pct: '.733', gb: '5.0', last10: '7-3' },
    { team: 'NYK', wins: 38, losses: 22, pct: '.633', gb: '11.0', last10: '6-4' },
    { team: 'MIL', wins: 35, losses: 25, pct: '.583', gb: '14.0', last10: '7-3' },
    { team: 'ORL', wins: 33, losses: 28, pct: '.541', gb: '16.5', last10: '5-5' },
    { team: 'PHI', wins: 31, losses: 29, pct: '.517', gb: '18.0', last10: '6-4' }
  ],
  West: [
    { team: 'OKC', wins: 48, losses: 12, pct: '.800', gb: '-', last10: '9-1' },
    { team: 'DEN', wins: 40, losses: 21, pct: '.656', gb: '8.5', last10: '7-3' },
    { team: 'MIN', wins: 39, losses: 22, pct: '.639', gb: '9.5', last10: '6-4' },
    { team: 'LAL', wins: 36, losses: 24, pct: '.600', gb: '12.0', last10: '6-4' },
    { team: 'PHX', wins: 35, losses: 25, pct: '.583', gb: '13.0', last10: '5-5' },
    { team: 'GSW', wins: 34, losses: 27, pct: '.557', gb: '14.5', last10: '6-4' }
  ]
};

const predictions = {
  simulations: 10000,
  modelVersion: 'demo-0.2',
  bracket: {
    firstRound: [
      { favorite: '1 CLE', favoriteOdds: 91, underdog: '8 ATL', underdogOdds: 9 },
      { favorite: '4 MIL', favoriteOdds: 66, underdog: '5 ORL', underdogOdds: 34 },
      { favorite: '2 BOS', favoriteOdds: 88, underdog: '7 MIA', underdogOdds: 12 },
      { favorite: '3 NYK', favoriteOdds: 71, underdog: '6 IND', underdogOdds: 29 }
    ],
    semifinals: [
      { favorite: '1 CLE', favoriteOdds: 57, underdog: '4 MIL', underdogOdds: 43 },
      { favorite: '2 BOS', favoriteOdds: 72, underdog: '3 NYK', underdogOdds: 28 }
    ],
    conferenceFinal: [
      { favorite: '2 BOS', favoriteOdds: 58, underdog: '1 CLE', underdogOdds: 42 }
    ],
    finals: [
      { favorite: 'BOS', favoriteOdds: 54, underdog: 'OKC', underdogOdds: 46 }
    ]
  },
  modelFactors: [
    { label: 'Net rating', value: 86 },
    { label: 'Recent form', value: 73 },
    { label: 'Schedule strength', value: 61 },
    { label: 'Rest and travel', value: 48 },
    { label: 'Injury health', value: 76 }
  ],
  titleFavorite: { team: 'BOS', odds: '24.8%' }
};

const futures = [
  { market: 'NBA champion', entries: [{ team: 'BOS', value: '24.8%' }, { team: 'OKC', value: '22.1%' }, { team: 'CLE', value: '15.6%' }, { team: 'DEN', value: '12.4%' }] },
  { market: 'MVP award', entries: [{ team: 'OKC', value: 'S. Gilgeous-Alexander' }, { team: 'DEN', value: 'N. Jokic' }, { team: 'MIL', value: 'G. Antetokounmpo' }, { team: 'BOS', value: 'J. Tatum' }] },
  { market: 'No. 1 seed', entries: [{ team: 'CLE', value: 'East - 78%' }, { team: 'OKC', value: 'West - 84%' }, { team: 'BOS', value: 'East - 19%' }, { team: 'DEN', value: 'West - 11%' }] }
];

const transactions = [
  {
    id: 'reported-den-demar-derozan-2026-08-21',
    date: '2026-08-21T22:54:03Z',
    team: 'DEN',
    player: 'DeMar DeRozan',
    type: 'Signing',
    category: 'Transaction',
    text: 'DeMar DeRozan agreed to a one-year, $3.9 million deal with Denver.',
    source: 'ESPN / Shams Charania',
    sourceUrl: 'https://www.espn.com/nba/story/_/id/49684447/nuggets-signing-6-all-star-demar-derozan-1-year-deal',
    verifiedAt: '2026-08-21T23:05:00.000Z'
  },
  {
    id: 'reported-mia-klay-thompson-2026-08-21',
    date: '2026-08-21T23:57:38Z',
    team: 'MIA',
    player: 'Klay Thompson',
    type: 'Signing',
    category: 'Transaction',
    text: 'Klay Thompson plans to sign a two-year, nearly $13 million deal with Miami after clearing waivers.',
    source: 'ESPN / Shams Charania',
    sourceUrl: 'https://www.espn.com/nba/story/_/id/49683637/mavs-buy-klay-thompson-deal-heat-move-deck-sources-say',
    verifiedAt: '2026-08-21T23:58:00.000Z'
  },
  {
    id: 'reported-cle-peyton-watson-2026-08-20',
    date: '2026-08-20T10:35:44Z',
    team: 'CLE',
    player: 'Peyton Watson',
    type: 'Trade',
    category: 'Transaction',
    text: 'Cleveland agreed to acquire Peyton Watson from Denver in a multiteam deal with LA.',
    source: 'ESPN / Shams Charania',
    sourceUrl: 'https://www.espn.com/nba/story/_/id/49664656/peyton-watson-cavaliers-max-strus-clippers-part-multi-team-trade-nuggets',
    verifiedAt: '2026-08-21T20:00:00.000Z'
  },
  {
    id: 'reported-lac-max-strus-2026-08-20',
    date: '2026-08-20T10:35:44Z',
    team: 'LAC',
    player: 'Max Strus',
    type: 'Trade',
    category: 'Transaction',
    text: 'LA Clippers agreed to acquire Max Strus in the multiteam Peyton Watson trade.',
    source: 'ESPN / Shams Charania',
    sourceUrl: 'https://www.espn.com/nba/story/_/id/49664656/peyton-watson-cavaliers-max-strus-clippers-part-multi-team-trade-nuggets',
    verifiedAt: '2026-08-21T20:00:00.000Z'
  },
  {
    id: 'reported-cle-james-harden-2026-08-20',
    date: '2026-08-20T23:15:42Z',
    team: 'CLE',
    player: 'James Harden',
    type: 'Re-signing',
    category: 'Transaction',
    text: 'James Harden agreed to a three-year, $97 million contract to remain with Cleveland.',
    source: 'ESPN / Shams Charania',
    sourceUrl: 'https://www.espn.com/nba/story/_/id/49671792/james-harden-agrees-3-year-97m-deal-remain-cavaliers',
    verifiedAt: '2026-08-21T20:00:00.000Z'
  },
  {
    id: 'reported-nop-trendon-watford-2026-08-17',
    date: '2026-08-17T13:45:14Z',
    team: 'NOP',
    player: 'Trendon Watford',
    type: 'Signing',
    category: 'Transaction',
    text: 'Trendon Watford agreed to a one-year, $2.9 million deal with New Orleans.',
    source: 'ESPN / Shams Charania',
    sourceUrl: 'https://www.espn.com/nba/story/_/id/49638189/trendon-watford-pelicans-agree-1-year-29m-deal',
    verifiedAt: '2026-08-21T20:00:00.000Z'
  },
  {
    id: 'reported-cha-dennis-schroder-2026-08-15',
    date: '2026-08-15T12:00Z',
    team: 'CHA',
    player: 'Dennis Schroder',
    type: 'Trade',
    category: 'Transaction',
    text: 'Charlotte agreed to acquire Dennis Schroder and cash from Cleveland for Tre Mann.',
    source: 'Reported offseason update',
    sourceUrl: 'https://www.blazersedge.com/nba-news-rumors/115163/nba-free-agency-news-bradley-beal-signs-los-angeles-clippers-cleveland-cavaliers-trade-dennis-schroder',
    verifiedAt: '2026-08-15T12:00:00.000Z'
  },
  {
    id: 'reported-cle-tre-mann-2026-08-15',
    date: '2026-08-15T12:00Z',
    team: 'CLE',
    player: 'Tre Mann',
    type: 'Trade',
    category: 'Transaction',
    text: 'Cleveland agreed to acquire Tre Mann from Charlotte for Dennis Schroder and cash.',
    source: 'Reported offseason update',
    sourceUrl: 'https://www.blazersedge.com/nba-news-rumors/115163/nba-free-agency-news-bradley-beal-signs-los-angeles-clippers-cleveland-cavaliers-trade-dennis-schroder',
    verifiedAt: '2026-08-15T12:00:00.000Z'
  },
  {
    id: 'reported-lac-bradley-beal-2026-08-14',
    date: '2026-08-14T20:46Z',
    team: 'LAC',
    player: 'Bradley Beal',
    type: 'Re-signing',
    category: 'Transaction',
    text: 'Bradley Beal agreed to return to the LA Clippers on a two-year, $13.2 million contract.',
    source: 'Reported offseason update',
    sourceUrl: 'https://www.blazersedge.com/nba-news-rumors/115163/nba-free-agency-news-bradley-beal-signs-los-angeles-clippers-cleveland-cavaliers-trade-dennis-schroder',
    verifiedAt: '2026-08-15T12:00:00.000Z'
  },
  {
    id: 'fa-den-spencer-jones-2026-07-27',
    date: '2026-07-31T07:00Z',
    team: 'DEN',
    player: 'Spencer Jones',
    type: 'Signing',
    category: 'Transaction',
    text: 'Signed F Spencer Jones to a contract.',
    source: 'ESPN',
    sourceUrl: 'https://www.espn.com/nba/team/transactions/_/name/den/denver-nuggets',
    verifiedAt: '2026-08-06T12:00:00.000Z'
  },
  {
    id: 'fa-den-tyus-jones-2026',
    date: '2026-07-14T07:00Z',
    team: 'DEN',
    player: 'Tyus Jones',
    type: 'Re-signing',
    category: 'Transaction',
    text: 'Re-signed G Tyus Jones to a contract.',
    source: 'ESPN',
    sourceUrl: 'https://www.espn.com/nba/team/transactions/_/name/den/denver-nuggets'
  }
];

module.exports = {
  meta: {
    source: 'demo',
    provider: 'Courtside demo provider',
    generatedAt: '2026-08-21T20:00:00.000Z',
    dataQuality: 'demo-only'
  },
  teams,
  players,
  games,
  standings,
  predictions,
  futures,
  transactions
};
