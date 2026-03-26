-- Employee Today bundle v3: include shift_run_override_tasks in sections, items_flat, progress, and next-incomplete hints.
-- Template run rows carry item_kind = run_item; overrides carry item_kind = override (mutate via a different path than hh_shift_checklist_run_item_mutate).
-- Bumps source.bundle_version to 3.

ALTER TABLE public.shift_run_override_tasks
  ADD COLUMN IF NOT EXISTS proof_photo_storage_path text;

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
  v_next_override_id uuid;
  v_next_any jsonb;
  v_override_section jsonb;
  v_override_flat jsonb := '[]'::jsonb;
  v_rc int := 0;
  v_rt int := 0;
  v_oc int := 0;
  v_ot int := 0;
  v_is_active_now boolean := false;
  v_first_name text;
  v_announcements jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'NOT_AUTHENTICATED',
      'source', jsonb_build_object('bundle_version', 3, 'rpc', 'hh_employee_today_bundle')
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
      'source', jsonb_build_object('bundle_version', 3, 'rpc', 'hh_employee_today_bundle')
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
        'bundle_version', 3,
        'rpc', 'hh_employee_today_bundle',
        'organization_id', p_organization_id,
        'time_zone', v_tz
      )
    );
  END IF;

  v_employee_id := v_employee_record.id;
  -- Calendar "today" for shift selection: interpret instant now in the requested IANA zone, then take the local date.
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
          AND (ri.assigned_employee_id IS NULL OR ri.assigned_employee_id = v_employee_id)
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
              'item_kind', 'run_item',
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
            'item_kind', 'run_item',
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
          AND (ri.assigned_employee_id IS NULL OR ri.assigned_employee_id = v_employee_id)
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
          AND (ri.assigned_employee_id IS NULL OR ri.assigned_employee_id = v_employee_id)
          AND ri.completed = false
          AND COALESCE(ri.suppressed, false) = false
        ORDER BY sort_order, ri.id
        LIMIT 1
      ) n;

      SELECT
        count(*) FILTER (
          WHERE ri.completed = true
            AND COALESCE(ri.suppressed, false) = false
        )::int,
        count(*) FILTER (WHERE COALESCE(ri.suppressed, false) = false)::int
      INTO v_rc, v_rt
      FROM public.shift_checklist_run_items ri
      WHERE ri.shift_checklist_run_id = v_run.id
        AND (ri.assigned_employee_id IS NULL OR ri.assigned_employee_id = v_employee_id);

      -- shift_run_override_tasks: same assignment visibility as run items; suppressed excluded from totals.
      SELECT
        CASE
          WHEN (
            SELECT count(*)::int
            FROM public.shift_run_override_tasks o
            WHERE o.run_id = v_run.id
              AND o.organization_id = p_organization_id
              AND (o.assigned_employee_id IS NULL OR o.assigned_employee_id = v_employee_id)
              AND o.status <> 'suppressed'
          ) = 0 THEN null
          ELSE jsonb_build_object(
            'section_key', '__override__',
            'section_title', 'Extra tasks',
            'section_sort', 2147483646,
            'items',
              COALESCE(
                (
                  SELECT jsonb_agg(
                    jsonb_build_object(
                      'id', o.id,
                      'item_kind', 'override',
                      'checklist_item_id', null,
                      'sort_order', o.sort_order,
                      'section_title', null,
                      'title', o.task_text_snapshot,
                      'is_completed', o.status = 'completed',
                      'completed_at', o.completed_at,
                      'requires_photo', o.requires_photo,
                      'has_proof', (
                        o.proof_photo_storage_path IS NOT NULL
                        AND trim(coalesce(o.proof_photo_storage_path, '')) <> ''
                      ),
                      'notes', o.notes,
                      'is_suppressed', false,
                      'is_blocked', false,
                      'assignment_status',
                        CASE
                          WHEN o.assigned_employee_id IS NULL THEN 'whole_shift'
                          ELSE 'assigned'
                        END
                    )
                    ORDER BY o.sort_order, o.id
                  )
                  FROM public.shift_run_override_tasks o
                  WHERE o.run_id = v_run.id
                    AND o.organization_id = p_organization_id
                    AND (o.assigned_employee_id IS NULL OR o.assigned_employee_id = v_employee_id)
                    AND o.status <> 'suppressed'
                ),
                '[]'::jsonb
              )
          )
        END
      INTO v_override_section;

      IF v_override_section IS NOT NULL THEN
        v_sections := v_sections || jsonb_build_array(v_override_section);
      END IF;

      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', o.id,
            'item_kind', 'override',
            'checklist_item_id', null,
            'sort_order', o.sort_order,
            'section_title', null,
            'title', o.task_text_snapshot,
            'is_completed', o.status = 'completed',
            'completed_at', o.completed_at,
            'requires_photo', o.requires_photo,
            'has_proof', (
              o.proof_photo_storage_path IS NOT NULL
              AND trim(coalesce(o.proof_photo_storage_path, '')) <> ''
            ),
            'notes', o.notes,
            'is_suppressed', o.status = 'suppressed',
            'is_blocked', false,
            'assignment_status',
              CASE
                WHEN o.assigned_employee_id IS NULL THEN 'whole_shift'
                ELSE 'assigned'
              END
          )
          ORDER BY o.sort_order, o.id
        ),
        '[]'::jsonb
      )
      INTO v_override_flat
      FROM public.shift_run_override_tasks o
      WHERE o.run_id = v_run.id
        AND o.organization_id = p_organization_id
        AND (o.assigned_employee_id IS NULL OR o.assigned_employee_id = v_employee_id)
        AND o.status <> 'suppressed';

      v_items := v_items || v_override_flat;

      SELECT
        count(*) FILTER (WHERE o.status = 'completed')::int,
        count(*)::int
      INTO v_oc, v_ot
      FROM public.shift_run_override_tasks o
      WHERE o.run_id = v_run.id
        AND o.organization_id = p_organization_id
        AND (o.assigned_employee_id IS NULL OR o.assigned_employee_id = v_employee_id)
        AND o.status <> 'suppressed';

      SELECT o.id
      INTO v_next_override_id
      FROM public.shift_run_override_tasks o
      WHERE o.run_id = v_run.id
        AND o.organization_id = p_organization_id
        AND (o.assigned_employee_id IS NULL OR o.assigned_employee_id = v_employee_id)
        AND o.status = 'active'
      ORDER BY o.sort_order, o.id
      LIMIT 1;

      v_progress := jsonb_build_object(
        'completed', v_rc + v_oc,
        'total', v_rt + v_ot,
        'ratio',
          CASE
            WHEN (v_rt + v_ot) = 0 THEN 0::numeric
            ELSE round((v_rc + v_oc)::numeric / (v_rt + v_ot)::numeric, 4)
          END
      );

      IF v_next_id IS NOT NULL THEN
        v_next_any := jsonb_build_object('kind', 'run_item', 'id', v_next_id);
      ELSIF v_next_override_id IS NOT NULL THEN
        v_next_any := jsonb_build_object('kind', 'override', 'id', v_next_override_id);
      ELSE
        v_next_any := null;
      END IF;
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
      'bundle_version', 3,
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
            'next_incomplete_override_task_id', null,
            'next_incomplete', null,
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
            'next_incomplete_override_task_id', v_next_override_id,
            'next_incomplete', v_next_any,
            'no_run_reason', null
          )
      END,
    'announcements', jsonb_build_object(
      'items', v_announcements,
      'source', 'operational_messages',
      'todo', null
    ),
    'shift_notes', jsonb_build_object(
      'items', '[]'::jsonb,
      'source', 'none',
      'todo', 'Per-shift briefing not stored on employee_shifts yet. Options: add manager_note text; or operational_messages category shift_brief; surface here when available.'
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.hh_employee_today_bundle(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hh_employee_today_bundle(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hh_employee_today_bundle(uuid, text) TO service_role;

COMMENT ON FUNCTION public.hh_employee_today_bundle(uuid, text) IS
  'v3: Today bundle + shift_run_override_tasks (sections Extra tasks, combined progress, next_incomplete); item_kind on each row.';
