# Git fix & run dev

## Project folder

- **Repo root (run dev from here):**  
  `c:\Users\jjbarrett\OneDrive - Bear Facility Supply\Desktop\HelpHubQR`
- **Next.js app:**  
  `c:\Users\jjbarrett\OneDrive - Bear Facility Supply\Desktop\HelpHubQR\apps\web`

Open the repo root in Terminal or Cursor to run the commands below.

---

## Git fix (index.lock / permission errors)

If you see **"Unable to create index.lock"** or **"Permission denied"** when committing:

**PowerShell (run from repo root):**
```powershell
cd "c:\Users\jjbarrett\OneDrive - Bear Facility Supply\Desktop\HelpHubQR"
Remove-Item .git\index.lock -Force -ErrorAction SilentlyContinue
git add -A
git commit -m "Your message"
```

If it still fails, close Cursor/VS Code and any other app using the repo, then try again. OneDrive can lock `.git` files—running Git from a separate terminal sometimes helps.

---

## Run dev

**From repo root:**
```powershell
cd "c:\Users\jjbarrett\OneDrive - Bear Facility Supply\Desktop\HelpHubQR"
npm run dev
```

Then open **http://localhost:3000** in your browser (or use **https://helphubqr.com** for production).

- **Port in use?** See [apps/web/START-HERE.md](apps/web/START-HERE.md) (free port or use `npm run dev:fresh` from `apps/web`).
- **More run options:** [apps/web/RUN_LOCAL.md](apps/web/RUN_LOCAL.md).
