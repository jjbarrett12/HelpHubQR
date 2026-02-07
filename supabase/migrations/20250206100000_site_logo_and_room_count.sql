-- Add logo and room count to sites (customer/facility info)
alter table public.sites
  add column if not exists logo_url text,
  add column if not exists room_count integer;

comment on column public.sites.logo_url is 'Optional facility logo URL (e.g. from Storage)';
comment on column public.sites.room_count is 'Optional expected room/location count for display';

-- Storage bucket for site logos: create in Dashboard → Storage → New bucket "site-logos" (public).
-- Policy below allows authenticated app users to upload; public can read if bucket is public.
create policy "Allow authenticated upload site logos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'site-logos');
create policy "Allow public read site logos"
  on storage.objects for select to public
  using (bucket_id = 'site-logos');
