# Roster move coverage

The tracker combines the NBA official player-movement feed, official announcements from all 30 teams, ESPN transactions and roster news, and existing curated fallbacks. It does not filter by player prominence or require players to appear in the free-agent tracker.

Sources:

- [NBA player transactions](https://www.nba.com/players/transactions), using the same public JSON feed as that page. Includes signings, waivers, waiver claims, trades, and contract conversions. Courtside loads the past 365 days from this feed.
- The NBA public team-content API: the latest 50 articles per team. Transaction announcements are retained; promotional stories and obvious speculation are excluded. Official team news pages provide a fallback if the content API fails.
- ESPN public transactions, with pagination instead of the former 100-row limit, plus recent ESPN roster-related news. Unknown/unmatched players no longer cause news rows to be dropped. News reports are not automatically confirmed by unrelated historical transactions.

The browser provides player/text search and team, move-type, and contract-type filters. Exhibit 9, Exhibit 10, training-camp, non-guaranteed, two-way, 10-day, and extension labels are shown when the source explicitly describes those terms. A camp contract is not presented as a guaranteed regular-season roster spot. Grouped source rows are preserved so matching one player cannot hide other players in the same transaction.

The main list renders 100 matching rows initially; **Show 100 more updates** reveals additional rows. Search operates on the full loaded set, not just the visible rows. Filters survive automatic refreshes. The moves screen checks for updates every minute while open and visible; official source results are cached for five minutes, with additional short API/CDN caching possible.

## Announcement history

Collected team announcements are saved under `.tracker-data/` for a single-process local server. On Vercel, the tracker uses the same `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` variables as fantasy, with a separate `moves:` key suffix. No team keys or fantasy league data are stored in the tracker archive. Without shared storage on Vercel, current sources still work, but collected announcements are not durably retained across instances.

The UI reports source check time, how many team feeds were successfully checked, any failed/stale feeds, and whether announcement history storage is available. It retains previously fetched source rows on temporary failures and labels incomplete coverage. Retrieved timestamps do not imply that upstream reporting is complete or instantaneous.

This is broad coverage of all move types, not a guarantee of every historical transaction. Team announcements published before collection began can fall outside the latest-50-article window. Upstream delays, unpublished transactions, and parsing changes can still create gaps. Background collection requires the running local server or the configured hosted scheduler.

## Verification

`npm test` includes fixtures for camp signings without free-agent matches, Brown/Wiseman-style announcements, two-ways, waivers, claims, conversions, grouped transactions, event deduplication, stable IDs, ESPN pagination, stale sources, archive retention, and browser filtering/search. The live integration check on October 2, 2026 reached all 30 team feeds and returned the Knicks' official Bruce Brown and James Wiseman Exhibit 9 announcements through `/api/transactions`.

## Background collection

The local server now collects moves with its background worker. Hosted collection runs when the authenticated refresh job is scheduled, including with no visitors. See [Vercel Hobby setup](background-updates.md). Shared Upstash storage is required to retain team announcements across hosted invocations.
