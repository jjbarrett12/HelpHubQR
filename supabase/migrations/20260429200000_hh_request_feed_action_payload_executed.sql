-- Extend hh_request_feed: action_payload (approval intent), executed status, RPC columns.
-- Operational rows with DB status = approved are exposed as feed status executed (workflow complete).

CREATE OR REPLACE VIEW public.hh_request_feed
WITH (security_invoker = true) AS
SELECT
  s.id,
  s.organization_id,
  s.kind,
  CASE
    WHEN s.norm_status = 'approved'::text THEN 'executed'::text
    ELSE s.norm_status
  END AS status,
  s.urgency,
  s.created_at,
  s.updated_at,
  s.shift_date,
  s.requester,
  s.target_employee,
  s.shift,
  s.task,
  s.reason,
  (s.norm_status = 'pending_manager'::text) AS manager_action_required,
  (s.norm_status = 'pending_employee'::text) AS employee_action_required,
  s.source_table,
  s.source_id,
  s.source_request_type,
  s.action_payload,
  s.involves_employees
FROM (
  SELECT
    ('shift_task_transfer_requests/' || t.id::text) AS id,
    t.organization_id,
    'task_transfer'::text AS kind,
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
    ) AS norm_status,
    public.hh_request_urgency_from_shift_date(es.shift_date) AS urgency,
    t.created_at,
    t.updated_at,
    es.shift_date AS shift_date,
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
    t.reason,
    'shift_task_transfer_requests'::text AS source_table,
    t.id AS source_id,
    t.request_mode::text AS source_request_type,
    jsonb_build_object(
      'version', 1,
      'kind', 'task_transfer',
      'op', 'update_shift_checklist_run_items_assigned_employee',
      'shift_checklist_run_item_id', t.shift_checklist_run_item_id,
      'run_id', t.run_id,
      'from_employee_id', t.from_employee_id,
      'to_employee_id', t.to_employee_id,
      'manager_approval_required', t.manager_approval_required
    ) AS action_payload,
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

  UNION ALL

  SELECT
    ('shift_coverage_requests/' || c.id::text) AS id,
    c.organization_id,
    (
      CASE c.request_type
        WHEN 'open_claim' THEN 'open_shift_claim'::text
        ELSE 'coverage'::text
      END
    ) AS kind,
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
    ) AS norm_status,
    public.hh_request_urgency_from_shift_date(es.shift_date) AS urgency,
    c.created_at,
    c.updated_at,
    es.shift_date AS shift_date,
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
    c.reason,
    'shift_coverage_requests'::text AS source_table,
    c.id AS source_id,
    c.request_type::text AS source_request_type,
    jsonb_build_object(
      'version', 1,
      'kind',
      CASE WHEN c.request_type = 'open_claim' THEN 'open_shift_claim' ELSE 'coverage' END,
      'op', 'reassign_employee_shift',
      'employee_shift_id', c.employee_shift_id,
      'from_employee_id', es.employee_id,
      'to_employee_id', COALESCE(c.claimed_by_employee_id, c.target_employee_id),
      'request_type', c.request_type,
      'manager_approval_required', c.manager_approval_required
    ) AS action_payload,
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

  UNION ALL

  SELECT
    ('shift_trade_offers/' || tr.id::text) AS id,
    tr.organization_id,
    'swap'::text AS kind,
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
    ) AS norm_status,
    public.hh_request_urgency_from_shift_date(eso.shift_date) AS urgency,
    tr.created_at,
    tr.updated_at,
    eso.shift_date AS shift_date,
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
    tr.reason,
    'shift_trade_offers'::text AS source_table,
    tr.id AS source_id,
    NULL::text AS source_request_type,
    jsonb_build_object(
      'version', 1,
      'kind', 'swap',
      'op', 'swap_employee_shifts',
      'trade_id', tr.id,
      'offered_shift_id', tr.offered_shift_id,
      'requested_shift_id', tr.requested_shift_id,
      'offering_employee_id', tr.offering_employee_id,
      'counterparty_employee_id', COALESCE(tr.accepted_by_employee_id, tr.target_employee_id),
      'manager_approval_required', tr.manager_approval_required
    ) AS action_payload,
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
) s;

COMMENT ON VIEW public.hh_request_feed IS
  'Normalized request rows: status executed = operational approval applied; action_payload describes intended mutation. security_invoker.';

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
          f.source_request_type,
          f.action_payload
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
          f.source_request_type,
          f.action_payload
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
