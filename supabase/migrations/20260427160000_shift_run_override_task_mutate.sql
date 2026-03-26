-- Employee execution on shift_run_override_tasks (parallel to hh_shift_checklist_run_item_mutate).
-- Audit: shift_run_override_task_events; problem/help: shift_run_override_task_escalations.

-- ---------------------------------------------------------------------------
-- proof_photo_storage_path: added in 20260427150000 (Today bundle v3); IF NOT EXISTS for older DBs.
ALTER TABLE public.shift_run_override_tasks
  ADD COLUMN IF NOT EXISTS proof_photo_storage_path text;

-- ---------------------------------------------------------------------------
-- Access helper (RLS + documentation; same assignment semantics as mutate RPC)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hh_user_can_access_override_task(p_org_id uuid, p_override_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT public.hh_is_org_member(auth.uid(), p_org_id) THEN false
    WHEN public.hh_is_org_manager(auth.uid(), p_org_id) THEN true
    WHEN public.hh_current_employee_id(p_org_id) IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.shift_run_override_tasks o
      JOIN public.shift_checklist_runs r ON r.id = o.run_id
      JOIN public.employee_shifts es ON es.id = r.employee_shift_id
      WHERE
        o.id = p_override_task_id
        AND o.organization_id = p_org_id
        AND (
          es.employee_id = public.hh_current_employee_id(p_org_id)
          OR o.assigned_employee_id = public.hh_current_employee_id(p_org_id)
        )
    )
  END;
$$;

COMMENT ON FUNCTION public.hh_user_can_access_override_task(uuid, uuid) IS
  'Manager: true. Employee: override run belongs to their shift or override is assigned to them.';

REVOKE ALL ON FUNCTION public.hh_user_can_access_override_task(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hh_user_can_access_override_task(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hh_user_can_access_override_task(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Audit events (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE public.shift_run_override_task_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  shift_checklist_run_id uuid NOT NULL REFERENCES public.shift_checklist_runs (id) ON DELETE CASCADE,
  shift_run_override_task_id uuid NOT NULL REFERENCES public.shift_run_override_tasks (id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  actor_employee_id uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (
    event_type IN (
      'completed',
      'reopened',
      'proof_set',
      'note_set',
      'problem_flagged',
      'help_requested',
      'problem_cleared',
      'help_cleared'
    )
  ),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shift_run_override_task_events_org_created_idx
  ON public.shift_run_override_task_events (organization_id, created_at DESC);
CREATE INDEX shift_run_override_task_events_task_idx
  ON public.shift_run_override_task_events (shift_run_override_task_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Escalations (problem / help)
-- ---------------------------------------------------------------------------
CREATE TABLE public.shift_run_override_task_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  shift_checklist_run_id uuid NOT NULL REFERENCES public.shift_checklist_runs (id) ON DELETE CASCADE,
  shift_run_override_task_id uuid NOT NULL REFERENCES public.shift_run_override_tasks (id) ON DELETE CASCADE,
  created_by_employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('problem', 'help')),
  message text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed', 'superseded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX shift_run_override_task_escalations_org_status_idx
  ON public.shift_run_override_task_escalations (organization_id, status, created_at DESC);
CREATE INDEX shift_run_override_task_escalations_task_idx
  ON public.shift_run_override_task_escalations (shift_run_override_task_id, kind, status);

CREATE TRIGGER shift_run_override_task_escalations_set_updated_at
  BEFORE UPDATE ON public.shift_run_override_task_escalations
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.shift_run_override_task_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_run_override_task_escalations ENABLE ROW LEVEL SECURITY;

CREATE POLICY shift_run_override_task_events_select
  ON public.shift_run_override_task_events FOR SELECT TO authenticated
  USING (
    public.hh_is_org_manager(auth.uid(), organization_id)
    OR public.hh_user_can_access_override_task(organization_id, shift_run_override_task_id)
  );

CREATE POLICY shift_run_override_task_escalations_select
  ON public.shift_run_override_task_escalations FOR SELECT TO authenticated
  USING (
    public.hh_is_org_manager(auth.uid(), organization_id)
    OR public.hh_user_can_access_override_task(organization_id, shift_run_override_task_id)
  );

CREATE POLICY shift_run_override_task_escalations_write_manager
  ON public.shift_run_override_task_escalations FOR ALL TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id))
  WITH CHECK (public.hh_user_can_manage_org(auth.uid(), organization_id));

GRANT SELECT ON public.shift_run_override_task_events TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.shift_run_override_task_events FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_run_override_task_escalations TO authenticated;

REVOKE ALL ON public.shift_run_override_task_events FROM anon;
REVOKE ALL ON public.shift_run_override_task_escalations FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_run_override_task_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_run_override_task_escalations TO service_role;

-- ---------------------------------------------------------------------------
-- Mutation RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hh_shift_run_override_task_mutate(
  p_organization_id uuid,
  p_override_task_id uuid,
  p_action text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_actor_employee_id uuid;
  v_ot public.shift_run_override_tasks%ROWTYPE;
  v_run public.shift_checklist_runs%ROWTYPE;
  v_es public.employee_shifts%ROWTYPE;
  v_note text;
  v_path text;
  v_msg text;
  v_expected timestamptz;
  v_idempotent boolean := false;
  v_esc_id uuid;
  v_event_id uuid;
  v_out jsonb;
  v_rowcount int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  IF p_action NOT IN (
    'complete', 'reopen', 'set_proof', 'set_note',
    'flag_problem', 'request_help', 'clear_problem', 'clear_help'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ACTION');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.user_id = v_uid AND m.organization_id = p_organization_id AND m.is_active = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_ORG_MEMBER');
  END IF;

  SELECT e.id INTO v_actor_employee_id
  FROM public.employees e
  WHERE e.organization_id = p_organization_id
    AND e.auth_user_id = v_uid
    AND e.is_active = true
  LIMIT 1;

  IF v_actor_employee_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'EMPLOYEE_NOT_LINKED');
  END IF;

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
    IF v_ot.assigned_employee_id <> v_actor_employee_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'NOT_ASSIGNED');
    END IF;
  ELSE
    IF v_es.employee_id <> v_actor_employee_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'NOT_ASSIGNED');
    END IF;
  END IF;

  v_expected := NULL;
  IF p_payload ? 'expected_updated_at' AND NULLIF(trim(p_payload->>'expected_updated_at'), '') IS NOT NULL THEN
    v_expected := (p_payload->>'expected_updated_at')::timestamptz;
    IF v_ot.updated_at IS DISTINCT FROM v_expected THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'VERSION_CONFLICT',
        'current_updated_at', to_jsonb(v_ot.updated_at)
      );
    END IF;
  END IF;

  IF p_action = 'complete' THEN
    IF v_ot.status = 'completed' THEN
      v_idempotent := true;
    ELSE
      IF v_ot.requires_photo = true AND (
        v_ot.proof_photo_storage_path IS NULL OR trim(v_ot.proof_photo_storage_path) = ''
      ) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'REQUIRES_PHOTO');
      END IF;
      UPDATE public.shift_run_override_tasks
      SET status = 'completed',
          completed_at = now(),
          updated_at = now()
      WHERE id = v_ot.id;
      INSERT INTO public.shift_run_override_task_events (
        organization_id, shift_checklist_run_id, shift_run_override_task_id,
        actor_user_id, actor_employee_id, event_type, payload
      ) VALUES (
        p_organization_id, v_run.id, v_ot.id, v_uid, v_actor_employee_id, 'completed',
        jsonb_build_object('completed_at', now())
      )
      RETURNING id INTO v_event_id;
    END IF;
  ELSIF p_action = 'reopen' THEN
    IF v_ot.status = 'active' THEN
      v_idempotent := true;
    ELSE
      UPDATE public.shift_run_override_tasks
      SET status = 'active',
          completed_at = NULL,
          updated_at = now()
      WHERE id = v_ot.id;
      INSERT INTO public.shift_run_override_task_events (
        organization_id, shift_checklist_run_id, shift_run_override_task_id,
        actor_user_id, actor_employee_id, event_type, payload
      ) VALUES (
        p_organization_id, v_run.id, v_ot.id, v_uid, v_actor_employee_id, 'reopened', '{}'::jsonb
      )
      RETURNING id INTO v_event_id;
    END IF;
  ELSIF p_action = 'set_proof' THEN
    v_path := nullif(trim(p_payload->>'storage_path'), '');
    IF v_path IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'MISSING_STORAGE_PATH');
    END IF;
    IF v_ot.proof_photo_storage_path IS NOT NULL AND trim(v_ot.proof_photo_storage_path) = v_path THEN
      v_idempotent := true;
    ELSE
      UPDATE public.shift_run_override_tasks
      SET proof_photo_storage_path = v_path,
          updated_at = now()
      WHERE id = v_ot.id;
      INSERT INTO public.shift_run_override_task_events (
        organization_id, shift_checklist_run_id, shift_run_override_task_id,
        actor_user_id, actor_employee_id, event_type, payload
      ) VALUES (
        p_organization_id, v_run.id, v_ot.id, v_uid, v_actor_employee_id, 'proof_set',
        jsonb_build_object('storage_path', v_path)
      )
      RETURNING id INTO v_event_id;
    END IF;
  ELSIF p_action = 'set_note' THEN
    IF NOT (p_payload ? 'note') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'MISSING_NOTE');
    END IF;
    v_note := nullif(trim(coalesce(p_payload->>'note', '')), '');
    IF v_note IS NOT NULL AND length(v_note) > 2000 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'NOTE_TOO_LONG');
    END IF;
    UPDATE public.shift_run_override_tasks
    SET notes = v_note,
        updated_at = now()
    WHERE id = v_ot.id;
    INSERT INTO public.shift_run_override_task_events (
      organization_id, shift_checklist_run_id, shift_run_override_task_id,
      actor_user_id, actor_employee_id, event_type, payload
    ) VALUES (
      p_organization_id, v_run.id, v_ot.id, v_uid, v_actor_employee_id, 'note_set',
      jsonb_build_object(
        'cleared', (v_note IS NULL),
        'note_length', coalesce(length(v_note), 0)
      )
    )
    RETURNING id INTO v_event_id;
  ELSIF p_action = 'flag_problem' THEN
    v_msg := nullif(trim(p_payload->>'message'), '');
    IF length(coalesce(v_msg, '')) > 2000 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'MESSAGE_TOO_LONG');
    END IF;
    UPDATE public.shift_run_override_task_escalations
    SET status = 'superseded', updated_at = now()
    WHERE shift_run_override_task_id = v_ot.id
      AND kind = 'problem'
      AND status = 'open';
    INSERT INTO public.shift_run_override_task_escalations (
      organization_id, shift_checklist_run_id, shift_run_override_task_id,
      created_by_employee_id, kind, message, status
    ) VALUES (
      p_organization_id, v_run.id, v_ot.id, v_actor_employee_id, 'problem', v_msg, 'open'
    )
    RETURNING id INTO v_esc_id;
    INSERT INTO public.shift_run_override_task_events (
      organization_id, shift_checklist_run_id, shift_run_override_task_id,
      actor_user_id, actor_employee_id, event_type, payload
    ) VALUES (
      p_organization_id, v_run.id, v_ot.id, v_uid, v_actor_employee_id, 'problem_flagged',
      jsonb_build_object('escalation_id', v_esc_id)
    )
    RETURNING id INTO v_event_id;
  ELSIF p_action = 'request_help' THEN
    v_msg := nullif(trim(p_payload->>'message'), '');
    IF length(coalesce(v_msg, '')) > 2000 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'MESSAGE_TOO_LONG');
    END IF;
    UPDATE public.shift_run_override_task_escalations
    SET status = 'superseded', updated_at = now()
    WHERE shift_run_override_task_id = v_ot.id
      AND kind = 'help'
      AND status = 'open';
    INSERT INTO public.shift_run_override_task_escalations (
      organization_id, shift_checklist_run_id, shift_run_override_task_id,
      created_by_employee_id, kind, message, status
    ) VALUES (
      p_organization_id, v_run.id, v_ot.id, v_actor_employee_id, 'help', v_msg, 'open'
    )
    RETURNING id INTO v_esc_id;
    INSERT INTO public.shift_run_override_task_events (
      organization_id, shift_checklist_run_id, shift_run_override_task_id,
      actor_user_id, actor_employee_id, event_type, payload
    ) VALUES (
      p_organization_id, v_run.id, v_ot.id, v_uid, v_actor_employee_id, 'help_requested',
      jsonb_build_object('escalation_id', v_esc_id)
    )
    RETURNING id INTO v_event_id;
  ELSIF p_action = 'clear_problem' THEN
    UPDATE public.shift_run_override_task_escalations
    SET status = 'resolved',
        resolved_at = now(),
        resolved_by_user_id = v_uid,
        updated_at = now()
    WHERE shift_run_override_task_id = v_ot.id
      AND kind = 'problem'
      AND status = 'open'
      AND created_by_employee_id = v_actor_employee_id;
    GET DIAGNOSTICS v_rowcount = ROW_COUNT;
    IF v_rowcount = 0 THEN
      v_idempotent := true;
    ELSE
      INSERT INTO public.shift_run_override_task_events (
        organization_id, shift_checklist_run_id, shift_run_override_task_id,
        actor_user_id, actor_employee_id, event_type, payload
      ) VALUES (
        p_organization_id, v_run.id, v_ot.id, v_uid, v_actor_employee_id, 'problem_cleared', '{}'::jsonb
      )
      RETURNING id INTO v_event_id;
    END IF;
  ELSIF p_action = 'clear_help' THEN
    UPDATE public.shift_run_override_task_escalations
    SET status = 'resolved',
        resolved_at = now(),
        resolved_by_user_id = v_uid,
        updated_at = now()
    WHERE shift_run_override_task_id = v_ot.id
      AND kind = 'help'
      AND status = 'open'
      AND created_by_employee_id = v_actor_employee_id;
    GET DIAGNOSTICS v_rowcount = ROW_COUNT;
    IF v_rowcount = 0 THEN
      v_idempotent := true;
    ELSE
      INSERT INTO public.shift_run_override_task_events (
        organization_id, shift_checklist_run_id, shift_run_override_task_id,
        actor_user_id, actor_employee_id, event_type, payload
      ) VALUES (
        p_organization_id, v_run.id, v_ot.id, v_uid, v_actor_employee_id, 'help_cleared', '{}'::jsonb
      )
      RETURNING id INTO v_event_id;
    END IF;
  END IF;

  SELECT to_jsonb(t.*) INTO v_out
  FROM public.shift_run_override_tasks t
  WHERE t.id = p_override_task_id;

  RETURN jsonb_build_object(
    'ok', true,
    'error', null,
    'idempotent', v_idempotent,
    'action', p_action,
    'override_task', v_out,
    'event_id', v_event_id,
    'escalation_id', v_esc_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.hh_shift_run_override_task_mutate(uuid, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hh_shift_run_override_task_mutate(uuid, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hh_shift_run_override_task_mutate(uuid, uuid, text, jsonb) TO service_role;

COMMENT ON FUNCTION public.hh_shift_run_override_task_mutate(uuid, uuid, text, jsonb) IS
  'Employee execution on shift_run_override_tasks.id. RUN_CLOSED when run completed/expired. Audit: shift_run_override_task_events; escalations: shift_run_override_task_escalations.';

COMMENT ON TABLE public.shift_run_override_task_events IS
  'Append-only audit for override task execution; inserted only from hh_shift_run_override_task_mutate.';

COMMENT ON TABLE public.shift_run_override_task_escalations IS
  'Problem/help escalations for override tasks; employee creates via RPC; managers resolve via policy.';
