# Courtside

Courtside is a basketball website for following NBA games and managing a fantasy league. It brings injury reports, team schedules, scores, and roster information together so you can check how an NBA update might affect your fantasy decisions.

It is built with JavaScript, HTML, CSS, and Node.js. You can run it locally or deploy it to Vercel.

## Fantasy impact

The fantasy impact page lists players on the injury report. Each card shows the player's status, the reported injury details, and how many games their team has in the next seven days. Select **Explore possible replacements** to see available teammates listed at the same position.

For example, if a guard is ruled out, the card can help you find other guards on the same team and see how often they play that week. Those players are only starting points for research: Courtside does not currently know who will receive extra minutes, predict their production, or check whether they are available in your fantasy league. Check the team's rotation and your league before adding anyone.

![Fantasy impact board showing injury reports and upcoming schedules](docs/screenshots/fantasy-impact-updated.png)

## Fantasy leagues

Courtside has its own private fantasy leagues. A commissioner can create a league and share an invite with friends. Managers can draft players, set daily lineups, follow head-to-head matchups and standings, submit waiver claims, make one-for-one trades, use injured reserve, and play in a postseason.

Games are scored using NBA box-score statistics. Leagues are stored on the server, and a private recovery key lets a manager return to a team from another device. Courtside does not connect to an existing ESPN or Yahoo fantasy league. Hosting a league for other people requires shared server-side storage; see [fantasy setup and rules](docs/fantasy.md).

## NBA information

- **Scores and games:** See the daily scoreboard, box scores, team statistics, play-by-play, and recaps. You can pin a game so its score stays visible while you browse.
- **Schedule:** Filter games by date, team, or status and see listed TV and streaming broadcasts when the feed provides them.
- **Teams and players:** Browse standings, rosters, player profiles, injuries, and team news. Choose a favorite team to see its upcoming games and updates on the home page.
- **Moves and free agents:** Follow trades, signings, and other transactions, with links to their sources. Browse free agents, contracts, payrolls, and salary-cap information.
- **Race center:** See conference standings and a dated MVP ladder snapshot. The MVP order is an editorial ranking, not a prediction of who will win.

![Courtside free-agent tracker with player filters, availability, and season statistics](docs/screenshots/readme-desktop.webp)

*The free-agent tracker lets you filter players and compare available information.*

<details>
<summary>See schedule and moves tracker screenshots</summary>

![Courtside schedule](docs/screenshots/schedule.png)

![Courtside moves tracker](docs/screenshots/moves.png)

</details>

<details>
<summary>View the mobile layout</summary>

<img src="docs/screenshots/layout-mobile.png" alt="Courtside mobile layout" width="340">

</details>

## How the project works

The browser displays the pages in `public/` and requests information from the Node.js server. The server fetches basketball data from outside sources, converts it into the fields Courtside uses, and returns it to the browser. It also caches some responses and uses saved snapshots for parts of the site when a source is unavailable.

The scoreboard refreshes every 20 seconds. A pinned game refreshes separately, so it can keep following that game when you switch dates. Some preferences, such as theme and favorite team, are stored in your browser. Fantasy league data is stored on the server.

Scores and other NBA information primarily come from ESPN public feeds. Other pages use information from NBA.com, NBA Communications, Basketball Reference, and SalarySwish. These integrations are unofficial, and data can be delayed or unavailable. Sources and timestamps are shown where available.

Some prediction, shot-chart, and win-probability displays are demonstrations, not validated forecasts. The MVP ladder is a dated snapshot and does not update automatically. Desktop floating for pinned scores requires a browser that supports Document Picture-in-Picture and a secure connection or localhost.

## Run locally

For a guided explanation of the code and examples you can use to describe the project, read [Understanding Courtside](docs/architecture.md).

Requires Node.js 18 or newer.

```sh
git clone https://github.com/FarhnChy/Courtside-nba-stat-tracking.git
cd Courtside-nba-stat-tracking
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000). To run the checks:

```sh
npm test             # Run automated tests
npm run audit:data   # Check saved data snapshots for stale dates
```

On Windows PowerShell, use `npm.cmd` if script execution settings prevent `npm` from running.

## Project files and deployment

| Location | What it contains |
| --- | --- |
| `public/` | Website pages, styles, browser scripts, and images |
| `server.js` | Local HTTP server and API routes |
| `lib/` and `providers/` | Code for fetching and converting basketball data |
| `data/` | Saved data snapshots and roster information |
| `api/` and `vercel.json` | Vercel deployment configuration |
| `test/` | Automated tests |

To deploy, import the repository into Vercel using the **Other** framework preset. NBA feeds need no API key. Shared fantasy leagues need storage credentials; see [fantasy deployment setup](docs/fantasy.md). For scheduled scoring and news collection, see [background updates](docs/background-updates.md). The [moves tracker documentation](docs/moves-tracker.md) explains its sources and coverage.

## Planned work

The next fantasy improvements are better roster analysis and reliable information about changes in playing time and player roles. A lineup-system simulator is planned as a later feature. A demonstration video is also planned.

---

Courtside is an independent project and is not affiliated with or endorsed by the NBA or ESPN. Team names and logos belong to their respective owners.
