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

## Updating the script later

If you change `Code.gs`, you must `Deploy` → `Manage deployments` → edit the existing deployment → `New version` → `Deploy`. A brand-new deployment gives a new URL and will break your env var.
