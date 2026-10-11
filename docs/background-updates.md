# Background updates on Vercel Hobby

The code is ready for hosted updates, but storage and scheduling must be configured before the live site can run leagues with friends. Never put secret values in Git or browser code.

## Production setup

1. Create an Upstash Redis database with eviction disabled. In Vercel → project → Settings → Environment Variables, add `UPSTASH_REDIS_REST_URL` and the read/write `UPSTASH_REDIS_REST_TOKEN` for Production. Use a separate database for previews.
2. Generate a random secret (for example `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`). Save it as `CRON_SECRET` in Vercel's Production environment.
3. In GitHub → repository → Settings → Secrets and variables → Actions, add that same value as a repository **secret** named `CRON_SECRET`. Add a repository **variable** named `COURTSIDE_BASE_URL` with the production HTTPS origin, such as `https://your-project.vercel.app`. Use the final origin to avoid redirects. The endpoint must be reachable by the workflow; do not point it at a protected preview.
4. Push the code to the default branch and redeploy Vercel so the environment changes apply. Keep Fluid Compute enabled; the API function permits up to 300 seconds. Confirm `/api/fantasy/config` reports `available: true` and `storage: "hosted"`.
5. In GitHub → Actions → **Background refresh**, run the workflow manually. Confirm it says **Courtside background refresh completed**, not **skipped**. Then create a test league in two separate browsers and verify shared drafting and roster changes.

The workflow runs approximately every five minutes, even with no visitors. It skips safely when configuration is absent. No deployment or secret configuration is performed by the code itself.

Vercel Hobby's native cron jobs are limited to once daily, so this repository uses GitHub Actions for the frequent calls. GitHub schedules can be delayed or dropped under load, and scheduled workflows in public repositories are disabled after 60 days without repository activity. This is not a precise real-time scheduler. While a league is open, browser polling advances overdue picks about every five seconds. With everyone away, stored deadlines are processed at the next job; multiple overdue picks can complete together. For reliable second-level draft timing without viewers, use an always-running server or a dedicated scheduler.

References: [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), [function duration](https://vercel.com/docs/functions/configuring-functions/duration), [GitHub scheduled events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

## What a job does

`GET` or `POST /api/jobs/refresh` requires `Authorization: Bearer <CRON_SECRET>`. Missing configuration fails closed. Requests never return private team keys or league rosters. A durable lease prevents overlapping workers; league mutations remain atomic if a worker is retried.

- Discovers existing league documents, including leagues created before the registry existed, and records new leagues automatically.
- Processes up to ten leagues per run, rotating through larger registries. Advances stored draft deadlines, resolves expired waiver holds, expires offers, catches up scores, and progresses playoffs.
- Collects official NBA/team move announcements and retains them in the shared tracker archive. Source failures do not erase earlier announcements.
- Saves an ESPN news snapshot every five minutes. The news API can return that snapshot with `stale: true` and its timestamp if the live feed fails.

Fantasy refreshes catch up in bounded batches. Large outages or more than ten leagues may require multiple runs. Timers use stored UTC deadlines, while lineup eligibility and scoring days use New York time. A dropped player awarded by a late waiver job becomes eligible the day after processing; historical lineups never change retroactively.

The shared `jobs-state` document records the last run, errors, registry count, and cursor for operational inspection in Upstash. An HTTP 502 means a source or league failed and the workflow should be investigated; successful portions remain saved. Database failures return 503. Never expose this document or database credentials publicly.

## Local server

`npm run dev` starts a one-minute worker alongside the Node server. It stops when the server closes. Local mode requires one running Node process and saves data in the ignored `.fantasy-data/` and `.tracker-data/` directories. No external scheduler or `CRON_SECRET` is needed for this internal worker. Calling the HTTP job endpoint still requires the secret.

`npm run jobs:refresh` is also available for an external runner with `COURTSIDE_BASE_URL` and `CRON_SECRET` set. The script requires HTTPS, rejects redirects, and does not log credentials.
