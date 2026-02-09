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
NEXT_PUBLIC_APP_URL=http://localhost:3010
```

- **Local dev:** keep `NEXT_PUBLIC_APP_URL=http://localhost:3010`.
- **Production:** set `NEXT_PUBLIC_APP_URL=https://yourdomain.com` (your actual domain).
- No quotes around the values.
- No spaces around the `=` sign.
- Save the file, then restart the dev server: `npm run dev`.

## Check

- If the app loads and you can open the login page without a "Connection not configured" warning, the URL and anon key are correct.
