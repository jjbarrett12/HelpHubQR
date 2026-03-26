-- Tickets: enforce tenant_id + site_id + room_id consistency; optional rooms.tenant_id for simpler scoping.
-- Trigger functions use SECURITY DEFINER so validation is not weakened by RLS on sites/rooms/memberships.
-- Error messages use HH_TICKET_* / HH_ROOMS_* prefixes for app-side mapping.

-- ---------------------------------------------------------------------------
-- 1) rooms.tenant_id (denormalized from sites.tenant_id)
-- ---------------------------------------------------------------------------
DO $rooms_tenant$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'rooms'
  ) THEN
    RAISE NOTICE 'Skipping rooms.tenant_id: public.rooms does not exist.';
  ELSE
    ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants (id);

    UPDATE public.rooms r
    SET tenant_id = s.tenant_id
    FROM public.sites s
    WHERE s.id = r.site_id
      AND (r.tenant_id IS NULL OR r.tenant_id IS DISTINCT FROM s.tenant_id);

    IF EXISTS (SELECT 1 FROM public.rooms WHERE tenant_id IS NULL) THEN
      RAISE EXCEPTION 'rooms.tenant_id backfill: some rows have no matching site.tenant_id (fix site_id or orphans first)';
    END IF;

    ALTER TABLE public.rooms ALTER COLUMN tenant_id SET NOT NULL;

    CREATE INDEX IF NOT EXISTS rooms_tenant_id_idx ON public.rooms (tenant_id);
    CREATE INDEX IF NOT EXISTS rooms_tenant_site_idx ON public.rooms (tenant_id, site_id);
  END IF;
END
$rooms_tenant$;

CREATE OR REPLACE FUNCTION public.hh_rooms_sync_tenant_from_site()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT s.tenant_id INTO STRICT NEW.tenant_id
  FROM public.sites s
  WHERE s.id = NEW.site_id;

  RETURN NEW;
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE EXCEPTION 'HH_ROOMS_SITE_NOT_FOUND: room references a site that does not exist';
END;
$$;

REVOKE ALL ON FUNCTION public.hh_rooms_sync_tenant_from_site() FROM PUBLIC;

DROP TRIGGER IF EXISTS rooms_sync_tenant_from_site ON public.rooms;
CREATE TRIGGER rooms_sync_tenant_from_site
  BEFORE INSERT OR UPDATE ON public.rooms
  FOR EACH ROW
  EXECUTE PROCEDURE public.hh_rooms_sync_tenant_from_site();

-- When a site moves tenants (rare), keep rooms and tickets aligned.
CREATE OR REPLACE FUNCTION public.hh_sites_propagate_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.rooms SET tenant_id = NEW.tenant_id WHERE site_id = NEW.id;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tickets'
  ) THEN
    UPDATE public.tickets SET tenant_id = NEW.tenant_id WHERE site_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.hh_sites_propagate_tenant_id() FROM PUBLIC;

DROP TRIGGER IF EXISTS sites_propagate_tenant_id ON public.sites;
CREATE TRIGGER sites_propagate_tenant_id
  AFTER UPDATE OF tenant_id ON public.sites
  FOR EACH ROW
  WHEN (OLD.tenant_id IS DISTINCT FROM NEW.tenant_id)
  EXECUTE PROCEDURE public.hh_sites_propagate_tenant_id();

-- ---------------------------------------------------------------------------
-- 2) tickets scope + assignee (tenant_memberships when present)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hh_tickets_enforce_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_site_tenant uuid;
  v_room_site uuid;
  v_room_tenant uuid;
BEGIN
  IF NEW.tenant_id IS NULL OR NEW.site_id IS NULL OR NEW.room_id IS NULL THEN
    RAISE EXCEPTION 'HH_TICKET_SCOPE_NULL: tenant_id, site_id, and room_id are all required on tickets';
  END IF;

  SELECT s.tenant_id INTO v_site_tenant
  FROM public.sites s
  WHERE s.id = NEW.site_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'HH_TICKET_SITE_NOT_FOUND: site not found for tickets.site_id';
  END IF;

  IF v_site_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'HH_TICKET_SITE_TENANT_MISMATCH: site does not belong to tickets.tenant_id';
  END IF;

  SELECT r.site_id, r.tenant_id INTO v_room_site, v_room_tenant
  FROM public.rooms r
  WHERE r.id = NEW.room_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'HH_TICKET_ROOM_NOT_FOUND: room not found for tickets.room_id';
  END IF;

  IF v_room_site IS DISTINCT FROM NEW.site_id THEN
    RAISE EXCEPTION 'HH_TICKET_ROOM_SITE_MISMATCH: room does not belong to tickets.site_id';
  END IF;

  IF v_room_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'HH_TICKET_ROOM_TENANT_MISMATCH: room tenant does not match tickets.tenant_id';
  END IF;

  IF NEW.assigned_to IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'tenant_memberships'
    ) THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.tenant_memberships tm
        WHERE tm.tenant_id = NEW.tenant_id
          AND tm.user_id = NEW.assigned_to
          AND tm.status = 'active'
      ) THEN
        RAISE EXCEPTION 'HH_TICKET_ASSIGNEE_INVALID: assigned user is not an active member of this tenant';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.hh_tickets_enforce_scope() FROM PUBLIC;

DO $ticket_trig$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tickets'
  ) THEN
    RAISE NOTICE 'Skipping tickets trigger: public.tickets does not exist.';
  ELSE
    DROP TRIGGER IF EXISTS tickets_enforce_scope ON public.tickets;
    CREATE TRIGGER tickets_enforce_scope
      BEFORE INSERT OR UPDATE OF tenant_id, site_id, room_id, assigned_to ON public.tickets
      FOR EACH ROW
      EXECUTE PROCEDURE public.hh_tickets_enforce_scope();
  END IF;
END
$ticket_trig$;

CREATE INDEX IF NOT EXISTS tickets_tenant_site_idx ON public.tickets (tenant_id, site_id);
CREATE INDEX IF NOT EXISTS tickets_site_room_idx ON public.tickets (site_id, room_id);
CREATE INDEX IF NOT EXISTS tickets_tenant_assignee_idx ON public.tickets (tenant_id, assigned_to)
  WHERE assigned_to IS NOT NULL;
