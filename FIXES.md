# One-time fixes

Apply these only if you hit the described issue (e.g. existing DBs created before certain migrations).

---

## Tickets: "new row violates row-level security policy for table 'tickets'"

**When:** Staff use **Add ticket (e.g. call-in)** and get this RLS error.

**Fix:** Run the SQL in Supabase Dashboard → **SQL Editor**:

1. Open your Supabase project → **SQL Editor**.
2. Paste and run the contents of **`supabase/fix_tickets_rls.sql`** (or run the snippet below).

```sql
-- Allow staff to create tickets for their tenant (call-in / desk).
drop policy if exists "tickets_insert_tenant" on public.tickets;

create policy "tickets_insert_tenant"
  on public.tickets for insert
  with check (tenant_id = public.current_tenant_id());
```

3. Click **Run**.

If you use `supabase db push` and all migrations (including `20250206140000_tickets_insert_policy.sql`) have been applied, this policy already exists and you can skip this step.

---

## Dev server: port in use (EADDRINUSE)

**When:** `npm run dev` fails with "address already in use :::3011" (or 3010).

**Fix:**

- Close any other terminal where the app is running, or
- From repo root: `npm run dev:fresh` (tries to free the port and start on 3011), or
- Run on the other port: `npm run dev:3010` if default is 3011.

---

*Add new one-time fixes below as needed.*
