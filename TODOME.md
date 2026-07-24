# Courtside build plan

## Phase 1 — real data foundation

- [ ] Choose a licensed NBA data provider and document its terms, coverage, cost, and rate limits
- [ ] Move the frontend to TypeScript and React/Next.js
- [x] Build the first backend API adapter for scores and game summaries
- [ ] Define normalized teams, players, games, plays, shots, injuries, officials, and predictions
- [ ] Add PostgreSQL for durable game and historical data
- [x] Expand the live schedules, scores, and full box-score slice to rosters, standings, and injuries
- [x] Add current league transactions with team and move-type filtering
- [x] Add verified contract, payroll, salary-cap, tax, and apron data
- [x] Add official free-agent status, projected cap holds, and player/team contract options
- [x] Polish roster and live box-score loading, accessibility, filtering, and error states
- [x] Add roster search, position filters, keyboard interaction, and player profile cards
- [x] Add loading, empty, offline, missing-data, and provider-error states
- [x] Add smoke, normalization, API validation, and server tests
- [ ] Add browser end-to-end and automated accessibility tests
- [ ] Deploy preview and production environments with secrets stored outside Git

**Milestone:** A deployed app showing real daily NBA schedules, scores, standings, rosters, and box scores through a documented backend API.

## Phase 2 — live game intelligence

- [ ] Stream play-by-play through WebSockets or Server-Sent Events
- [ ] Display the game clock, period, shot clock when available, and possession indicator
- [ ] Derive bonus state, timeouts, team fouls, technical fouls, and possession results
- [ ] Store shot location, result, shooter, period, score margin, and shot-clock time
- [ ] Display officials and continuously updated player availability
- [ ] Handle duplicate, missing, delayed, out-of-order, and corrected provider events
- [ ] Reconnect safely after feed interruptions and clearly mark stale data
- [ ] Replay recorded games in integration tests

**Milestone:** A live game center that remains accurate through reconnects and provider corrections.

## Phase 3 — prediction lab

- [ ] Calculate adjusted offensive rating, defensive rating, pace, opponent strength, rest, and travel
- [ ] Establish simple and transparent prediction baselines
- [ ] Train and calibrate a pregame win-probability model
- [ ] Train and calibrate a live model using score, clock, possession, team strength, and availability
- [ ] Explain important probability changes after each play
- [ ] Simulate games, playoff series, brackets, seeding, conference winners, and Finals odds
- [ ] Train shot-quality models when defender and tracking data are legally available
- [ ] Forecast MVP, Rookie of the Year, and other awards with transparent features
- [ ] Build a focused Fantasy Lab with configurable scoring, saved lineups, and schedule-aware projections
- [ ] Track model version, input time, calibration, drift, and historical performance

**Milestone:** Validated predictions with documented features, time-based testing, calibration metrics, and honest uncertainty.

## Phase 4 — production quality

- [ ] Add accounts, favorite teams, notifications, and saved brackets
- [ ] Add Redis caching and live-update fan-out where measurements justify it
- [ ] Secure sessions, validate external data, rate-limit APIs, and protect secrets
- [ ] Complete keyboard, screen-reader, contrast, and responsive accessibility audits
- [x] Add CI checks for the current automated test suite
- [ ] Expand CI with formatting, browser accessibility, and production deployment checks
- [ ] Monitor provider delay, stale games, duplicate events, API errors, and model drift
- [ ] Add a custom domain, analytics, privacy controls, backups, and recovery procedures
- [ ] Publish screenshots, an architecture diagram, a live demo, and versioned releases

**Milestone:** A secure, observable, accessible application that can support real users during popular games.

## Definition of done for every feature

- Uses licensed data and documents its source
- Works on mobile and with keyboard/screen-reader navigation
- Handles missing, delayed, stale, and incorrect data
- Includes proportional automated tests and monitoring
- Explains predictions and never presents probability as certainty
- Keeps provider keys and other secrets outside the repository
- Uses original branding and does not copy protected ESPN or NBA assets
