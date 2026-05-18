# Google Sheets backend — setup

One-time setup. ~3 minutes.

## 1. Open the sheet's Apps Script editor

Open the budget sheet → `Extensions` → `Apps Script`.

## 2. Paste the code

Replace the contents of `Code.gs` with the contents of [Code.gs](./Code.gs). Save (Ctrl/Cmd + S).

## 3. (Recommended) Set a shared token

In the Apps Script editor: `Project Settings` (gear icon) → `Script properties` → `Add script property`.

- Key: `SHARED_TOKEN`
- Value: any long random string (e.g. `openssl rand -hex 32`)

If you skip this, the endpoint is open — anyone with the URL can read/write. Strongly recommended.

## 4. Deploy as a Web App

`Deploy` → `New deployment` → gear icon → `Web app`.

- Description: `family-budget backend`
- Execute as: **Me**
- Who has access: **Anyone** (this only means "anyone with the URL" — the token is what gates real access)

Click `Deploy`. Authorize when prompted. Copy the `Web app URL` (ends in `/exec`).

## 5. Wire up the Next.js app

Add to `.env.local` (also run `vercel env add` for production):

```
SHEETS_WEBAPP_URL=https://script.google.com/macros/s/AKfyc.../exec
SHEETS_WEBAPP_TOKEN=<the same value you set in step 3>
```

Restart `pnpm dev`. The app will pull from the sheet on load and push changes (debounced 1.5s) on every edit.

## Write gate — the Next.js route is the intended writer

The Apps Script `doPost` handler accepts a write from anyone who has the URL
(and the token, if you set one). The app does **not** write to Apps Script
directly. All writes go through `PUT /api/budget` in the Next.js app, which
is gated by `lib/remote-sync-policy.ts`:

- Production Vercel deployment → forwards the write to Apps Script.
- Preview / development / local / test → returns `{ skipped: true }` and
  does **not** call Apps Script. Edits remain local-only in the browser.

If someone bypasses the Next.js app and POSTs straight to the Apps Script
URL, that env check is skipped. To make bypass harder:

1. Set a `SHARED_TOKEN` (step 3 above) so unauthenticated POSTs are
   rejected.
2. Treat the `/exec` URL as a secret — it is the only auth boundary on
   the Sheets side.

## Auth — query string only

Apps Script Web Apps cannot read inbound request headers — the `e` object
on `doGet(e)` / `doPost(e)` exposes `e.parameter` but not `e.headers`. The
shared-token check therefore reads from `?token=`. The Next.js app sends
the token both as `?token=<value>` and as `Authorization: Bearer <value>`;
the header is forward-compat in case Google ever adds header access to
Apps Script Web Apps.

## Storage envelope and schema version

The cell at `Sheet1!A1` stores a JSON envelope:

```json
{ "version": 7, "data": { ... }, "updatedAt": "2026-05-17T18:00:00.000Z" }
```

`version` mirrors `STORE_VERSION` in `lib/store.ts`. When a client writes,
`doPost` refuses with `{ error: "stale schema", storedVersion, incomingVersion }`
(HTTP 409 from the Next.js route) when the cell already holds a newer
envelope. That prevents an older device from clobbering data written by a
newer device after a migration.

`doGet` returns the envelope unchanged. Legacy cells written before this
envelope existed are surfaced with `version: null`; the client treats
those as trustworthy (only this codebase wrote them, at some prior
version ≤ current).

## Updating the script later

If you change `Code.gs`, you must `Deploy` → `Manage deployments` → edit the existing deployment → `New version` → `Deploy`. A brand-new deployment gives a new URL and will break your env var.
