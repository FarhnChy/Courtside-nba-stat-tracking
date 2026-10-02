# Private Courtside fantasy leagues

Open `/fantasy.html` or click **Fantasy** on the NBA dashboard. Create a league, save your private recovery key, and share the invite link with friends. Every manager gets their own private key. The invite code grants permission to join an open league; it does not grant control over anyone else's team.

## Run locally

Run `npm run dev`. League documents are saved in `.fantasy-data/`, outside the public directory and excluded from Git. They survive server restarts. Use one Node process with this storage mode. Friends on the same network can visit the same server's LAN address and port, if allowed by the host firewall. A localhost URL on a friend's device refers to their own device, not yours.

## Host on Vercel

Vercel instances do not share a persistent filesystem. Fantasy intentionally refuses to create leagues there until shared storage is configured.

1. Create a durable Upstash Redis database with eviction disabled. Use a separate database for production and preview/testing.
2. Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to the Vercel project's server environment. Use the read/write database token; never place it in browser code or Git.
3. Optionally set `FANTASY_KEY_PREFIX` (default `courtside:fantasy:v1:`) to isolate environments further.
4. Deploy the application. `/api/fantasy/config` should return `{"available":true,"storage":"hosted"}`.
5. Create a league on the deployed URL, join from a second browser, and verify both managers see the same draft.

The adapter uses the [Upstash REST API](https://upstash.com/docs/redis/features/restapi) with atomic Lua compare-and-set writes. This keeps simultaneous picks and roster changes from overwriting each other across server instances. API responses containing league data are never CDN-cached. No new npm dependency is required.

Local shell environment variables must be set explicitly; the existing server does not automatically load `.env`. For Node versions supporting it, `node --env-file=.env server.js` can load a local file. The URL and token must both be present to select hosted storage.

Local leagues are not automatically migrated into hosted storage. Start the actual friend league on its intended permanent deployment. Back up your league database; losing it also loses teams, history, and key hashes.

## Rules

- 2–12 managers, 2–15 roster spots, up to 10 utility starters, and 1–26 matchups. The create screen offers common presets. Settings lock once the league is created.
- Commissioner can start when at least two managers join, even if capacity is not reached. Membership locks when drafting starts.
- Draft order is randomized once and reverses each round. No pick timer. Managers pick on their turn; the commissioner can make an automatic pick for the current team. **Automatic picks use alphabetical order, not rankings.** Draft picks are persisted immediately.
- Scoring starts on the New York calendar day after the final draft pick. Each matchup is seven consecutive days from that start date. Opponents rotate round-robin; odd-sized leagues have byes. There are no playoff rounds yet.
- Points: PTS × 1 + REB × 1.2 + AST × 1.5 + STL × 3 + BLK × 3 − TO. No positional restrictions, category scoring, or games-played cap.
- The first drafted players fill the initial starting lineup. Managers can set the next day's lineup, which locks at midnight **America/New_York**, including daylight-saving changes. Lineups carry forward. Leaving every player unchecked intentionally benches the team.
- Adds/drops reserve ownership immediately, but lineup eligibility changes the following day. Today's locked lineup remains intact, even after a drop. A new player must be explicitly selected as a starter. Adds are first come, first served; there is no waiver queue, trading, injured-reserve slot, or transaction limit yet.
- ESPN NBA roster IDs are used consistently for the player pool and box scores. The pool is captured when the draft starts; new NBA signings after that are not automatically added to an existing league's player pool yet.
- Scoring covers NBA games returned for the league's dates, including preseason if a league starts then. Choose the draft date accordingly for a regular-season-only league.

## Scoring and freshness

The league screen checks shared state every five seconds while visible. It requests a scoring refresh approximately every minute while someone has the league open. The server fetches real ESPN box scores and calculates points; clients cannot submit scores. Requests reuse a one-minute server cache. There is no always-running job when every manager closes the page.

After time away, scoring catches up in batches of up to six unfinished days plus the latest two days. Multiple refresh cycles can be needed. Feed failures preserve the previous total and show an incomplete-data notice. Missing or delayed box scores do not finalize a matchup. Score updates replace prior totals, so retries do not double-count statistics. The two latest league dates are rechecked for corrections; older completed days are not automatically re-audited for late NBA corrections yet.

Standings count only fully completed seven-day matchups; unfinished weeks remain provisional. Standings use wins, then ties, then finalized points as the display ordering. Byes do not grant a win. After the configured weeks, no later games add season points.

## Access and recovery

There are no email/password accounts yet. Each team has a randomly generated private key. The server stores only its SHA-256 hash; the browser saves the key and league ID locally. **My recovery key** shows the full `leagueId.privateKey` value. Save it privately and enter it in **Recover team** on another device. Sharing that key grants control of the team. Clearing browser storage without saving the key loses access; there is no email reset or key rotation flow yet.

Private keys travel only in authorization headers, not invite URLs. Inputs are validated server-side, mutations check team/commissioner permissions, and daily lineup history prevents retroactive scoring changes. Request sizes and request rates are bounded. Use HTTPS for a public deployment.

## Validation

`npm test` includes fantasy tests covering separate-manager access, duplicate/concurrent picks, snake order, immutable daily lineups, ownership, weighted scoring, failed feeds, corrections, standings, persistence across restarts, request validation, and private response caching rules. Tests use deterministic NBA fixtures and isolated temporary league data; they do not modify real leagues.

Optional: `node test/fantasy-browser.js` runs a real headless Edge flow using separate browser contexts for two managers and a third recovery session. It requires Node 22+ and Microsoft Edge on Windows; set `BROWSER_PATH` for another Chromium executable. It uses temporary fixture leagues, validates mobile width, and saves screenshots in the Git-ignored `.visual-profile-fantasy/` directory. The hosted adapter's conflict handling is tested with a mocked REST transport; a real hosted database still needs deployment verification.
