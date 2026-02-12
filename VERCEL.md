# Fix 404 on helphubqr.com (Vercel)

If **helphubqr.com** (or your `.vercel.app` URL) shows **404** for `/ping`, `/t/...`, or `/q/...`—the project is building from the wrong folder. This repo is a monorepo: the Next.js app lives in **`apps/web`**, not the repo root.

**Quick check:** Open **https://helphubqr.com/ping**. If you see "Page not found", the **helphubqr** project does not have Root Directory set to `apps/web`. Set it (see below), then redeploy.

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

## "Page not found" when scanning QR – which project is serving your domain?

Deploying with `npx vercel --prod` from the **apps/web** folder deploys to the project linked there (e.g. **"web"**). Your custom domain (e.g. **helphubqr.com**) must be attached to **that same project**.

**Quick check:** Open **https://helphubqr.com/api/health** in a browser.  
- If you see **"OK HelpHub"** → the correct app is serving; the 404 is likely an invalid or expired room token (you should see "This room link is invalid or expired" after the latest deploy).  
- If you get **404** → the domain is serving a **different** Vercel project (e.g. "helphubqr") that doesn’t have this app.

**Fix:** In [Vercel Dashboard](https://vercel.com/dashboard):  
1. See which project has **helphubqr.com** under **Settings → Domains**.  
2. Either:  
   - **Option A:** Add **helphubqr.com** to the **"web"** project (the one you deploy to from apps/web) and remove it from the other project; then redeploy **"web"**, or  
   - **Option B:** Open the project that has helphubqr.com (e.g. "helphubqr"), set **Root Directory** to **`apps/web`**, and **Redeploy** that project (or push to its connected branch).

## Still getting an error page?

Do these in order:

### 1. Confirm your latest code is deployed

- **Commit and push** all changes to the branch your Vercel project uses (usually **main**). If you only run `vercel --prod` from your machine, the **helphubqr** project (connected to GitHub) does **not** get that deploy—it only deploys when you push.
- In **Vercel → helphubqr → Deployments**, open the latest deployment. Check that the **commit message** matches your latest push. If the latest deploy is an old commit, push again and wait for the new deployment, or click **Redeploy**.

### 2. See which app is actually live

Open these in your browser (use the same domain as your QR codes, e.g. **https://helphubqr.com**):

| URL | If it works | If you get 404 |
|-----|-------------|----------------|
| **/api/health** | You see `OK HelpHub` | The domain is **not** serving this app (wrong project or wrong root). |
| **/api/version** | You see `{"ok":true,...}` | Same as above. |
| **/ping** | You see "Public access works." | This app is live but something is wrong with the `/ping` route (unusual). |

If **/api/health** and **/api/version** both 404, then **helphubqr.com** is serving a different Vercel project or a build that didn’t use **Root Directory = apps/web**. Fix the project that has the domain (set Root Directory to **apps/web**, then redeploy).

### 3. Clear build cache and redeploy

In **Vercel → helphubqr → Deployments** → **⋯** on the latest deployment → **Redeploy** → turn **on** “Clear build cache and redeploy”, then confirm. Wait for the build to finish and test **/api/version** and **/ping** again.
