-- Product-facing normalized request feed (read layer only).
-- Kinds: coverage | swap | open_shift_claim | task_transfer | schedule_change
-- Status: pending_manager | pending_employee | approved | denied | cancelled | expired
-- Urgency (from shift_date): high <= 1 day, normal <= 3 days, else low

CREATE OR REPLACE FUNCTION public.hh_request_urgency_from_shift_date(p_shift_date date)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_shift_date IS NULL THEN 'normal'::text
    WHEN (p_shift_date - CURRENT_DATE) < 0 THEN 'low'::text
    WHEN (p_shift_date - CURRENT_DATE) <= 1 THEN 'high'::text
    WHEN (p_shift_date - CURRENT_DATE) <= 3 THEN 'normal'::text
    ELSE 'low'::text
  END;
$$;

REVOKE ALL ON FUNCTION public.hh_request_urgency_from_shift_date(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hh_request_urgency_from_shift_date(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hh_request_urgency_from_shift_date(date) TO service_role;

-- Expanded rows: one row per operational request with stable id + involvement array for RPC filters.
CREATE OR REPLACE VIEW public.hh_request_feed
WITH (security_invoker = true) AS
WITH
  task AS (
    SELECT
      ('shift_task_transfer_requests/' || t.id::text) AS id,
      t.organization_id,
      'task_transfer'::text AS kind,
      t.id AS source_id,
      'shift_task_transfer_requests'::text AS source_table,
      t.reason,
      t.created_at,
      t.updated_at,
      es.shift_date AS shift_date,
      public.hh_request_urgency_from_shift_date(es.shift_date) AS urgency,
      jsonb_build_object(
        'employee_id', COALESCE(t.requested_by_employee_id, t.from_employee_id),
        'name', COALESCE(req_e.full_name, fe.full_name)
      ) AS requester,
      CASE
        WHEN t.to_employee_id IS NOT NULL THEN jsonb_build_object('employee_id', t.to_employee_id, 'name', te.full_name)
        ELSE NULL::jsonb
      END AS target_employee,
      jsonb_build_object(
        'employee_shift_id', es.id,
        'role', sr.name,
        'location_name', l.name,
        'start_time', es.starts_at,
        'end_time', es.ends_at
      ) AS shift,
      jsonb_build_object(
        'run_item_id', t.shift_checklist_run_item_id,
        'title', COALESCE(ri.task_text_snapshot, '(task)'),
        'request_mode', t.request_mode
      ) AS task,
      (
        CASE t.status
          WHEN 'approved' THEN 'approved'::text
          WHEN 'denied' THEN 'denied'::text
          WHEN 'cancelled' THEN 'cancelled'::text
          WHEN 'expired' THEN 'expired'::text
          WHEN 'declined' THEN 'denied'::text
          WHEN 'accepted' THEN
            CASE WHEN t.manager_approval_required THEN 'pending_manager'::text ELSE 'approved'::text END
          WHEN 'pending' THEN
            CASE
              WHEN t.to_employee_id IS NULL AND t.request_mode = 'open_offer' THEN 'pending_employee'::text
              WHEN t.manager_approval_required AND t.to_employee_id IS NOT NULL THEN 'pending_employee'::text
              WHEN t.manager_approval_required THEN 'pending_manager'::text
              ELSE 'pending_employee'::text
            END
          ELSE 'pending_employee'::text
        END
      ) AS status,
      (
        CASE t.status
          WHEN 'approved' THEN 'approved'::text
          WHEN 'denied' THEN 'denied'::text
          WHEN 'cancelled' THEN 'cancelled'::text
          WHEN 'expired' THEN 'expired'::text
          WHEN 'declined' THEN 'denied'::text
          WHEN 'accepted' THEN
            CASE WHEN t.manager_approval_required THEN 'pending_manager'::text ELSE 'approved'::text END
          WHEN 'pending' THEN
            CASE
              WHEN t.to_employee_id IS NULL AND t.request_mode = 'open_offer' THEN 'pending_employee'::text
              WHEN t.manager_approval_required AND t.to_employee_id IS NOT NULL THEN 'pending_employee'::text
              WHEN t.manager_approval_required THEN 'pending_manager'::text
              ELSE 'pending_employee'::text
            END
          ELSE 'pending_employee'::text
        END
      ) = 'pending_manager'::text AS manager_action_required,
      (
        CASE t.status
          WHEN 'approved' THEN 'approved'::text
          WHEN 'denied' THEN 'denied'::text
          WHEN 'cancelled' THEN 'cancelled'::text
          WHEN 'expired' THEN 'expired'::text
          WHEN 'declined' THEN 'denied'::text
          WHEN 'accepted' THEN
            CASE WHEN t.manager_approval_required THEN 'pending_manager'::text ELSE 'approved'::text END
          WHEN 'pending' THEN
            CASE
              WHEN t.to_employee_id IS NULL AND t.request_mode = 'open_offer' THEN 'pending_employee'::text
              WHEN t.manager_approval_required AND t.to_employee_id IS NOT NULL THEN 'pending_employee'::text
              WHEN t.manager_approval_required THEN 'pending_manager'::text
              ELSE 'pending_employee'::text
            END
          ELSE 'pending_employee'::text
        END
      ) = 'pending_employee'::text AS employee_action_required,
      t.request_mode::text AS source_request_type,
      ARRAY_REMOVE(ARRAY[
        COALESCE(t.requested_by_employee_id, t.from_employee_id),
        t.to_employee_id,
        t.from_employee_id
      ], NULL)::uuid[] AS involves_employees
    FROM public.shift_task_transfer_requests t
    JOIN public.shift_checklist_runs r ON r.id = t.run_id
    JOIN public.employee_shifts es ON es.id = r.employee_shift_id
    LEFT JOIN public.shift_checklist_run_items ri ON ri.id = t.shift_checklist_run_item_id
    LEFT JOIN public.employees req_e ON req_e.id = COALESCE(t.requested_by_employee_id, t.from_employee_id)
    LEFT JOIN public.employees fe ON fe.id = t.from_employee_id
    LEFT JOIN public.employees te ON te.id = t.to_employee_id
    LEFT JOIN public.staff_roles sr ON sr.id = es.staff_role_id
    LEFT JOIN public.locations l ON l.id = es.location_id
  ),
  cov AS (
    SELECT
      ('shift_coverage_requests/' || c.id::text) AS id,
      c.organization_id,
      (
        CASE c.request_type
          WHEN 'open_claim' THEN 'open_shift_claim'::text
          ELSE 'coverage'::text
        END
      ) AS kind,
      c.id AS source_id,
      'shift_coverage_requests'::text AS source_table,
      c.reason,
      c.created_at,
      c.updated_at,
      es.shift_date AS shift_date,
      public.hh_request_urgency_from_shift_date(es.shift_date) AS urgency,
      jsonb_build_object(
        'employee_id', c.requested_by_employee_id,
        'name', re.full_name
      ) AS requester,
      CASE
        WHEN COALESCE(c.claimed_by_employee_id, c.target_employee_id) IS NOT NULL THEN
          jsonb_build_object(
            'employee_id', COALESCE(c.claimed_by_employee_id, c.target_employee_id),
            'name', ce.full_name
          )
        ELSE NULL::jsonb
      END AS target_employee,
      jsonb_build_object(
        'employee_shift_id', es.id,
        'role', sr.name,
        'location_name', l.name,
        'start_time', es.starts_at,
        'end_time', es.ends_at
      ) AS shift,
      NULL::jsonb AS task,
      (
        CASE c.status
          WHEN 'approved' THEN 'approved'::text
          WHEN 'denied' THEN 'denied'::text
          WHEN 'cancelled' THEN 'cancelled'::text
          WHEN 'expired' THEN 'expired'::text
          WHEN 'claimed' THEN
            CASE WHEN c.manager_approval_required THEN 'pending_manager'::text ELSE 'approved'::text END
          WHEN 'accepted' THEN 'approved'::text
          WHEN 'pending' THEN 'pending_employee'::text
          ELSE 'pending_employee'::text
        END
      ) AS status,
      (
        CASE c.status
          WHEN 'approved' THEN 'approved'::text
          WHEN 'denied' THEN 'denied'::text
          WHEN 'cancelled' THEN 'cancelled'::text
          WHEN 'expired' THEN 'expired'::text
          WHEN 'claimed' THEN
            CASE WHEN c.manager_approval_required THEN 'pending_manager'::text ELSE 'approved'::text END
          WHEN 'accepted' THEN 'approved'::text
          WHEN 'pending' THEN 'pending_employee'::text
          ELSE 'pending_employee'::text
        END
      ) = 'pending_manager'::text AS manager_action_required,
      (
        CASE c.status
          WHEN 'approved' THEN 'approved'::text
          WHEN 'denied' THEN 'denied'::text
          WHEN 'cancelled' THEN 'cancelled'::text
          WHEN 'expired' THEN 'expired'::text
          WHEN 'claimed' THEN
            CASE WHEN c.manager_approval_required THEN 'pending_manager'::text ELSE 'approved'::text END
          WHEN 'accepted' THEN 'approved'::text
          WHEN 'pending' THEN 'pending_employee'::text
          ELSE 'pending_employee'::text
        END
      ) = 'pending_employee'::text AS employee_action_required,
      c.request_type::text AS source_request_type,
      ARRAY_REMOVE(ARRAY[
        c.requested_by_employee_id,
        c.claimed_by_employee_id,
        c.target_employee_id
      ], NULL)::uuid[] AS involves_employees
    FROM public.shift_coverage_requests c
    JOIN public.employee_shifts es ON es.id = c.employee_shift_id
    LEFT JOIN public.employees re ON re.id = c.requested_by_employee_id
    LEFT JOIN public.employees ce ON ce.id = COALESCE(c.claimed_by_employee_id, c.target_employee_id)
    LEFT JOIN public.staff_roles sr ON sr.id = es.staff_role_id
    LEFT JOIN public.locations l ON l.id = es.location_id
  ),
  trd AS (
    SELECT
      ('shift_trade_offers/' || tr.id::text) AS id,
      tr.organization_id,
      'swap'::text AS kind,
      tr.id AS source_id,
      'shift_trade_offers'::text AS source_table,
      tr.reason,
      tr.created_at,
      tr.updated_at,
      eso.shift_date AS shift_date,
      public.hh_request_urgency_from_shift_date(eso.shift_date) AS urgency,
      jsonb_build_object(
        'employee_id', tr.offering_employee_id,
        'name', oe.full_name
      ) AS requester,
      CASE
        WHEN COALESCE(tr.accepted_by_employee_id, tr.target_employee_id) IS NOT NULL THEN
          jsonb_build_object(
            'employee_id', COALESCE(tr.accepted_by_employee_id, tr.target_employee_id),
            'name', ae.full_name
          )
        ELSE NULL::jsonb
      END AS target_employee,
      jsonb_build_object(
        'employee_shift_id', eso.id,
        'role', sr.name,
        'location_name', l.name,
        'start_time', eso.starts_at,
        'end_time', eso.ends_at
      ) AS shift,
      NULL::jsonb AS task,
      (
        CASE tr.status
          WHEN 'approved' THEN 'approved'::text
          WHEN 'denied' THEN 'denied'::text
          WHEN 'cancelled' THEN 'cancelled'::text
          WHEN 'expired' THEN 'expired'::text
          WHEN 'accepted' THEN
            CASE WHEN tr.manager_approval_required THEN 'pending_manager'::text ELSE 'approved'::text END
          WHEN 'pending' THEN 'pending_employee'::text
          ELSE 'pending_employee'::text
        END
      ) AS status,
      (
        CASE tr.status
          WHEN 'approved' THEN 'approved'::text
          WHEN 'denied' THEN 'denied'::text
          WHEN 'cancelled' THEN 'cancelled'::text
          WHEN 'expired' THEN 'expired'::text
          WHEN 'accepted' THEN
            CASE WHEN tr.manager_approval_required THEN 'pending_manager'::text ELSE 'approved'::text END
          WHEN 'pending' THEN 'pending_employee'::text
          ELSE 'pending_employee'::text
        END
      ) = 'pending_manager'::text AS manager_action_required,
      (
        CASE tr.status
          WHEN 'approved' THEN 'approved'::text
          WHEN 'denied' THEN 'denied'::text
          WHEN 'cancelled' THEN 'cancelled'::text
          WHEN 'expired' THEN 'expired'::text
          WHEN 'accepted' THEN
            CASE WHEN tr.manager_approval_required THEN 'pending_manager'::text ELSE 'approved'::text END
          WHEN 'pending' THEN 'pending_employee'::text
          ELSE 'pending_employee'::text
        END
      ) = 'pending_employee'::text AS employee_action_required,
      NULL::text AS source_request_type,
      ARRAY_REMOVE(ARRAY[
        tr.offering_employee_id,
        tr.target_employee_id,
        tr.accepted_by_employee_id
      ], NULL)::uuid[] AS involves_employees
    FROM public.shift_trade_offers tr
    JOIN public.employee_shifts eso ON eso.id = tr.offered_shift_id
    LEFT JOIN public.employees oe ON oe.id = tr.offering_employee_id
    LEFT JOIN public.employees ae ON ae.id = COALESCE(tr.accepted_by_employee_id, tr.target_employee_id)
    LEFT JOIN public.staff_roles sr ON sr.id = eso.staff_role_id
    LEFT JOIN public.locations l ON l.id = eso.location_id
  )
SELECT * FROM task
UNION ALL
SELECT * FROM cov
UNION ALL
SELECT * FROM trd;

COMMENT ON VIEW public.hh_request_feed IS
  'Normalized request rows for product feeds. security_invoker. Extension: UNION schedule_change when a table exists.';

GRANT SELECT ON public.hh_request_feed TO authenticated;
GRANT SELECT ON public.hh_request_feed TO service_role;

-- Employee: caller must be linked to p_employee_id (auth.users).
CREATE OR REPLACE FUNCTION public.hh_employee_requests_feed(
  p_employee_id uuid,
  p_limit integer DEFAULT 150
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 150), 1), 500);
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = p_employee_id AND e.auth_user_id = auth.uid()
  ) THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(to_jsonb(sq) ORDER BY sq.updated_at DESC)
      FROM (
        SELECT
          f.id,
          f.organization_id,
          f.kind,
          f.status,
          f.urgency,
          f.created_at,
          f.updated_at,
          f.shift_date,
          f.requester,
          f.target_employee,
          f.shift,
          f.task,
          f.reason,
          f.manager_action_required,
          f.employee_action_required,
          f.source_table,
          f.source_id,
          f.source_request_type
        FROM public.hh_request_feed f
        WHERE p_employee_id = ANY (f.involves_employees)
        ORDER BY f.updated_at DESC
        LIMIT v_limit
      ) sq
    ),
    '[]'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.hh_employee_requests_feed(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hh_employee_requests_feed(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hh_employee_requests_feed(uuid, integer) TO service_role;

-- Manager: default only rows needing manager action; optional full history (still RLS-scoped).
CREATE OR REPLACE FUNCTION public.hh_manager_requests_feed(
  p_organization_id uuid,
  p_include_historical boolean DEFAULT false,
  p_limit integer DEFAULT 200
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_agg(to_jsonb(sq) ORDER BY sq.updated_at DESC)
      FROM (
        SELECT
          f.id,
          f.organization_id,
          f.kind,
          f.status,
          f.urgency,
          f.created_at,
          f.updated_at,
          f.shift_date,
          f.requester,
          f.target_employee,
          f.shift,
          f.task,
          f.reason,
          f.manager_action_required,
          f.employee_action_required,
          f.source_table,
          f.source_id,
          f.source_request_type
        FROM public.hh_request_feed f
        WHERE f.organization_id = p_organization_id
          AND (
            p_include_historical
            OR f.manager_action_required = true
          )
        ORDER BY f.updated_at DESC
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500)
      ) sq
    ),
    '[]'::jsonb
  );
$$;

REVOKE ALL ON FUNCTION public.hh_manager_requests_feed(uuid, boolean, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hh_manager_requests_feed(uuid, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hh_manager_requests_feed(uuid, boolean, integer) TO service_role;

COMMENT ON FUNCTION public.hh_employee_requests_feed(uuid, integer) IS
  'JSON array of normalized requests involving the employee; caller must be auth-linked to p_employee_id.';

COMMENT ON FUNCTION public.hh_manager_requests_feed(uuid, boolean, integer) IS
  'JSON array of normalized org requests; default manager_action_required only; p_include_historical for full list. RLS applies.';
