# Action Tracker

Node/Express app serving a single-page action/task tracker (List and Kanban views, owners, configurable
stages, dashboard, CSV import/export, audit history, and Telegram follow-up synchronization), backed by
Upstash Redis so every tab/user shares the same live data.

## What's here

- `index.html` — page shell (markup + CSS).
- `app.js` — all client-side logic (state, rendering, filters, CSV, Telegram UI, the legacy "Import from
  meeting notes" feature).
- `server.js` — Express server: serves the static files, persists the whole app state as one JSON blob in
  Upstash Redis (`GET/PUT /api/state`), and handles Telegram (`/api/telegram/*`).

There is no separate database/schema — the app state (`people`, `items`/tasks, and a small `meta`/
`telegramOutbox` bookkeeping section) is one JSON document. This keeps the architecture minimal; it's
plenty for the current data volume and sidesteps needing a real database or migrations.

**Upgrading from an older version of this app:** nothing to do. The client migrates whatever shape is
currently stored (old `status`/`dateOfDisc` fields, items without priorities/owners/history, etc.) into the
current shape automatically on load, and persists the upgraded shape back. No data is deleted in the
process — old fields are folded into their new equivalents.

## Setup

1. **Create a free Upstash Redis database** at [upstash.com](https://upstash.com) (no credit card required).
2. From the database's dashboard, copy the **REST URL** and **REST TOKEN**.
3. Deploy to Render (below), then in the Render dashboard go to your service → **Environment** and add the
   variables listed below.
4. Redeploy. The first page load seeds the database; every load/edit after that reads and writes through
   `/api/state`.

### Environment variables

| Variable | Purpose | Required? |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint | Yes, for shared/persistent data |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST auth token | Yes, for shared/persistent data |
| `TELEGRAM_BOT_TOKEN` | Bot token from [@BotFather](https://t.me/BotFather) | Only if using Telegram follow-ups |
| `TELEGRAM_BOT_USERNAME` | Your bot's `@username` (without `@`) — used to build personal connect links | Only if using Telegram follow-ups |
| `TELEGRAM_WEBHOOK_SECRET` | Any random string; verified against Telegram's `X-Telegram-Bot-Api-Secret-Token` header | Recommended if using Telegram follow-ups |

Without the Upstash env vars set, the app still runs and falls back to built-in seed data (no persistence)
— useful for local testing. Without the Telegram env vars, the app runs fine; only the Telegram-specific
buttons will show an error toast when used.

### Telegram webhook configuration

Register your deployed URL as the bot's webhook once, from your machine (replace the placeholders):

```
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<your-render-domain>/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

## Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/subsumeet-collab/action-tracker)

This is a **Web Service** (not a Static Site) since it needs to run the Node server. On Render's free tier
the service sleeps after ~15 min idle and takes 30-60s to wake on the next request.

## Local development

```
npm install
UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... node server.js
```

## Feature overview

### Owners, stages, priority
Owners (people) can be added, renamed, deactivated (kept for history, hidden from new assignments), and
given a Telegram connect link. Stages live in `state.stages` (not hardcoded) — the defaults are `New →
Assigned → In Progress → Waiting for Response → Response Received → Follow-up Required / Blocked →
Completed / Cancelled`, but any stage value already present in imported/legacy data is added automatically.

### Dashboard
Clickable tiles (Total Open, Overdue, Due Today, Waiting for Response, Follow-up Today, Completed) act as
quick filters — click again to clear. The owner workload table shows each active owner's open/overdue/
due-today/waiting-on-them counts; clicking a row filters to that owner.

### CSV import/export
**Import CSV** validates every row (required task text, known priority/stage values, resolvable owner and
stakeholder names/IDs, valid dates, duplicate Task IDs within the file) and shows a full preview
(new/update/invalid/duplicate) before anything is written — nothing is committed until you confirm.
Rows with a Task ID matching an existing task update it instead of creating a duplicate. **Export CSV**
uses the same column layout, so an exported file can be re-imported without transformation. A sample
template is downloadable from the import dialog.

### Task detail & audit trail
Click any task's title to open its detail drawer: full field values, the Telegram conversation thread, and
a chronological history timeline. Every create, field edit, stage change, CSV update, and Telegram event is
appended to that task's `history` array with old/new value, actor, timestamp, and source (`user` / `csv` /
`telegram` / `system`) — append-only from the UI.

### Telegram follow-ups
Sending a Telegram follow-up moves the task to **Waiting for Response** and records the sent message's
Telegram `message_id`. When the recipient **replies directly to that message** in Telegram, the webhook
matches the reply back to the exact task via that message ID — never by guessing keywords in the reply
text — logs the response, and moves the task to **Response Received** (a safe, human-confirmable state; it
never auto-completes a task). If a reply doesn't target a specific message, the bot falls back to "the one
task this person is currently waiting to respond on" only if that's unambiguous; otherwise it asks the
person to reply to the specific follow-up message. Webhook processing is idempotent (Telegram's
`update_id` is tracked, so retried deliveries are ignored, not double-processed).

### Legacy "Import from meeting notes"
Unchanged in spirit: paste a transcript, it's sent to the Anthropic Messages API directly from the browser
to extract action items, which you review before adding. (This calls `api.anthropic.com` from the client
with no key wired in this repo — if it's broken in your deployment, that predates this revamp.)
