-- HelpHub MVP: ticket/room indexes, idempotent guest/staff submits, unique room labels per site,
-- DB-maintained sites.room_count, tickets.updated_at. Defensive IF EXISTS per table.

-- ---------------------------------------------------------------------------
-- tickets: client_request_id, updated_at, normalization, partial unique
-- ---------------------------------------------------------------------------
DO $tcols$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tickets'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS client_request_id text;
    ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

    CREATE UNIQUE INDEX IF NOT EXISTS tickets_tenant_client_request_uidx
      ON public.tickets (tenant_id, client_request_id)
      WHERE client_request_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS tickets_site_created_idx
      ON public.tickets (site_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS tickets_site_status_created_idx
      ON public.tickets (site_id, status, created_at DESC);

    CREATE INDEX IF NOT EXISTS tickets_tenant_status_created_idx
      ON public.tickets (tenant_id, status, created_at DESC);

    CREATE INDEX IF NOT EXISTS tickets_room_id_idx
      ON public.tickets (room_id);

    CREATE INDEX IF NOT EXISTS tickets_status_idx
      ON public.tickets (status);

    CREATE INDEX IF NOT EXISTS tickets_assignee_status_created_idx
      ON public.tickets (assigned_to, status, created_at DESC)
      WHERE assigned_to IS NOT NULL;
  END IF;
END
$tcols$;

CREATE OR REPLACE FUNCTION public.hh_tickets_normalize_client_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_request_id IS NOT NULL THEN
    NEW.client_request_id := NULLIF(btrim(NEW.client_request_id), '');
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.hh_tickets_normalize_client_request() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.hh_tickets_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.hh_tickets_set_updated_at() FROM PUBLIC;

DO $tt$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tickets'
  ) THEN
    DROP TRIGGER IF EXISTS tickets_00_normalize_client_request ON public.tickets;
    CREATE TRIGGER tickets_00_normalize_client_request
      BEFORE INSERT OR UPDATE ON public.tickets
      FOR EACH ROW
      EXECUTE PROCEDURE public.hh_tickets_normalize_client_request();

    DROP TRIGGER IF EXISTS tickets_set_updated_at ON public.tickets;
    CREATE TRIGGER tickets_set_updated_at
      BEFORE UPDATE ON public.tickets
      FOR EACH ROW
      EXECUTE PROCEDURE public.hh_tickets_set_updated_at();
  END IF;
END
$tt$;

-- ---------------------------------------------------------------------------
-- rooms: site listing indexes, case-insensitive unique label per site
-- ---------------------------------------------------------------------------
DO $rooms_idx$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'rooms'
  ) THEN
    CREATE INDEX IF NOT EXISTS rooms_site_id_idx ON public.rooms (site_id);
    CREATE INDEX IF NOT EXISTS rooms_site_active_idx ON public.rooms (site_id, active);

    CREATE UNIQUE INDEX IF NOT EXISTS rooms_site_room_label_lower_uidx
      ON public.rooms (site_id, lower(trim(room_label)))
      WHERE room_label IS NOT NULL;
  END IF;
END
$rooms_idx$;

-- ---------------------------------------------------------------------------
-- ticket_events
-- ---------------------------------------------------------------------------
DO $tev$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ticket_events'
  ) THEN
    CREATE INDEX IF NOT EXISTS ticket_events_ticket_created_idx
      ON public.ticket_events (ticket_id, created_at);

    CREATE INDEX IF NOT EXISTS ticket_events_actor_created_idx
      ON public.ticket_events (actor_user_id, created_at DESC)
      WHERE actor_user_id IS NOT NULL;
  END IF;
END
$tev$;

-- ---------------------------------------------------------------------------
-- ticket_attachments (if present)
-- ---------------------------------------------------------------------------
DO $tatt$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ticket_attachments'
  ) THEN
    CREATE INDEX IF NOT EXISTS ticket_attachments_ticket_id_idx
      ON public.ticket_attachments (ticket_id);
  END IF;
END
$tatt$;

-- ---------------------------------------------------------------------------
-- alert_rules (if present; distinct from property_alert_rules)
-- ---------------------------------------------------------------------------
DO $ar$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'alert_rules'
  ) THEN
    CREATE INDEX IF NOT EXISTS alert_rules_site_id_idx ON public.alert_rules (site_id);
    CREATE INDEX IF NOT EXISTS alert_rules_site_enabled_idx ON public.alert_rules (site_id, enabled);
  END IF;
END
$ar$;

-- ---------------------------------------------------------------------------
-- sites.room_count maintained from rooms (replaces unsafe manual entry)
-- ---------------------------------------------------------------------------
DO $rc$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sites'
  ) THEN
    ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS room_count integer;

    UPDATE public.sites s
    SET room_count = COALESCE(
      (SELECT count(*)::int FROM public.rooms r WHERE r.site_id = s.id),
      0
    );
  END IF;
END
$rc$;

CREATE OR REPLACE FUNCTION public.hh_rooms_refresh_site_room_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.sites
    SET room_count = COALESCE((SELECT count(*)::int FROM public.rooms r WHERE r.site_id = OLD.site_id), 0)
    WHERE id = OLD.site_id;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.site_id IS DISTINCT FROM NEW.site_id THEN
    UPDATE public.sites
    SET room_count = COALESCE((SELECT count(*)::int FROM public.rooms r WHERE r.site_id = OLD.site_id), 0)
    WHERE id = OLD.site_id;
  END IF;

  UPDATE public.sites
  SET room_count = COALESCE((SELECT count(*)::int FROM public.rooms r WHERE r.site_id = NEW.site_id), 0)
  WHERE id = NEW.site_id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.hh_rooms_refresh_site_room_count() FROM PUBLIC;

DO $rct$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'rooms'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sites'
  ) THEN
    DROP TRIGGER IF EXISTS rooms_refresh_site_room_count ON public.rooms;
    CREATE TRIGGER rooms_refresh_site_room_count
      AFTER INSERT OR DELETE OR UPDATE OF site_id ON public.rooms
      FOR EACH ROW
      EXECUTE PROCEDURE public.hh_rooms_refresh_site_room_count();
  END IF;
END
$rct$;

-- room_tokens: uniqueness is already enforced via room_tokens_token_hash_uidx (hashed secrets).
