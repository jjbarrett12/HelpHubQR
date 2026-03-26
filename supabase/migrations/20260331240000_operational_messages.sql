-- Operational messages: org-scoped broadcasts and targeted notices (not chat / not email).
-- Read receipts; surfaced via hh_employee_today_bundle + hh_operational_messages_inbox RPC.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.operational_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  category text NOT NULL CHECK (
    category IN (
      'manager_broadcast',
      'shift_note',
      'reminder',
      'approval_update',
      'checklist_nudge',
      'system'
    )
  ),
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL CHECK (audience IN ('all_employees', 'specific_employees')),
  starts_at timestamptz,
  ends_at timestamptz,
  pinned boolean NOT NULL DEFAULT false,
  related jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX operational_messages_org_created_idx
  ON public.operational_messages (organization_id, created_at DESC);

CREATE TABLE public.operational_message_recipients (
  message_id uuid NOT NULL REFERENCES public.operational_messages (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, employee_id)
);

CREATE INDEX operational_message_recipients_employee_idx
  ON public.operational_message_recipients (employee_id);

CREATE TABLE public.operational_message_reads (
  message_id uuid NOT NULL REFERENCES public.operational_messages (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, employee_id)
);

CREATE INDEX operational_message_reads_employee_idx
  ON public.operational_message_reads (employee_id);

CREATE TRIGGER operational_messages_set_updated_at
  BEFORE UPDATE ON public.operational_messages
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.operational_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_message_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY operational_messages_select
  ON public.operational_messages FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT public.hh_org_ids_for_user (auth.uid ()))
    AND (
      public.hh_user_can_manage_org (auth.uid (), organization_id)
      OR (
        public.hh_employee_id_for_user (auth.uid (), organization_id) IS NOT NULL
        AND (starts_at IS NULL OR starts_at <= now())
        AND (ends_at IS NULL OR ends_at > now())
        AND (
          audience = 'all_employees'
          OR EXISTS (
            SELECT 1
            FROM public.operational_message_recipients r
            WHERE
              r.message_id = operational_messages.id
              AND r.employee_id = public.hh_employee_id_for_user (auth.uid (), organization_id)
          )
        )
      )
    )
  );

CREATE POLICY operational_messages_insert_manager
  ON public.operational_messages FOR INSERT TO authenticated
  WITH CHECK (public.hh_user_can_manage_org (auth.uid (), organization_id));

CREATE POLICY operational_messages_update_manager
  ON public.operational_messages FOR UPDATE TO authenticated
  USING (public.hh_user_can_manage_org (auth.uid (), organization_id))
  WITH CHECK (public.hh_user_can_manage_org (auth.uid (), organization_id));

CREATE POLICY operational_messages_delete_manager
  ON public.operational_messages FOR DELETE TO authenticated
  USING (public.hh_user_can_manage_org (auth.uid (), organization_id));

CREATE POLICY operational_message_recipients_all_manager
  ON public.operational_message_recipients FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.operational_messages m
      WHERE
        m.id = operational_message_recipients.message_id
        AND public.hh_user_can_manage_org (auth.uid (), m.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.operational_messages m
      WHERE
        m.id = operational_message_recipients.message_id
        AND public.hh_user_can_manage_org (auth.uid (), m.organization_id)
    )
  );

CREATE POLICY operational_message_reads_select
  ON public.operational_message_reads FOR SELECT TO authenticated
  USING (
    employee_id = public.hh_employee_id_for_user (
      auth.uid (),
      (
        SELECT m.organization_id
        FROM public.operational_messages m
        WHERE m.id = operational_message_reads.message_id
      )
    )
    OR public.hh_user_can_manage_org (
      auth.uid (),
      (
        SELECT m.organization_id
        FROM public.operational_messages m
        WHERE m.id = operational_message_reads.message_id
      )
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.operational_message_reads FROM authenticated;

GRANT SELECT ON public.operational_message_reads TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: inbox (employee or manager; same visibility as SELECT on messages)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hh_operational_messages_inbox(
  p_organization_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_employee_id uuid;
  v_lim int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_items jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members m
    WHERE
      m.user_id = v_uid
      AND m.organization_id = p_organization_id
      AND m.is_active = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_ORG_MEMBER');
  END IF;

  v_employee_id := public.hh_employee_id_for_user(v_uid, p_organization_id);

  IF v_employee_id IS NULL AND NOT public.hh_user_can_manage_org(v_uid, p_organization_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'EMPLOYEE_NOT_LINKED');
  END IF;

  IF public.hh_user_can_manage_org(v_uid, p_organization_id) THEN
    SELECT
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', t.id,
            'title', t.title,
            'body', t.body,
            'category', t.category,
            'audience', t.audience,
            'pinned', t.pinned,
            'created_at', t.created_at,
            'starts_at', t.starts_at,
            'ends_at', t.ends_at,
            'read', t.is_read,
            'read_at', t.read_at_val,
            'related', t.related
          )
          ORDER BY t.pinned DESC, t.created_at DESC
        ),
        '[]'::jsonb
      )
    INTO v_items
    FROM (
      SELECT
        m.id,
        m.title,
        m.body,
        m.category,
        m.audience,
        m.pinned,
        m.created_at,
        m.starts_at,
        m.ends_at,
        m.related,
        false AS is_read,
        NULL::timestamptz AS read_at_val
      FROM public.operational_messages m
      WHERE m.organization_id = p_organization_id
      ORDER BY m.pinned DESC, m.created_at DESC
      LIMIT v_lim
    ) t;
  ELSE
    SELECT
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', t.id,
            'title', t.title,
            'body', t.body,
            'category', t.category,
            'audience', t.audience,
            'pinned', t.pinned,
            'created_at', t.created_at,
            'starts_at', t.starts_at,
            'ends_at', t.ends_at,
            'read', t.is_read,
            'read_at', t.read_at_val,
            'related', t.related
          )
          ORDER BY t.pinned DESC, t.created_at DESC
        ),
        '[]'::jsonb
      )
    INTO v_items
    FROM (
      SELECT
        m.id,
        m.title,
        m.body,
        m.category,
        m.audience,
        m.pinned,
        m.created_at,
        m.starts_at,
        m.ends_at,
        m.related,
        (rd.read_at IS NOT NULL) AS is_read,
        rd.read_at AS read_at_val
      FROM public.operational_messages m
      LEFT JOIN public.operational_message_reads rd
        ON rd.message_id = m.id
        AND rd.employee_id = v_employee_id
      WHERE
        m.organization_id = p_organization_id
        AND (m.starts_at IS NULL OR m.starts_at <= now())
        AND (m.ends_at IS NULL OR m.ends_at > now())
        AND (
          m.audience = 'all_employees'
          OR EXISTS (
            SELECT 1
            FROM public.operational_message_recipients r
            WHERE
              r.message_id = m.id
              AND r.employee_id = v_employee_id
          )
        )
      ORDER BY m.pinned DESC, m.created_at DESC
      LIMIT v_lim
    ) t;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'error', null,
    'organization_id', p_organization_id,
    'items', v_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.hh_operational_messages_inbox(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hh_operational_messages_inbox(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hh_operational_messages_inbox(uuid, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- RPC: mark read (employee only for own receipt)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hh_operational_message_mark_read(
  p_organization_id uuid,
  p_message_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_employee_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  v_employee_id := public.hh_employee_id_for_user(v_uid, p_organization_id);
  IF v_employee_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'EMPLOYEE_NOT_LINKED');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.operational_messages m
    WHERE
      m.id = p_message_id
      AND m.organization_id = p_organization_id
      AND (m.starts_at IS NULL OR m.starts_at <= now())
      AND (m.ends_at IS NULL OR m.ends_at > now())
      AND (
        m.audience = 'all_employees'
        OR EXISTS (
          SELECT 1
          FROM public.operational_message_recipients r
          WHERE
            r.message_id = m.id
            AND r.employee_id = v_employee_id
        )
      )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MESSAGE_NOT_VISIBLE');
  END IF;

  INSERT INTO public.operational_message_reads (message_id, employee_id, read_at)
  VALUES (p_message_id, v_employee_id, now())
  ON CONFLICT (message_id, employee_id) DO UPDATE
  SET read_at = excluded.read_at;

  RETURN jsonb_build_object('ok', true, 'error', null);
END;
$$;

REVOKE ALL ON FUNCTION public.hh_operational_message_mark_read(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hh_operational_message_mark_read(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hh_operational_message_mark_read(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- RPC: create (manager)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hh_operational_message_create(
  p_organization_id uuid,
  p_title text,
  p_body text,
  p_category text,
  p_audience text,
  p_employee_ids uuid[] DEFAULT '{}'::uuid[],
  p_pinned boolean DEFAULT false,
  p_starts_at timestamptz DEFAULT NULL,
  p_ends_at timestamptz DEFAULT NULL,
  p_related jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_mid uuid;
  v_eid uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  IF NOT public.hh_user_can_manage_org(v_uid, p_organization_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_MANAGER');
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MISSING_TITLE');
  END IF;

  IF p_body IS NULL OR length(trim(p_body)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MISSING_BODY');
  END IF;

  IF p_category NOT IN (
    'manager_broadcast',
    'shift_note',
    'reminder',
    'approval_update',
    'checklist_nudge',
    'system'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CATEGORY');
  END IF;

  IF p_audience NOT IN ('all_employees', 'specific_employees') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AUDIENCE');
  END IF;

  IF p_audience = 'specific_employees' AND (
    p_employee_ids IS NULL OR array_length(p_employee_ids, 1) IS NULL OR array_length(p_employee_ids, 1) = 0
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MISSING_RECIPIENTS');
  END IF;

  INSERT INTO public.operational_messages (
    organization_id,
    created_by_user_id,
    category,
    title,
    body,
    audience,
    pinned,
    starts_at,
    ends_at,
    related
  )
  VALUES (
    p_organization_id,
    v_uid,
    p_category,
    trim(p_title),
    trim(p_body),
    p_audience,
    coalesce(p_pinned, false),
    p_starts_at,
    p_ends_at,
    coalesce(p_related, '{}'::jsonb)
  )
  RETURNING id INTO v_mid;

  IF p_audience = 'specific_employees' THEN
    FOREACH v_eid IN ARRAY p_employee_ids
    LOOP
      IF EXISTS (
        SELECT 1
        FROM public.employees e
        WHERE
          e.id = v_eid
          AND e.organization_id = p_organization_id
          AND e.is_active = true
      ) THEN
        INSERT INTO public.operational_message_recipients (message_id, employee_id)
        VALUES (v_mid, v_eid)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'error', null,
    'id', v_mid
  );
END;
$$;

REVOKE ALL ON FUNCTION public.hh_operational_message_create(
  uuid,
  text,
  text,
  text,
  text,
  uuid[],
  boolean,
  timestamptz,
  timestamptz,
  jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hh_operational_message_create(
  uuid,
  text,
  text,
  text,
  text,
  uuid[],
  boolean,
  timestamptz,
  timestamptz,
  jsonb
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hh_operational_message_create(
  uuid,
  text,
  text,
  text,
  text,
  uuid[],
  boolean,
  timestamptz,
  timestamptz,
  jsonb
) TO service_role;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.operational_messages FROM anon;
REVOKE ALL ON public.operational_message_recipients FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operational_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operational_message_recipients TO authenticated;

COMMENT ON TABLE public.operational_messages IS
  'One-way operational notices (broadcast or targeted). Not chat; use operational_message_reads for per-employee read receipts.';

COMMENT ON FUNCTION public.hh_operational_messages_inbox(uuid, integer) IS
  'List operational messages for the org: managers see all rows; employees see active-window messages in their audience.';

COMMENT ON FUNCTION public.hh_operational_message_mark_read(uuid, uuid) IS
  'Idempotent read receipt for the authenticated employee on a visible message.';

COMMENT ON FUNCTION public.hh_operational_message_create IS
  'Create a message (manager). specific_employees requires non-empty p_employee_ids in the same org.';

-- ---------------------------------------------------------------------------
-- Patch employee Today bundle: announcements from operational_messages
-- (same function body as 20260331203000 with v_announcements + query)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hh_employee_today_bundle(
  p_organization_id uuid,
  p_time_zone text DEFAULT 'America/Denver'
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_employee_id uuid;
  v_employee_record public.employees%ROWTYPE;
  v_cal date;
  v_tz text := coalesce(nullif(trim(p_time_zone), ''), 'America/Denver');
  v_shift public.employee_shifts%ROWTYPE;
  v_shift_found boolean := false;
  v_focus_kind text := 'none';
  v_run public.shift_checklist_runs%ROWTYPE;
  v_run_found boolean := false;
  v_checklist_name text;
  v_items jsonb := '[]'::jsonb;
  v_sections jsonb := '[]'::jsonb;
  v_progress jsonb;
  v_next_id uuid;
  v_is_active_now boolean := false;
  v_first_name text;
  v_announcements jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'NOT_AUTHENTICATED',
      'source', jsonb_build_object('bundle_version', 1, 'rpc', 'hh_employee_today_bundle')
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members m
    WHERE m.user_id = v_uid
      AND m.organization_id = p_organization_id
      AND m.is_active = true
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'NOT_ORG_MEMBER',
      'source', jsonb_build_object('bundle_version', 1, 'rpc', 'hh_employee_today_bundle')
    );
  END IF;

  SELECT e.*
  INTO v_employee_record
  FROM public.employees e
  WHERE e.organization_id = p_organization_id
    AND e.auth_user_id = v_uid
    AND e.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'EMPLOYEE_NOT_LINKED',
      'source', jsonb_build_object(
        'bundle_version', 1,
        'rpc', 'hh_employee_today_bundle',
        'organization_id', p_organization_id,
        'time_zone', v_tz
      )
    );
  END IF;

  v_employee_id := v_employee_record.id;
  v_cal := (now() AT TIME ZONE v_tz)::date;

  v_first_name := split_part(trim(v_employee_record.full_name), ' ', 1);
  IF v_first_name = '' THEN
    v_first_name := v_employee_record.full_name;
  END IF;

  SELECT es.*
  INTO v_shift
  FROM public.employee_shifts es
  WHERE es.organization_id = p_organization_id
    AND es.employee_id = v_employee_id
    AND es.shift_date = v_cal
    AND es.status NOT IN ('completed', 'missed')
  ORDER BY es.starts_at NULLS LAST, es.id
  LIMIT 1;

  IF FOUND THEN
    v_shift_found := true;
    v_focus_kind := 'today_shift';
  ELSE
    SELECT es.*
    INTO v_shift
    FROM public.employee_shifts es
    WHERE es.organization_id = p_organization_id
      AND es.employee_id = v_employee_id
      AND es.shift_date > v_cal
      AND es.status NOT IN ('completed', 'missed')
    ORDER BY es.shift_date ASC, es.starts_at NULLS LAST, es.id
    LIMIT 1;

    IF FOUND THEN
      v_shift_found := true;
      v_focus_kind := 'upcoming_shift';
    END IF;
  END IF;

  IF v_shift_found THEN
    IF v_shift.status = 'in_progress' THEN
      v_is_active_now := true;
    ELSIF v_shift.starts_at IS NOT NULL AND v_shift.ends_at IS NOT NULL THEN
      v_is_active_now := (now() >= v_shift.starts_at AND now() <= v_shift.ends_at);
    ELSIF v_shift.shift_date = v_cal AND v_shift.status IN ('scheduled', 'sent', 'in_progress') THEN
      v_is_active_now := true;
    END IF;

    SELECT r.*
    INTO v_run
    FROM public.shift_checklist_runs r
    WHERE r.employee_shift_id = v_shift.id
      AND r.organization_id = p_organization_id
    LIMIT 1;

    v_run_found := FOUND;

    IF v_run_found THEN
      IF v_run.status = 'opened' THEN
        v_is_active_now := true;
      END IF;

      SELECT c.name
      INTO v_checklist_name
      FROM public.checklists c
      WHERE c.id = v_run.checklist_id
      LIMIT 1;

      WITH base AS (
        SELECT
          ri.id AS item_id,
          ri.checklist_item_id,
          ri.completed,
          ri.completed_at,
          ri.notes AS item_notes,
          ri.proof_photo_storage_path,
          COALESCE(ri.suppressed, false) AS suppressed,
          COALESCE(ri.assignment_status, 'assigned') AS assignment_status,
          COALESCE(ri.task_text_snapshot, ci.task_text) AS title_text,
          COALESCE(ci.sort_order, 0) AS sort_order,
          ci.section_title,
          COALESCE(ci.requires_photo, false) AS requires_photo
        FROM public.shift_checklist_run_items ri
        LEFT JOIN public.checklist_items ci ON ci.id = ri.checklist_item_id
        WHERE ri.shift_checklist_run_id = v_run.id
      ),
      keyed AS (
        SELECT
          *,
          COALESCE(NULLIF(trim(section_title), ''), 'default') AS section_key
        FROM base
      ),
      agg AS (
        SELECT
          section_key,
          COALESCE(NULLIF(trim(max(section_title::text)), ''), 'Tasks') AS section_title_resolved,
          min(sort_order) AS section_sort,
          jsonb_agg(
            jsonb_build_object(
              'id', item_id,
              'checklist_item_id', checklist_item_id,
              'sort_order', sort_order,
              'section_title', section_title,
              'title', title_text,
              'is_completed', completed,
              'completed_at', completed_at,
              'requires_photo', requires_photo,
              'has_proof', (proof_photo_storage_path IS NOT NULL AND proof_photo_storage_path <> ''),
              'notes', item_notes,
              'is_suppressed', suppressed,
              'is_blocked',
                suppressed
                OR (assignment_status IN ('declined', 'pending_approval')),
              'assignment_status', assignment_status
            )
            ORDER BY sort_order, item_id
          ) AS items
        FROM keyed
        GROUP BY section_key
      )
      SELECT
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'section_key', section_key,
              'section_title', section_title_resolved,
              'section_sort', section_sort,
              'items', items
            )
            ORDER BY section_sort, section_key
          ),
          '[]'::jsonb
        )
      INTO v_sections
      FROM agg;

      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', item_id,
            'checklist_item_id', checklist_item_id,
            'sort_order', sort_order,
            'section_title', section_title,
            'title', title_text,
            'is_completed', completed,
            'completed_at', completed_at,
            'requires_photo', requires_photo,
            'has_proof', (proof_photo_storage_path IS NOT NULL AND proof_photo_storage_path <> ''),
            'notes', item_notes,
            'is_suppressed', suppressed,
            'is_blocked',
              suppressed
              OR (assignment_status IN ('declined', 'pending_approval')),
            'assignment_status', assignment_status
          )
          ORDER BY sort_order, item_id
        ),
        '[]'::jsonb
      )
      INTO v_items
      FROM (
        SELECT *
        FROM (
          SELECT
            ri.id AS item_id,
            ri.checklist_item_id,
            ri.completed,
            ri.completed_at,
            ri.notes AS item_notes,
            ri.proof_photo_storage_path,
            COALESCE(ri.suppressed, false) AS suppressed,
            COALESCE(ri.assignment_status, 'assigned') AS assignment_status,
            COALESCE(ri.task_text_snapshot, ci.task_text) AS title_text,
            COALESCE(ci.sort_order, 0) AS sort_order,
            ci.section_title
          FROM public.shift_checklist_run_items ri
          LEFT JOIN public.checklist_items ci ON ci.id = ri.checklist_item_id
          WHERE ri.shift_checklist_run_id = v_run.id
        ) x
      ) flat;

      SELECT item_id
      INTO v_next_id
      FROM (
        SELECT
          ri.id AS item_id,
          COALESCE(ci.sort_order, 0) AS sort_order
        FROM public.shift_checklist_run_items ri
        LEFT JOIN public.checklist_items ci ON ci.id = ri.checklist_item_id
        WHERE ri.shift_checklist_run_id = v_run.id
          AND ri.completed = false
          AND COALESCE(ri.suppressed, false) = false
        ORDER BY sort_order, ri.id
        LIMIT 1
      ) n;

      v_progress := jsonb_build_object(
        'completed', (SELECT count(*)::int FROM public.shift_checklist_run_items ri WHERE ri.shift_checklist_run_id = v_run.id AND ri.completed = true AND COALESCE(ri.suppressed, false) = false),
        'total', (SELECT count(*)::int FROM public.shift_checklist_run_items ri WHERE ri.shift_checklist_run_id = v_run.id AND COALESCE(ri.suppressed, false) = false),
        'ratio',
          CASE
            WHEN (SELECT count(*) FROM public.shift_checklist_run_items ri WHERE ri.shift_checklist_run_id = v_run.id AND COALESCE(ri.suppressed, false) = false) = 0 THEN 0::numeric
            ELSE round(
              (SELECT count(*)::numeric FROM public.shift_checklist_run_items ri WHERE ri.shift_checklist_run_id = v_run.id AND ri.completed = true AND COALESCE(ri.suppressed, false) = false)
              / (SELECT count(*)::numeric FROM public.shift_checklist_run_items ri WHERE ri.shift_checklist_run_id = v_run.id AND COALESCE(ri.suppressed, false) = false),
              4
            )
          END
      );
    END IF;
  END IF;

  IF v_progress IS NULL THEN
    v_progress := jsonb_build_object('completed', 0, 'total', 0, 'ratio', 0);
  END IF;

  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'title', t.title,
          'body', t.body,
          'pinned', t.pinned,
          'category', t.category,
          'read', t.is_read,
          'read_at', t.read_at_val,
          'effectiveFrom', t.starts_at,
          'effectiveTo', t.ends_at,
          'created_at', t.created_at
        )
        ORDER BY t.pinned DESC, t.created_at DESC
      ),
      '[]'::jsonb
    )
  INTO v_announcements
  FROM (
    SELECT
      m.id,
      m.title,
      m.body,
      m.pinned,
      m.category,
      m.starts_at,
      m.ends_at,
      m.created_at,
      (rd.read_at IS NOT NULL) AS is_read,
      rd.read_at AS read_at_val
    FROM public.operational_messages m
    LEFT JOIN public.operational_message_reads rd
      ON rd.message_id = m.id
      AND rd.employee_id = v_employee_id
    WHERE m.organization_id = p_organization_id
      AND (m.starts_at IS NULL OR m.starts_at <= now())
      AND (m.ends_at IS NULL OR m.ends_at > now())
      AND (
        m.audience = 'all_employees'
        OR EXISTS (
          SELECT 1
          FROM public.operational_message_recipients r
          WHERE r.message_id = m.id
            AND r.employee_id = v_employee_id
        )
      )
    ORDER BY m.pinned DESC, m.created_at DESC
    LIMIT 5
  ) t;

  RETURN jsonb_build_object(
    'ok', true,
    'error', null,
    'source', jsonb_build_object(
      'bundle_version', 1,
      'rpc', 'hh_employee_today_bundle',
      'computed_at', to_jsonb(now()),
      'organization_id', p_organization_id,
      'employee_id', v_employee_id,
      'time_zone', v_tz,
      'calendar_date', v_cal,
      'focus_employee_shift_id', CASE WHEN v_shift_found THEN v_shift.id ELSE null END,
      'focus_run_id', CASE WHEN v_run_found THEN v_run.id ELSE null END
    ),
    'employee', jsonb_build_object(
      'id', v_employee_id,
      'organization_id', p_organization_id,
      'first_name', v_first_name,
      'full_name', v_employee_record.full_name,
      'location_id', v_employee_record.location_id
    ),
    'focus', jsonb_build_object(
      'kind', v_focus_kind,
      'is_active_now', v_is_active_now,
      'shift',
        CASE
          WHEN NOT v_shift_found THEN null
          ELSE jsonb_build_object(
            'id', v_shift.id,
            'shift_date', v_shift.shift_date,
            'shift_type', v_shift.shift_type,
            'status', v_shift.status,
            'starts_at', v_shift.starts_at,
            'ends_at', v_shift.ends_at,
            'location_id', v_shift.location_id,
            'staff_role_id', v_shift.staff_role_id,
            'location_name', (SELECT l.name FROM public.locations l WHERE l.id = v_shift.location_id LIMIT 1),
            'role_name', (SELECT sr.name FROM public.staff_roles sr WHERE sr.id = v_shift.staff_role_id LIMIT 1)
          )
        END,
      'run',
        CASE
          WHEN NOT v_run_found THEN null
          ELSE jsonb_build_object(
            'id', v_run.id,
            'status', v_run.status,
            'checklist_id', v_run.checklist_id,
            'template_name', v_checklist_name,
            'started_at', v_run.started_at,
            'completed_at', v_run.completed_at,
            'sent_at', v_run.sent_at
          )
        END
    ),
    'checklist',
      CASE
        WHEN NOT v_run_found THEN
          jsonb_build_object(
            'run_id', null,
            'template_name', null,
            'progress', v_progress,
            'sections', '[]'::jsonb,
            'items_flat', '[]'::jsonb,
            'next_incomplete_task_id', null,
            'no_run_reason', CASE WHEN v_shift_found THEN 'run_not_created' ELSE 'no_focus_shift' END
          )
        ELSE
          jsonb_build_object(
            'run_id', v_run.id,
            'template_name', v_checklist_name,
            'progress', v_progress,
            'sections', v_sections,
            'items_flat', v_items,
            'next_incomplete_task_id', v_next_id,
            'no_run_reason', null
          )
      END,
    'announcements', jsonb_build_object(
      'items', v_announcements,
      'source', 'operational_messages',
      'todo', null
    )
  );
END;
$$;

COMMENT ON FUNCTION public.hh_employee_today_bundle(uuid, text) IS
  'Employee-scoped Today bundle: shift, run, checklist items, and up to 5 operational_messages (pinned/recent, read-aware).';
