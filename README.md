# Courtside

Courtside is an original NBA scores and analytics app inspired by modern sports apps. It combines game tracking with prediction tools in one responsive dashboard.

## Current status

This repo is currently a working demo/MVP foundation, not a production NBA data product.

Completed:

- Responsive static dashboard for scores, standings, game center, predictions, and futures
- Local Node server for the app shell
- Provider-shaped demo data module in `data/demoData.js`
- Switchable data provider layer in `providers/`
- Optional ESPN public-endpoint adapter for local/private real NBA scores, teams, rosters, standings, game summaries, and transactions
- Optional BALLDONTLIE adapter for free/basic teams and games data
- JSON API routes for health, bootstrap data, games, teams, players, standings, and predictions
- Frontend data loading, API error handling, and empty states for missing game detail
- Date selector that refetches games through the backend API
- Manual override layer for portfolio-safe fallback data such as demo injuries/status notes
- Smoke test that verifies the app shell and API routes

Still required for a real product:

- Licensed NBA data provider selection and integration
- Durable database, provider adapters, live updates, and data correction handling
- Real prediction models with calibration and historical validation
- Deployment, secrets management, accessibility audits, CI, monitoring, and production hardening

## Run

Requires Node.js 18+.

```powershell
npm.cmd run dev
```

Open [http://localhost:3000](http://localhost:3000).

Run checks with:

```powershell
npm.cmd test
```

## Data providers

Courtside supports provider selection through environment variables.

### Demo provider

The demo provider is the default and needs no API key.

```powershell
NBA_DATA_PROVIDER=demo
```

### BALLDONTLIE provider

BALLDONTLIE can be used immediately with a free API key for basic real NBA teams and games. The free tier does not include the deeper surfaces this app displays, such as full box scores, standings, injuries, leaders, play-by-play, and betting odds, so Courtside keeps demo fallback data for those sections.

Create a local `.env` file:

```powershell
NBA_DATA_PROVIDER=balldontlie
BALLDONTLIE_API_KEY=your_api_key_here
```

During the offseason or on dates without NBA games, you can request a specific date:

```powershell
NBA_DATA_DATE=2026-02-20
```

### ESPN provider

The ESPN provider uses public, undocumented ESPN endpoints and is intended for local/private project use. It needs no API key and currently maps scoreboard, teams, players from rosters, standings, game summaries, play-by-play when exposed, and transactions into the existing Courtside API shape. Shot charts and predictions still use demo fallback data until NBA.com stats integration is added.

```powershell
NBA_DATA_PROVIDER=espn
```

During the offseason, today may have no NBA games. The bootstrap route will fall forward to ESPN's default scoreboard so the app has something current to show, while explicit `/api/games?date=YYYY-MM-DD` calls still respect the requested date.

You can also call the API with a date query:

```text
/api/bootstrap?date=2026-02-20
/api/games?date=2026-02-20
```

## API

- `GET /api/health`
- `GET /api/bootstrap`
- `GET /api/games`
- `GET /api/games?date=YYYY-MM-DD`
- `GET /api/games/:id`
- `GET /api/teams`
- `GET /api/players`
- `GET /api/players?search=tatum`
- `GET /api/injuries`
- `GET /api/injuries?team=BOS`
- `GET /api/standings`
- `GET /api/predictions`
- `GET /api/transactions`
- `GET /api/coaches`

The current API uses demo data by default. A production version should replace demo-only sections with licensed provider adapters while preserving the frontend-facing data shape.

## Data strategy

The project should not scrape ESPN, NBA.com, or stream sites for a public portfolio repo. Instead:

- Teams, players, and games come from a supported API provider when configured.
- Paid-only data such as box scores, standings, injuries, leaders, and play-by-play stays behind provider adapters.
- Small demo/manual overrides live in `data/manualOverrides.js` so missing free-tier data is isolated and clearly labeled.
- A future paid provider can replace the manual/demo sections without changing the frontend API shape.

For portfolio review, the intended story is: Courtside uses provider adapters and demo fallback data. Free API data powers teams, players, and games; paid provider endpoints can be enabled later for box scores, standings, injuries, leaders, and play-by-play.

## Legal

This is an independent educational project, not affiliated with ESPN or the NBA. Do not reuse their branding, copyrighted visuals, or data without permission; confirm a data provider's license before publishing.
