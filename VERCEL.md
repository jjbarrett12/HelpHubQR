# Fix 404 on helphubqr.com (Vercel)

If **helphubqr.com** (or your `.vercel.app` URL) shows **404**—or you see a blank/hard-to-read page that’s actually a 404—the project is usually building from the wrong folder. This repo is a monorepo: the Next.js app lives in **`apps/web`**, not the repo root.

## Do this in Vercel (required)

1. Open **[vercel.com/dashboard](https://vercel.com/dashboard)** and select the project that has **helphubqr.com** (or the one you want to use).
2. Go to **Settings** (top tab).
3. In the left sidebar, open **General** (under "Project Settings").
4. Find **Root Directory**.
5. Click **Edit**.
6. Enter: **`apps/web`**
7. Click **Save**.
8. Trigger a new deploy:
   - Go to **Deployments** → open the **⋯** on the latest deployment → **Redeploy**,  
   - or push a new commit to `main`.

After the new deployment finishes (and shows a green check), open **helphubqr.com** again. The app should load.

## Environment variable for helphubqr.com

In **Vercel → Settings → Environment Variables**, set (for Production):

- **`NEXT_PUBLIC_APP_URL`** = **`https://helphubqr.com`**

This is used for QR links, redirects, and site metadata. Without it, the app may still run at helphubqr.com, but links (e.g. in emails or QR codes) could point to localhost or the wrong URL.

## Checklist

- [ ] Root Directory is set to **`apps/web`** (not blank, not `.`).
- [ ] **`NEXT_PUBLIC_APP_URL`** = **`https://helphubqr.com`** in Vercel env (Production).
- [ ] The deployment you’re opening is **Production** (not a preview URL).
- [ ] Latest deployment **succeeded** (green check in Deployments).
- [ ] Domain **helphubqr.com** is listed under **Settings → Domains** for this project.

If you have multiple Vercel projects from this repo, only the project where you set Root Directory to `apps/web` and added the domain will serve the app correctly.
