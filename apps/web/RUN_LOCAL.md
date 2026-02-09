# Run HelpHub locally

1. **Open a terminal and go to the web app folder** (required so Next.js finds the app):
   ```powershell
   cd "c:\Users\jjbarrett\OneDrive - Bear Facility Supply\Desktop\HelpHubQR\apps\web"
   ```

2. **Start the dev server:**
   ```powershell
   npm run dev
   ```
   Wait until you see: `Local: http://localhost:3010`

3. **Open in your browser (exactly this):**  
   **http://localhost:3010**

4. You should see either:
   - A redirect to the **login page** (Vanguard logo + "Staff sign in"), or
   - The **HelpHub** home with a "Go to login" button.

If the page is blank:
- Confirm the URL is exactly `http://localhost:3010` (not 3000).
- In the terminal, check for red errors after "Ready".
- Press F12 in the browser → Console tab and note any errors.
- Ensure `apps/web/.env.local` exists with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
