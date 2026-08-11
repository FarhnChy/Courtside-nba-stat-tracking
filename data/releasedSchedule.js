const source = 'NBA.com schedule/key dates and released national TV previews';
const sourceUrl = 'https://www.nba.com/schedule';
const verifiedAt = '2026-08-11T12:00:00.000Z';

module.exports = {
  source,
  sourceUrl,
  verifiedAt,
  games: [
    { date: '2026-10-20T15:00:00-04:00', away: 'BOS', home: 'DET', label: 'Opening Day' },
    { date: '2026-10-20T19:00:00-04:00', away: 'PHI', home: 'NYK', label: 'Opening Night' },
    { date: '2026-10-20T21:30:00-04:00', away: 'SAS', home: 'OKC', label: 'Opening Night' },
    { date: '2026-10-23T19:00:00-04:00', away: 'NYK', home: 'BOS', label: 'Opening Week' },
    { date: '2026-10-23T21:30:00-04:00', away: 'HOU', home: 'SAS', label: 'Opening Week - Austin' },
    { date: '2026-12-25T12:00:00-05:00', away: 'SAS', home: 'NYK', label: 'Christmas Day' },
    { date: '2026-12-25T14:30:00-05:00', away: 'MIA', home: 'BOS', label: 'Christmas Day' },
    { date: '2026-12-25T17:00:00-05:00', away: 'PHI', home: 'LAL', label: 'Christmas Day' },
    { date: '2026-12-25T20:00:00-05:00', away: 'OKC', home: 'MIN', label: 'Christmas Day' },
    { date: '2026-12-25T22:30:00-05:00', away: 'DEN', home: 'GSW', label: 'Christmas Day' },
    { date: '2027-01-14T15:00:00-05:00', away: 'NOP', home: 'SAS', label: 'NBA Paris Game' },
    { date: '2027-01-17T12:00:00-05:00', away: 'SAS', home: 'NOP', label: 'NBA Manchester Game' }
  ],
  events: [
    { date: '2026-10-30', label: 'Emirates NBA Cup group play tips off' },
    { date: '2026-11-07', label: 'NBA Mexico City Game - Nuggets vs. Pacers' },
    { date: '2026-12-11', label: 'Emirates NBA Cup Championship' },
    { date: '2027-02-19', label: 'NBA All-Star 2027 weekend begins' }
  ]
};
