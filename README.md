# Courtside

Courtside is a responsive NBA game center and roster-economics dashboard. It combines live scores and full game details with standings, rosters, injuries, transactions, contracts, free agency, and salary-cap context in one original interface.

[Live website](https://courtside-nba.onrender.com) · Demo video coming soon

![Courtside desktop dashboard](docs/screenshots/layout-desktop.png)

## Current features

- Daily NBA scoreboard with 20-second live refresh and offline fallback
- Full player box scores, team statistics, period scoring, and play-by-play
- East and West standings with playoff and play-in indicators
- All 30 teams, searchable rosters, coaches, and injury availability
- Clickable player profiles with headshots, season statistics, honors, and news
- Recent transactions with team and move-type filters
- Official cap thresholds, payroll rankings, and multi-year contracts
- Player/team contract options, free agents, and projected cap holds
- Shareable screen routes, responsive navigation, and keyboard interaction

The prediction, futures, shot-chart, and win-probability surfaces currently demonstrate the intended product experience. Calibrated historical models and live shot-coordinate animation are roadmap work and are not presented as production forecasts.

## Architecture

```text
Browser UI
   |
   v
Node HTTP server  --> short-lived normalized cache
   |
   +--> ESPN site feeds: games, standings, teams, players, injuries, moves
   +--> NBA sources: free agency and official cap thresholds
   +--> Basketball Reference / SalarySwish: contracts and cap holds
```

The browser consumes only Courtside's stable local JSON shapes. Provider-specific parsing, validation, and caching remain on the server so upstream response changes do not spread through the interface.

## Run locally

Requires Node.js 18 or newer.

```powershell
npm.cmd install
npm.cmd run dev
```

Open [http://localhost:3000](http://localhost:3000).

```powershell
npm.cmd test
```

The test suite checks the app shell, provider normalization, finance invariants, HTTP validation, security headers, and static serving.

## API routes

- `GET /api/scoreboard?date=YYYY-MM-DD`
- `GET /api/games/:eventId`
- `GET /api/standings`
- `GET /api/teams`
- `GET /api/teams/:teamId/roster`
- `GET /api/players/:playerId`
- `GET /api/injuries`
- `GET /api/transactions`
- `GET /api/free-agents`
- `GET /api/finance/cap`
- `GET /api/finance/payrolls`
- `GET /api/finance/teams/:abbr/contracts`
- `GET /api/finance/teams/:abbr/cap-holds`
- `GET /api/health`

## Data references

- [hoopR](https://github.com/sportsdataverse/hoopR) informed the ESPN adapter structure.
- [NBA Communications](https://pr.nba.com/) supplies official salary-cap thresholds.
- [NBA Free Agent Tracker](https://www.nba.com/players/free-agent-tracker) supplies free-agent status and movement data.
- [Basketball Reference contracts](https://www.basketball-reference.com/contracts/) supplies cached payroll and contract summaries.
- [SalarySwish](https://www.salaryswish.com/) supplies projected cap holds.
- [nba_data](https://github.com/llimllib/nba_data) and [awesome-nba-data](https://github.com/JovaniPink/awesome-nba-data) are being evaluated for historical modeling inputs.

The ESPN site endpoints used by this prototype are unofficial and may change. Financial figures can also change during the offseason, so relevant screens expose source and retrieval context.

## Deployment

Live site: [https://courtside-nba.onrender.com](https://courtside-nba.onrender.com)

The repository includes a Render blueprint, health endpoint, and GitHub Actions test workflow. Deploy the Node service with `npm start`; Render can read `render.yaml` directly.

## Roadmap

1. Public deployment and cross-device release testing
2. Expanded player and team detail pages
3. Focused Fantasy Lab with configurable scoring and saved lineups
4. Backtested playoff and championship probability models
5. Live win probability and shot-by-shot animation

## Disclaimer

Courtside is an independent educational portfolio project and is not affiliated with or endorsed by ESPN or the NBA. Provider terms and data licenses should be reviewed before any commercial distribution.
