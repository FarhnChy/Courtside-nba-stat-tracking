# Courtside build plan

## Phase 1 — real data foundation

- [ ] Choose a licensed NBA data provider and document its terms, coverage, cost, and rate limits
- [ ] Move the frontend to TypeScript and React/Next.js
- [ ] Build a backend API with provider-independent adapters
- [ ] Define normalized teams, players, games, plays, shots, injuries, officials, and predictions
- [ ] Add PostgreSQL for durable game and historical data
- [ ] Replace demo data with schedules, scores, box scores, rosters, standings, injuries, and officials
- [x] Add a local/private ESPN public-endpoint provider for schedules, scores, rosters, standings, summaries, and transactions
- [ ] Add NBA.com stats integration for shot chart coordinates and deeper official stat surfaces
- [ ] Add loading, empty, delayed-game, offline, missing-data, and provider-error states
- [ ] Add unit, API-contract, accessibility, and end-to-end tests
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
- [ ] Build a trade scenario evaluator before attempting speculative trade-likelihood predictions
- [ ] Track model version, input time, calibration, drift, and historical performance

**Milestone:** Validated predictions with documented features, time-based testing, calibration metrics, and honest uncertainty.

## Phase 4 — production quality

- [ ] Add accounts, favorite teams, notifications, and saved brackets
- [ ] Add Redis caching and live-update fan-out where measurements justify it
- [ ] Secure sessions, validate external data, rate-limit APIs, and protect secrets
- [ ] Complete keyboard, screen-reader, contrast, and responsive accessibility audits
- [ ] Add CI checks for tests, formatting, accessibility, and production builds
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
