-- P1: hh_manager_requests_feed — explicit org membership + manager gate for historical feed.
--     RLS on hh_request_feed remains; this adds defense in depth if policies drift or SECURITY DEFINER
--     callers are introduced later. Employees (org members, non-managers) may call with
--     p_include_historical = false and still see only rows RLS allows (their participation).
-- P2: hh_checklist_proof_upload_gate — same eligibility rules as proof-related paths in
--     hh_shift_checklist_run_item_mutate / hh_shift_run_override_task_mutate, for the signing
--     endpoint to call with the user JWT before service-role storage signing.

-- ---------------------------------------------------------------------------
-- Proof upload gate (INVOKER: uses auth.uid(); matches mutate preconditions for set_proof)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hh_checklist_proof_upload_gate(
  p_organization_id uuid,
  p_run_item_id uuid DEFAULT NULL,
  p_override_task_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_employee_id uuid;
  v_ri public.shift_checklist_run_items%ROWTYPE;
  v_run public.shift_checklist_runs%ROWTYPE;
  v_es public.employee_shifts%ROWTYPE;
  v_ot public.shift_run_override_tasks%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  IF (p_run_item_id IS NULL AND p_override_task_id IS NULL)
     OR (p_run_item_id IS NOT NULL AND p_override_task_id IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PAYLOAD');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.user_id = v_uid AND m.organization_id = p_organization_id AND m.is_active = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_ORG_MEMBER');
  END IF;

  SELECT e.id INTO v_employee_id
  FROM public.employees e
  WHERE e.organization_id = p_organization_id
    AND e.auth_user_id = v_uid
    AND e.is_active = true
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'EMPLOYEE_NOT_LINKED');
  END IF;

  IF p_run_item_id IS NOT NULL THEN
    SELECT ri.* INTO v_ri
    FROM public.shift_checklist_run_items ri
    JOIN public.shift_checklist_runs r ON r.id = ri.shift_checklist_run_id
    WHERE ri.id = p_run_item_id
      AND r.organization_id = p_organization_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'RUN_ITEM_NOT_FOUND');
    END IF;

    SELECT r.* INTO v_run
    FROM public.shift_checklist_runs r
    WHERE r.id = v_ri.shift_checklist_run_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'RUN_NOT_FOUND');
    END IF;

    IF v_run.status IN ('completed', 'expired') THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'RUN_CLOSED',
        'run_status', to_jsonb(v_run.status)
      );
    END IF;

    SELECT es.* INTO v_es
    FROM public.employee_shifts es
    WHERE es.id = v_run.employee_shift_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'SHIFT_NOT_FOUND');
    END IF;

    IF COALESCE(v_ri.suppressed, false) = true THEN
      RETURN jsonb_build_object('ok', false, 'error', 'ITEM_SUPPRESSED');
    END IF;

    IF v_ri.assigned_employee_id IS NOT NULL THEN
      IF v_ri.assigned_employee_id <> v_employee_id THEN
        RETURN jsonb_build_object('ok', false, 'error', 'NOT_ASSIGNED');
      END IF;
    ELSE
      IF v_es.employee_id <> v_employee_id THEN
        RETURN jsonb_build_object('ok', false, 'error', 'NOT_ASSIGNED');
      END IF;
    END IF;

    IF v_ri.assignment_status = 'declined' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'ASSIGNMENT_DECLINED');
    END IF;

    RETURN jsonb_build_object('ok', true, 'run_id', to_jsonb(v_run.id));
  END IF;

  -- Override task path (aligned with hh_shift_run_override_task_mutate)
  SELECT o.* INTO v_ot
  FROM public.shift_run_override_tasks o
  WHERE o.id = p_override_task_id
    AND o.organization_id = p_organization_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'OVERRIDE_TASK_NOT_FOUND');
  END IF;

  SELECT r.* INTO v_run
  FROM public.shift_checklist_runs r
  WHERE r.id = v_ot.run_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'RUN_NOT_FOUND');
  END IF;

  IF v_run.status IN ('completed', 'expired') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'RUN_CLOSED',
      'run_status', to_jsonb(v_run.status)
    );
  END IF;

  SELECT es.* INTO v_es
  FROM public.employee_shifts es
  WHERE es.id = v_run.employee_shift_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SHIFT_NOT_FOUND');
  END IF;

  IF v_ot.status = 'suppressed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'OVERRIDE_SUPPRESSED');
  END IF;

  IF v_ot.assigned_employee_id IS NOT NULL THEN
    IF v_ot.assigned_employee_id <> v_employee_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'NOT_ASSIGNED');
    END IF;
  ELSE
    IF v_es.employee_id <> v_employee_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'NOT_ASSIGNED');
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'run_id', to_jsonb(v_run.id));
END;
$$;

REVOKE ALL ON FUNCTION public.hh_checklist_proof_upload_gate(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hh_checklist_proof_upload_gate(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hh_checklist_proof_upload_gate(uuid, uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.hh_checklist_proof_upload_gate(uuid, uuid, uuid) IS
  'Pre-flight for checklist proof uploads: same org/assignment/run-open/suppression rules as mutate set_proof. Call with user JWT before service-role storage signing.';

-- ---------------------------------------------------------------------------
-- Manager request feed: membership + manager-only historical
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hh_manager_requests_feed(
  p_organization_id uuid,
  p_include_historical boolean DEFAULT false,
  p_limit integer DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF NOT public.hh_is_org_member(auth.uid(), p_organization_id) THEN
    RAISE EXCEPTION 'NOT_ORG_MEMBER'
      USING ERRCODE = '42501',
        HINT = 'Caller must be an active member of the organization.';
  END IF;

  IF p_include_historical AND NOT public.hh_is_org_manager(auth.uid(), p_organization_id) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED'
      USING ERRCODE = '42501',
        HINT = 'Full request history requires manager/admin role; use p_include_historical = false.';
  END IF;

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
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.hh_manager_requests_feed(uuid, boolean, integer) IS
  'JSON feed of normalized org requests. Requires hh_is_org_member; p_include_historical requires hh_is_org_manager (defense in depth on top of RLS on hh_request_feed).';
