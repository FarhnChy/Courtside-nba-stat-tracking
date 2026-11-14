# Understanding Courtside

Courtside combines an NBA dashboard and a private fantasy basketball game. It uses JavaScript in the browser and on a Node.js server. There is no frontend framework, build pipeline, or third-party npm dependency.

## A description you can say out loud

“Courtside is a full-stack NBA dashboard with private fantasy leagues. The browser displays scores, player information, and league controls. A Node.js API retrieves basketball data, converts it into consistent objects, and applies fantasy rules. League state lives in local JSON files during local development or in shared Redis storage when hosted. Background jobs update scores and process draft deadlines and waivers even when nobody is browsing.”

If asked what makes it an analysis platform today, be precise: it has player histories and basic comparisons, but projections, statistical rankings, and personalized roster recommendations are future work.

## The repository layout

| Path | What belongs here |
| --- | --- |
| `public/index.html` | NBA dashboard page structure: navigation, panels, tables, dialogs. |
| `public/app.js` | Dashboard interactions, API calls, rendering, routing between views, and local preferences. |
| `public/features.js` | Favorite-team feed, news timeline, and browser notifications. |
| `public/pinned-score.js` | Independent pinned-game polling and optional desktop floating window. |
| `public/fantasy.html`, `public/fantasy.js` | Fantasy forms, draft room, roster management, and league polling. |
| `public/*.css`, `public/team-logos/` | Presentation and local image assets. |
| `server.js` | HTTP entry point, API routes, public file serving, and service composition. |
| `lib/espn.js` | ESPN fetching, caching, validation, and conversion into Courtside objects. |
| `lib/finance.js` | Salary/contract/free-agent page parsing and roster reconciliation. |
| `lib/nba-moves.js` | Official transaction and team-announcement collection, deduplication, and archive. |
| `lib/fantasy-api.js` | Fantasy HTTP authentication, request validation, rate limits, and response handling. |
| `lib/fantasy.js` | League creation/joining, drafts, daily lineups, scoring, standings, and public league views. |
| `lib/fantasy-rules.js` | Timed picks, queues, waivers, trades, IR, and playoffs. |
| `lib/fantasy-store.js` | Reads and atomic updates through local files or Upstash REST. |
| `lib/background-jobs.js` | Shared worker lease, league discovery, bounded refresh batches, news snapshots. |
| `data/` | Demo fixtures and curated snapshots; these are not the fantasy database. |
| `providers/` | An older provider abstraction. The current server calls `lib/espn.js` directly. |
| `api/index.js`, `vercel.json` | Reuse the HTTP handler in Vercel's Node Function and route requests to it. |
| `.github/workflows/` | Automated tests and the configurable background refresh schedule. |
| `test/` | Deterministic domain, HTTP, adapter, browser-behavior, and regression checks. |

## Follow one score request

1. The dashboard requests `/api/scoreboard?date=2026-11-13`.
2. `server.js` matches that URL and calls `espn.scoreboard(date)`.
3. `lib/espn.js` uses a recent cache entry or fetches upstream JSON.
4. It normalizes the response. For example, nested ESPN competitor data becomes a game with `away`, `home`, and `status` fields.
5. The server returns JSON. The browser updates its game state and renders the cards.
6. A later poll repeats the process. Request counters prevent older scoreboard responses from overwriting a newer date selection.

An API is the contract between the browser and server. Normalization means converting an external source's shape into your own predictable shape. A cache temporarily reuses data to reduce upstream requests.

The browser does not need to understand ESPN's complete response structure. That knowledge stays in the adapter.

## Follow one fantasy draft pick

1. A manager clicks Draft. The browser sends a JSON action and its private key in the Authorization header.
2. `fantasy-api.js` validates the request and calls the domain engine.
3. `fantasy.js` checks membership, whose turn it is, the expected pick number, and whether the player is still available.
4. The store updates the league document atomically.
5. The pick is recorded, the roster changes, and the next manager's turn begins.
6. Other browsers receive the new state through polling.

Atomic means a change commits as one unit. In Redis, compare-and-set means “save this only if the document still equals the version I read.” If another manager changed it first, the engine retries against the newer version. This prevents simultaneous picks from overwriting one another.

Local files use a queue and temporary-file replacement. That mode assumes one Node process. Shared hosted instances must use Redis.

## How scoring works

The browser cannot submit fantasy scores. It only asks the server to refresh them.

The engine requests a day's scoreboard with verification enabled. The primary ESPN feed and ESPN's CDN representation must agree on the requested date and game IDs. An unconfirmed empty feed cannot finalize a zero-point day. This is a consistency check between two ESPN representations, not a guarantee against every possible upstream omission.

For each started game, the engine reads its box score, checks for both teams, and requires a final summary before accepting a completed game. It calculates:

`PTS + 1.2 × REB + 1.5 × AST + 3 × STL + 3 × BLK − TO`

It applies those player points to the lineup recorded for that date. Roster changes affect future lineups, so dropping someone cannot rewrite yesterday's scoring. Retrying a scoring refresh replaces the day's total instead of adding it again.

Failures retain previous totals. Expired server-cache responses are rejected; they are not silently treated as current data. Dashboard browser-cache fallbacks remain available with offline labeling.

Important limits: scoring catches up in bounded batches; the latest two dates are revisited for corrections; older completed dates are not systematically re-audited. Finalized playoff results remain locked.

## Identity and access

NBA and ESPN assign different numeric IDs to the same player. A number is meaningful only within its provider. Free-agent records keep their NBA ID and a separately resolved ESPN ID. Profiles use the ESPN ID only when resolved; otherwise the UI shows available tracker statistics.

Fantasy leagues use ESPN player IDs throughout drafting and scoring.

Managers have private recovery keys rather than email/password accounts. The browser saves the key locally; the server stores its hash. The invite code allows joining an open league. It does not control an existing team. The private recovery key does control that team and must stay private.

## Local versus hosted operation

Locally, `node server.js` serves the pages and APIs and starts a one-minute worker. Fantasy documents live in `.fantasy-data/`, and move history lives in `.tracker-data/`. Both directories are ignored by Git.

On Vercel, static assets are served separately and API requests enter `api/index.js`, which exports the same server handler. Upstash supplies durable shared storage. A configured GitHub Actions workflow calls the authenticated refresh endpoint. Without that scheduler, visitors drive hosted refreshes.

Environment settings must be supplied to the running process. The current server does not automatically load `.env` through the older provider factory.

## What to say about engineering decisions

- “I kept the stack small: vanilla browser code and Node built-ins. That makes deployment simple, but it means I maintain routing and validation myself.”
- “I separate HTTP handling, basketball adapters, fantasy rules, and storage so the scoring rules can be tested with fixtures.”
- “Polling keeps the implementation straightforward. It trades instant updates for periodic requests.”
- “I use immutable daily lineup history so current roster moves cannot alter past scoring.”
- “I use atomic storage updates to prevent concurrent actions from losing data.”
- “The next major step is persisted player game logs and schedule-aware rankings, so managers can make better decisions.”

## A useful reading order

Start with `public/fantasy.html` to see the interface, then follow an action in `public/fantasy.js`. Read its route in `lib/fantasy-api.js`, the rule in `lib/fantasy.js`, and the write in `lib/fantasy-store.js`. Finally, read the corresponding test in `test/fantasy.js`.

For NBA data, follow `loadScoreboard()` in `public/app.js` into the `/api/scoreboard` route in `server.js`, then into `scoreboard()` and `normalizeEvent()` in `lib/espn.js`.

Before explaining any feature, answer four questions: What does the user do? Which API receives it? Which module applies the rule? Where does the result live?
