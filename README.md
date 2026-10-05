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
- Works on phone screens and supports dark mode. No database or npm packages needed, only Node.js.

## Sources

| Source | What it covers | Key needed? |
|---|---|---|
| **JSearch** | Google for Jobs results: **LinkedIn, Indeed, JobStreet, Glassdoor**, company career pages. Best for Philippine jobs. | Free RapidAPI key |
| **Jooble** | Big aggregator with Philippine listings (incl. JobStreet etc.) | Free key |
| Remotive, Remote OK, Himalayas, Jobicy, We Work Remotely | Remote jobs worldwide (only ones open to Asia/PH/worldwide are kept) | No |
| Arbeitnow | Mostly Europe, off by default | No |

> **Why not scrape LinkedIn / JobStreet / Indeed directly?** They block bots and forbid scraping
> in their terms of service, so a scraper breaks often and can get your IP blocked. JSearch and
> Jooble are official APIs that already include listings from those sites.

**Get the two free keys.** Without them you only get remote jobs.
1. **JSearch**: sign up at <https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch>, subscribe to the free *Basic* plan, then copy your `X-RapidAPI-Key`.
2. **Jooble**: request a key at <https://jooble.org/api/about>. It's emailed to you.

## Setup

You need [Node.js](https://nodejs.org) 20.12 or newer.

```bash
git clone <this repo> && cd Jobhunting
cp .env.example .env              # paste your API keys here
cp config.example.json config.json  # set your keywords and location
npm start
```

Then open **http://localhost:3000** and click **🔔 Alerts** to allow notifications.

## config.json

```jsonc
{
  "keywords": ["developer", "web developer", "react"], // a job's title or tags must contain one of these
  "exclude": ["senior staff", "principal"],             // skip titles containing these
  "location": "Philippines",       // used for JSearch/Jooble searches
  "country": "ph",                 // JSearch country code
  "includeRemote": true,           // include remote jobs
  "remoteRegions": ["worldwide", "anywhere", "asia", "apac", "philippines"], // hide "USA only" etc.
  "pollMinutes": 15,               // how often to check
  "keepDays": 30,                  // forget jobs older than this (unless saved/applied)
  "sources": { "arbeitnow": false } // turn sources on/off
}
```

Keywords match whole words, so `react` matches "React Developer" but not "Reactor Operator".
Use job titles you'd actually search for, like `customer service`, `virtual assistant`, `accountant` or `data analyst`.

**About the free JSearch quota:** JSearch makes one request per keyword (up to 5 keywords) on every check.
The free plan has a monthly request limit, so if you use many keywords, raise `pollMinutes` to 30–60.

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
