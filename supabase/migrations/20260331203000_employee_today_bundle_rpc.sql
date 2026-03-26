-- Employee Today bundle: single read model for iOS/web employee "Today" execution context.
-- SECURITY DEFINER: enforces org membership + auth-linked employee; returns only that employee's rows.
-- Timezone: p_time_zone is an IANA name (e.g. America/Denver). Calendar "today" = (now() AT TIME ZONE p_time_zone)::date.

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
  -- Calendar "today" in org IANA zone (wall-clock date at this instant in that zone).
  v_cal := (now() AT TIME ZONE v_tz)::date;

  v_first_name := split_part(trim(v_employee_record.full_name), ' ', 1);
  IF v_first_name = '' THEN
    v_first_name := v_employee_record.full_name;
  END IF;

  -- 1) Today's shift (calendar date in org TZ)
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
    -- 2) Next future shift
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
      -- Date-only shifts: treat same-calendar-day assigned shift as "current execution window"
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
      'items', '[]'::jsonb,
      'source', 'none',
      'todo', 'No canonical announcements table yet. Options: org_announcements(pin, window), qr_destinations type announcement, or manager broadcast. Keep items [] until wired.'
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.hh_employee_today_bundle(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hh_employee_today_bundle(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hh_employee_today_bundle(uuid, text) TO service_role;

COMMENT ON FUNCTION public.hh_employee_today_bundle IS
  'Employee-scoped Today bundle: one focus shift (today or next), run + grouped checklist items. Uses IANA TZ for calendar_date. Mutations use shift_checklist_run_items.id.';
