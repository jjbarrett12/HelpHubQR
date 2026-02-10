-- Tenant theme/branding: primary color and optional accent for dashboard customization
alter table public.tenants
  add column if not exists branding jsonb not null default '{}';

comment on column public.tenants.branding is 'Theme: { "primary_color": "#0f766e", "sidebar_style": "default" }';
