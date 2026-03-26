# Supabase env setup

## Where to get the values

1. Go to [supabase.com](https://supabase.com) and open your project (or create one).
2. Click **Project Settings** (gear icon in the sidebar).
3. Click **API** in the left menu.
4. Copy:

   | Variable | Where on the API page |
   |----------|------------------------|
   | **Project URL** | Under "Project URL" – e.g. `https://abcdefgh.supabase.co` |
   | **anon public key** | Under "Project API keys" → row **anon** **public** – long string starting with `eyJ...` (JWT). Do **not** use the "publishable" key that starts with `sb_publishable_`. |

## Fill in `.env.local`

Open `apps/web/.env.local` and set:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...paste_the_long_anon_key_here...
NEXT_PUBLIC_APP_URL=https://helphubqr.com
```

- **Production:** `NEXT_PUBLIC_APP_URL=https://helphubqr.com` (set in Vercel env).
- **Local dev:** set `NEXT_PUBLIC_APP_URL=http://localhost:3000` when running `npm run dev` locally.
- No quotes around the values.
- No spaces around the `=` sign.
- Save the file, then restart the dev server: `npm run dev`.

## Web Push (VAPID)

Browser push uses a **public** VAPID key in the Next app and the **same** public key plus a **private** key in Supabase (Edge Function that sends notifications).

1. **Generate a key pair** (one-time), from `apps/web`:

   ```bash
   npx web-push generate-vapid-keys
   ```

2. **`apps/web/.env.local`** — set the **public** key only (safe to expose to the client):

   ```env
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=BF...paste_public_key_here...
   ```

   Use the **exact** string labeled “Public Key” from the generator. No quotes. Restart `npm run dev` after changing any `NEXT_PUBLIC_*` variable.

3. **Supabase** — [Project Settings → Edge Functions → Secrets](https://supabase.com/dashboard/project/_/settings/functions):

   - `VAPID_PUBLIC_KEY` = **same value** as `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY` = the **private** key from the generator (never put this in Next.js or commit it)

4. **Production (e.g. Vercel)** — add `NEXT_PUBLIC_VAPID_PUBLIC_KEY` with the same public key as in Supabase.

If `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is unset, the dashboard shows “Push not configured” until you add it.

## Check

- If the app loads and you can open the login page without a "Connection not configured" warning, the URL and anon key are correct.
