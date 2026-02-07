# HelpHub – Multi-tenant housekeeping QR ticketing

Room-specific QR codes for housekeeping requests. Guests scan a QR in the room, submit a form (room is auto-identified), and tickets appear in real time on the staff dashboard.

## Stack

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind, shadcn-style UI
- **Backend:** Supabase (Postgres, Auth, Realtime)
- **Public ticket creation:** Supabase Edge Function `create-ticket` (no anonymous DB access)
- **Alerts:** Edge Function `send-alerts` (Twilio SMS / SendGrid email)

## Quick start

1. **Supabase**
   - Create a project at [supabase.com](https://supabase.com).
   - Run migrations: `supabase db push` or run the SQL in `supabase/migrations/` in the SQL editor.
   - Enable Realtime for the `tickets` table (included in first migration).
   - Deploy Edge Functions: `supabase functions deploy create-ticket`, `resolve-room`, `send-alerts`.
   - Set secrets for `create-ticket` and `send-alerts` (e.g. `SUPABASE_SERVICE_ROLE_KEY`, and optionally Twilio/SendGrid).
   - For customer logos: in Dashboard → Storage, create a **public** bucket named `site-logos`. Run the migration that adds `logo_url` and `room_count` to sites (and storage policies).

2. **App**
   - Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and optionally `NEXT_PUBLIC_APP_URL`.
   - From repo root: `npm install` then `npm run dev`.
   - Open `http://localhost:3000` → redirects to `/login`. Sign up (first user becomes admin of default tenant).

3. **Flow**
   - **Admin:** Create a site → go to Rooms & QR → upload CSV (columns: `room` or `room_label`, optional `floor`) → tokens are generated → use “Print / Save as PDF” for QR cards.
   - **Guest:** Scan QR → opens `/t/<token>` → submit request → success.
   - **Staff:** Sign in → choose site → see live ticket queue; claim, change status, add internal notes.

## Routes

| Route | Who | Description |
|-------|-----|-------------|
| `/` | All | Redirect to `/app` or `/login` |
| `/login` | Guest | Staff sign in |
| `/t/[token]` | Guest | Public form (room from token) |
| `/t/[token]/success` | Guest | Thank-you after submit |
| `/app` | Staff | Redirect to first site or admin |
| `/app/sites/[siteId]` | Staff | Realtime ticket list for site |
| `/app/tickets/[ticketId]` | Staff | Ticket detail, claim, status, notes |
| `/app/admin/sites` | Admin | Create site, link to rooms |
| `/app/admin/rooms?siteId=...` | Admin | CSV import, QR export |

## Security

- Public guests never touch the DB; they POST to Edge Function `create-ticket`, which validates the token and inserts the ticket.
- Staff use Supabase Auth; RLS restricts all app tables by `tenant_id` from `profiles`.
- First user gets a default tenant and admin role via `handle_new_user` trigger.

## Alerts

Configure `alert_rules` per site (channel: `sms` or `email`, target: phone/email). When a ticket is created, `send-alerts` runs (called from `create-ticket`) and uses Twilio/SendGrid if env vars are set.

## Push notifications

To enable “Enable push notifications” on the site dashboard:

1. **Generate VAPID keys** (one-time):
   ```bash
   npx web-push generate-vapid-keys
   ```
   You get a **public key** and a **private key**.

2. **Next.js app** – In `apps/web/.env.local` add:
   ```
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=<paste the public key from step 1>
   ```
   Use the **same** public key value as in step 3.

3. **Supabase Edge Function secrets** – In [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Edge Functions** → **Secrets** (or **Project Settings** → **Edge Functions** → **Secrets**), add:
   - `VAPID_PUBLIC_KEY` = same public key as above  
   - `VAPID_PRIVATE_KEY` = the private key from step 1  

4. Restart the Next dev server and reload the app. “Enable push notifications” should work; new tickets will trigger push if the user has enabled them for that site.

## Deploy

- **Web:** Vercel (or any Next host). Set env vars and `NEXT_PUBLIC_APP_URL` to your domain.
- **DB + Auth + Realtime + Functions:** Supabase (already in the cloud when you create the project).

## Troubleshooting

**Clean reinstall (PowerShell):**
```powershell
cd "C:\Users\jjbarrett\OneDrive - Bear Facility Supply\Desktop\HelpHubQR"
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force apps\web\node_modules -ErrorAction SilentlyContinue
Remove-Item package-lock.json -ErrorAction SilentlyContinue
npm install --legacy-peer-deps
npm run dev
```

**SWC binary error on Windows:** The project includes a `.babelrc` fallback so Next uses Babel instead of SWC. If you prefer to fix SWC: install [Visual C++ Redistributable (x64)](https://aka.ms/vs/17/release/vc_redist.x64.exe), ensure Node is 64-bit (`node -p "process.arch"` → `x64`), then run the clean reinstall above.

**App “doesn’t work” or blank / 500:**
1. **Migrations** – Your `.env.local` points at project `zyahhdnjvychctgxvppa`. Run **both** SQL files in `supabase/migrations/` in that project’s Supabase **SQL Editor** (same project as in the URL). If you ran them on a different project before, run them again on this one.
2. **Run from app folder** – From repo root: `cd apps/web` then `npm run dev`. Open **http://localhost:3000** (or the port shown in the terminal).
3. **Sign up first** – On the login page click **“Sign up”**, create an account, then sign in. The first user becomes admin.
4. **Check the terminal** – If you see “Internal Server Error”, read the stack trace in the same terminal where `npm run dev` is running; that message usually explains the failure.

**EINVAL readlink / “invalid argument” on start:** The `.next` cache is corrupted (common on Windows/OneDrive). Delete it and restart:
- PowerShell: `Remove-Item -Recurse -Force apps\web\.next`
- Or from repo root: `cd apps/web && npm run clean` then `npm run dev`
Then run `npm run dev` again.
