-- Run this in Supabase Dashboard → SQL Editor to fix "new row violates row-level security policy for table 'tickets'"
-- This adds the missing INSERT policy so staff can create tickets (e.g. Add ticket / call-in).

drop policy if exists "tickets_insert_tenant" on public.tickets;

create policy "tickets_insert_tenant"
  on public.tickets for insert
  with check (tenant_id = public.current_tenant_id());
