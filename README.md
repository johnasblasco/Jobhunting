# 📡 JobRadar

Your own job feed. Instead of checking JobStreet, LinkedIn, Indeed and other sites one by one,
JobRadar checks many job sources every few minutes, keeps only the jobs that match your keywords,
and lists them **newest first**. You can turn on desktop or Telegram alerts so you hear about a
job a few minutes after it's posted and can apply early.

## Features

- **One list, many sources**, newest first, with "7m ago" timestamps and a **NEW** badge on jobs you haven't seen yet
- **Duplicate removal**: when two sites post the same job, you see it once
- **Alerts**: desktop notifications while the page is open, and optional **Telegram alerts on your phone**
- **Track your applications**: Save ★, mark Applied ✓, Hide ✕
- Tabs: Inbox, Last 24h, Local, Remote, Saved, Applied
- Works on phone screens and supports dark mode. Run it on your computer, or deploy it free on **Netlify** so it runs 24/7.

## Sources

| Source | What it covers | Key needed? |
|---|---|---|
| **JSearch** | Google for Jobs results: **LinkedIn, Indeed, JobStreet, Glassdoor**, company career pages. Best for Philippine jobs. | Free RapidAPI key |
| **Google Jobs (SerpApi)** | The jobs box in Google search: LinkedIn, Indeed, JobStreet, company sites. Links go straight to the original post. | Free SerpApi key |
| **Jooble** | Big aggregator with Philippine listings (incl. JobStreet etc.) | Free key |
| Remotive, Remote OK, Himalayas, Jobicy, We Work Remotely | Remote jobs worldwide (only ones open to Asia/PH/worldwide are kept) | No |
| Arbeitnow | Mostly Europe, off by default | No |

> **Why not scrape LinkedIn / JobStreet / Indeed directly?** They block bots and forbid scraping
> in their terms of service, so a scraper breaks often and can get your IP blocked. JSearch and
> Jooble are official APIs that already include listings from those sites.

**Get the two free keys.** Without them you only get remote jobs.
1. **JSearch**: sign up at <https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch>, subscribe to the free *Basic* plan, then copy your `X-RapidAPI-Key`.
2. **SerpApi**: sign up at <https://serpapi.com/users/sign_up> (free plan), verify your email,
   then copy your key from <https://serpapi.com/manage-api-key>.
3. **Jooble**: request a key at <https://jooble.org/api/about>. It's emailed to you.

## Setup

You need [Node.js](https://nodejs.org) 20.12 or newer.

```bash
git clone <this repo> && cd Jobhunting
npm install
cp .env.example .env              # paste your API keys here
cp config.example.json config.json  # set your keywords and location
npm start
```

Then open **http://localhost:3000** and click **🔔 Alerts** to allow notifications.

## config.json

When running locally you can use `config.json`. Every setting can also be set with an environment variable
(`KEYWORDS`, `EXCLUDE`, `LOCATION`, `COUNTRY`, `INCLUDE_REMOTE`, `REMOTE_REGIONS`, `KEEP_DAYS`, `DISABLED_SOURCES`), and environment variables win.

```jsonc
{
  "keywords": ["developer", "web developer", "react"], // a job's title or tags must contain one of these
  "exclude": ["senior staff", "principal"],             // skip titles containing these
  "location": "Philippines",       // used for JSearch/Jooble searches
  "country": "ph",                 // JSearch country code
  "onlyCountry": true,             // drop jobs outside your country (Makati, Cebu... count as PH)
  "includeRemote": true,           // include remote jobs
  "remoteRegions": ["worldwide", "anywhere", "asia", "apac"], // remote jobs must be open to one of these
  "pollMinutes": 15,               // how often to check
  "keepDays": 30,                  // forget jobs older than this (unless saved/applied)
  "sources": { "arbeitnow": false } // turn sources on/off
}
```

Keywords match whole words, so `react` matches "React Developer" but not "Reactor Operator".
Use job titles you'd actually search for, like `customer service`, `virtual assistant`, `accountant` or `data analyst`.

**About the free JSearch quota:** each JSearch check uses one request per keyword (up to 5 keywords).
The free plan has a small monthly limit, so JSearch is checked every 6 hours by default, while the other sources
are checked every 15 minutes. Monthly use = `(1440 / interval) × keywords × 30`. With 3 keywords and the
default 360-minute interval that's 360 requests a month. Check your plan's limit on RapidAPI and set
`JSEARCH_INTERVAL_MINUTES` to match.

SerpApi works the same way (one search per keyword per check) and is checked every 12 hours by default:
3 keywords × 2 checks × 30 days = 180 searches a month. Compare that with your plan's monthly searches at
<https://serpapi.com/dashboard> and adjust `SERPAPI_INTERVAL_MINUTES`.

## Deploy on Netlify (free, runs 24/7 without your computer)

1. On Netlify: **Add new site → Import an existing project →** pick this GitHub repo.
2. Build settings: Netlify reads `netlify.toml`, so leave **Base directory**, **Build command**,
   **Publish directory** and **Functions directory** as they are (or blank).
3. **Environment variables → Add environment variables**: add these:

   | Key | Example value | Needed? |
   |---|---|---|
   | `APP_PASSWORD` | any password you choose | **Yes**, otherwise anyone with the link can use up your API quota |
   | `KEYWORDS` | `virtual assistant, customer service, web developer` | Yes (comma separated) |
   | `LOCATION` | `Philippines` (or `Manila`, `Cebu`…) | Recommended |
   | `COUNTRY` | `ph` | Recommended |
   | `RAPIDAPI_KEY` | your JSearch key | Recommended, gives you LinkedIn/Indeed/JobStreet jobs |
   | `SERPAPI_KEY` | your SerpApi key | Recommended, a second source of LinkedIn/Indeed/JobStreet jobs via Google |
   | `JOOBLE_API_KEY` | your Jooble key | Recommended |
   | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | from the Telegram steps below | Optional, for phone alerts |
   | `EXCLUDE` | `senior, manager` | Optional |
   | `INCLUDE_REMOTE` | `false` to hide remote jobs | Optional |
   | `ONLY_COUNTRY` | `true` (default): only jobs located in your country, plus remote jobs open to Asia or worldwide | Optional |
   | `DISABLED_SOURCES` | `arbeitnow, jobicy` | Optional |
   | `JSEARCH_INTERVAL_MINUTES` | `360` (default, 4 checks a day) | Optional, see the quota note above |
   | `SERPAPI_INTERVAL_MINUTES` | `720` (default, 2 checks a day) | Optional, see the quota note above |

4. Click **Deploy**. Then open your site, enter your password, and wait for the first check.
   It runs every 15 minutes. You can also click **↻ Check now**.

How it works on Netlify: the scheduled function `netlify/functions/poll.mjs` checks for jobs every 15 minutes,
and `netlify/functions/api.mjs` serves the page's data. Jobs are stored in **Netlify Blobs**, which needs no setup.
To change how often it checks, edit `schedule` in `netlify.toml`. After you change an environment variable,
redeploy (**Deploys → Trigger deploy**) for it to take effect.

## Phone alerts with Telegram (recommended)

1. In Telegram, message **@BotFather** and send `/newbot`. It gives you a bot token.
2. Send any message to your new bot.
3. Message **@userinfobot** to get your chat id.
4. Put both in `.env` as `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`, then restart.

You'll get a message every time new matching jobs appear. The jobs found on the very first run aren't sent, so your phone isn't flooded.

## Other commands

```bash
npm run fetch   # check once and print new jobs in the terminal
npm test        # run the tests
```

## How it works

```
sources/*.js  ──fetch──▶  poller (every N min)  ──filter + dedupe──▶  data/jobs.json
                                    │                                       │
                                    └──▶ Telegram alert         web UI ◀────┘ (http://localhost:3000)
```

To add a new source, create a file in `src/sources/` that returns jobs in the same shape
(see `remotive.js` for a small example) and register it in `src/sources/index.js`.
