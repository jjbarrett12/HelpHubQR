-- Allow staff to create tickets for their tenant (e.g. call-in / desk requests).
create policy "tickets_insert_tenant"
  on public.tickets for insert
  with check (tenant_id = public.current_tenant_id());
