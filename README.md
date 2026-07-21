# Action Items Tracker

Node/Express app serving a single-page action tracker (List and Kanban views, filters, stats, email follow-ups, meeting-notes import), backed by Upstash Redis so every tab/user shares the same live data.

## Setup

1. **Create a free Upstash Redis database** at [upstash.com](https://upstash.com) (no credit card required).
2. From the database's dashboard, copy the **REST URL** and **REST TOKEN**.
3. Deploy to Render (below), then in the Render dashboard go to your service → **Environment** and add:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
4. Redeploy. The first page load seeds the database; every load/edit after that reads and writes through `/api/state`.

## Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/subsumeet-collab/action-tracker)

This is now a **Web Service** (not a Static Site) since it needs to run the Node server — the Blueprint button above provisions that automatically. On Render's free tier the service sleeps after ~15 min idle and takes 30-60s to wake on the next request.

## Local development

```
npm install
UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... node server.js
```

Without the Upstash env vars set, the app still runs and falls back to the built-in seed data (no persistence) — useful for local testing.
