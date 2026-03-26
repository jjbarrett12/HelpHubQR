-- Execution mutations for shift_checklist_run_items: audit trail + escalations (problem / help).
-- All employee writes go through hh_shift_checklist_run_item_mutate (SECURITY DEFINER).
-- Templates (checklists / checklist_items) are never updated here.

-- ---------------------------------------------------------------------------
-- Audit: append-only events
-- ---------------------------------------------------------------------------
CREATE TABLE public.shift_checklist_run_item_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  shift_checklist_run_id uuid NOT NULL REFERENCES public.shift_checklist_runs (id) ON DELETE CASCADE,
  shift_checklist_run_item_id uuid NOT NULL REFERENCES public.shift_checklist_run_items (id) ON DELETE CASCADE,
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

CREATE INDEX shift_checklist_run_item_events_org_created_idx
  ON public.shift_checklist_run_item_events (organization_id, created_at DESC);
CREATE INDEX shift_checklist_run_item_events_item_idx
  ON public.shift_checklist_run_item_events (shift_checklist_run_item_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Escalations: durable sinks for flag_problem / request_help
-- ---------------------------------------------------------------------------
CREATE TABLE public.shift_checklist_run_item_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  shift_checklist_run_id uuid NOT NULL REFERENCES public.shift_checklist_runs (id) ON DELETE CASCADE,
  shift_checklist_run_item_id uuid NOT NULL REFERENCES public.shift_checklist_run_items (id) ON DELETE CASCADE,
  created_by_employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('problem', 'help')),
  message text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed', 'superseded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX shift_checklist_run_item_escalations_org_status_idx
  ON public.shift_checklist_run_item_escalations (organization_id, status, created_at DESC);
CREATE INDEX shift_checklist_run_item_escalations_item_idx
  ON public.shift_checklist_run_item_escalations (shift_checklist_run_item_id, kind, status);

CREATE TRIGGER shift_checklist_run_item_escalations_set_updated_at
  BEFORE UPDATE ON public.shift_checklist_run_item_escalations
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: read for org members; writes only via SECURITY DEFINER RPC (no insert policy)
-- ---------------------------------------------------------------------------
ALTER TABLE public.shift_checklist_run_item_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_checklist_run_item_escalations ENABLE ROW LEVEL SECURITY;

CREATE POLICY shift_checklist_run_item_events_select_member
  ON public.shift_checklist_run_item_events FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.hh_org_ids_for_user(auth.uid())));

CREATE POLICY shift_checklist_run_item_escalations_select_member
  ON public.shift_checklist_run_item_escalations FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.hh_org_ids_for_user(auth.uid())));

CREATE POLICY shift_checklist_run_item_escalations_write_manager
  ON public.shift_checklist_run_item_escalations FOR ALL TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id))
  WITH CHECK (public.hh_user_can_manage_org(auth.uid(), organization_id));

GRANT SELECT ON public.shift_checklist_run_item_events TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.shift_checklist_run_item_events FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_checklist_run_item_escalations TO authenticated;

-- ---------------------------------------------------------------------------
-- Mutation RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hh_shift_checklist_run_item_mutate(
  p_organization_id uuid,
  p_run_item_id uuid,
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
  v_ri public.shift_checklist_run_items%ROWTYPE;
  v_run public.shift_checklist_runs%ROWTYPE;
  v_es public.employee_shifts%ROWTYPE;
  v_requires_photo boolean := false;
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

  SELECT es.* INTO v_es
  FROM public.employee_shifts es
  WHERE es.id = v_run.employee_shift_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SHIFT_NOT_FOUND');
  END IF;

  -- Assignment: item assignee wins; else shift owner
  IF COALESCE(v_ri.suppressed, false) = true THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ITEM_SUPPRESSED');
  END IF;

  IF v_ri.assigned_employee_id IS NOT NULL THEN
    IF v_ri.assigned_employee_id <> v_actor_employee_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'NOT_ASSIGNED');
    END IF;
  ELSE
    IF v_es.employee_id <> v_actor_employee_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'NOT_ASSIGNED');
    END IF;
  END IF;

  IF v_ri.assignment_status = 'declined' AND p_action IN ('complete', 'set_proof') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ASSIGNMENT_DECLINED');
  END IF;

  v_expected := NULL;
  IF p_payload ? 'expected_updated_at' AND NULLIF(trim(p_payload->>'expected_updated_at'), '') IS NOT NULL THEN
    v_expected := (p_payload->>'expected_updated_at')::timestamptz;
    IF v_ri.updated_at IS DISTINCT FROM v_expected THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'VERSION_CONFLICT',
        'current_updated_at', to_jsonb(v_ri.updated_at)
      );
    END IF;
  END IF;

  SELECT COALESCE(ci.requires_photo, false) INTO v_requires_photo
  FROM public.checklist_items ci
  WHERE ci.id = v_ri.checklist_item_id;

  IF p_action = 'complete' THEN
    IF v_ri.completed = true THEN
      v_idempotent := true;
    ELSE
      IF v_requires_photo AND (
        v_ri.proof_photo_storage_path IS NULL OR trim(v_ri.proof_photo_storage_path) = ''
      ) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'REQUIRES_PHOTO');
      END IF;
      UPDATE public.shift_checklist_run_items
      SET completed = true,
          completed_at = now(),
          updated_at = now()
      WHERE id = v_ri.id;
      INSERT INTO public.shift_checklist_run_item_events (
        organization_id, shift_checklist_run_id, shift_checklist_run_item_id,
        actor_user_id, actor_employee_id, event_type, payload
      ) VALUES (
        p_organization_id, v_run.id, v_ri.id, v_uid, v_actor_employee_id, 'completed',
        jsonb_build_object('completed_at', now())
      )
      RETURNING id INTO v_event_id;
    END IF;
  ELSIF p_action = 'reopen' THEN
    IF v_ri.completed = false THEN
      v_idempotent := true;
    ELSE
      UPDATE public.shift_checklist_run_items
      SET completed = false,
          completed_at = NULL,
          updated_at = now()
      WHERE id = v_ri.id;
      INSERT INTO public.shift_checklist_run_item_events (
        organization_id, shift_checklist_run_id, shift_checklist_run_item_id,
        actor_user_id, actor_employee_id, event_type, payload
      ) VALUES (
        p_organization_id, v_run.id, v_ri.id, v_uid, v_actor_employee_id, 'reopened', '{}'::jsonb
      )
      RETURNING id INTO v_event_id;
    END IF;
  ELSIF p_action = 'set_proof' THEN
    v_path := nullif(trim(p_payload->>'storage_path'), '');
    IF v_path IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'MISSING_STORAGE_PATH');
    END IF;
    UPDATE public.shift_checklist_run_items
    SET proof_photo_storage_path = v_path,
        updated_at = now()
    WHERE id = v_ri.id;
    INSERT INTO public.shift_checklist_run_item_events (
      organization_id, shift_checklist_run_id, shift_checklist_run_item_id,
      actor_user_id, actor_employee_id, event_type, payload
    ) VALUES (
      p_organization_id, v_run.id, v_ri.id, v_uid, v_actor_employee_id, 'proof_set',
      jsonb_build_object('storage_path', v_path)
    )
    RETURNING id INTO v_event_id;
  ELSIF p_action = 'set_note' THEN
    IF NOT (p_payload ? 'note') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'MISSING_NOTE');
    END IF;
    v_note := nullif(trim(coalesce(p_payload->>'note', '')), '');
    IF v_note IS NOT NULL AND length(v_note) > 2000 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'NOTE_TOO_LONG');
    END IF;
    UPDATE public.shift_checklist_run_items
    SET notes = v_note,
        updated_at = now()
    WHERE id = v_ri.id;
    INSERT INTO public.shift_checklist_run_item_events (
      organization_id, shift_checklist_run_id, shift_checklist_run_item_id,
      actor_user_id, actor_employee_id, event_type, payload
    ) VALUES (
      p_organization_id, v_run.id, v_ri.id, v_uid, v_actor_employee_id, 'note_set',
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
    UPDATE public.shift_checklist_run_item_escalations
    SET status = 'superseded', updated_at = now()
    WHERE shift_checklist_run_item_id = v_ri.id
      AND kind = 'problem'
      AND status = 'open';
    INSERT INTO public.shift_checklist_run_item_escalations (
      organization_id, shift_checklist_run_id, shift_checklist_run_item_id,
      created_by_employee_id, kind, message, status
    ) VALUES (
      p_organization_id, v_run.id, v_ri.id, v_actor_employee_id, 'problem', v_msg, 'open'
    )
    RETURNING id INTO v_esc_id;
    INSERT INTO public.shift_checklist_run_item_events (
      organization_id, shift_checklist_run_id, shift_checklist_run_item_id,
      actor_user_id, actor_employee_id, event_type, payload
    ) VALUES (
      p_organization_id, v_run.id, v_ri.id, v_uid, v_actor_employee_id, 'problem_flagged',
      jsonb_build_object('escalation_id', v_esc_id)
    )
    RETURNING id INTO v_event_id;
  ELSIF p_action = 'request_help' THEN
    v_msg := nullif(trim(p_payload->>'message'), '');
    IF length(coalesce(v_msg, '')) > 2000 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'MESSAGE_TOO_LONG');
    END IF;
    UPDATE public.shift_checklist_run_item_escalations
    SET status = 'superseded', updated_at = now()
    WHERE shift_checklist_run_item_id = v_ri.id
      AND kind = 'help'
      AND status = 'open';
    INSERT INTO public.shift_checklist_run_item_escalations (
      organization_id, shift_checklist_run_id, shift_checklist_run_item_id,
      created_by_employee_id, kind, message, status
    ) VALUES (
      p_organization_id, v_run.id, v_ri.id, v_actor_employee_id, 'help', v_msg, 'open'
    )
    RETURNING id INTO v_esc_id;
    INSERT INTO public.shift_checklist_run_item_events (
      organization_id, shift_checklist_run_id, shift_checklist_run_item_id,
      actor_user_id, actor_employee_id, event_type, payload
    ) VALUES (
      p_organization_id, v_run.id, v_ri.id, v_uid, v_actor_employee_id, 'help_requested',
      jsonb_build_object('escalation_id', v_esc_id)
    )
    RETURNING id INTO v_event_id;
  ELSIF p_action = 'clear_problem' THEN
    UPDATE public.shift_checklist_run_item_escalations
    SET status = 'resolved',
        resolved_at = now(),
        resolved_by_user_id = v_uid,
        updated_at = now()
    WHERE shift_checklist_run_item_id = v_ri.id
      AND kind = 'problem'
      AND status = 'open'
      AND created_by_employee_id = v_actor_employee_id;
    GET DIAGNOSTICS v_rowcount = ROW_COUNT;
    IF v_rowcount = 0 THEN
      v_idempotent := true;
    ELSE
      INSERT INTO public.shift_checklist_run_item_events (
        organization_id, shift_checklist_run_id, shift_checklist_run_item_id,
        actor_user_id, actor_employee_id, event_type, payload
      ) VALUES (
        p_organization_id, v_run.id, v_ri.id, v_uid, v_actor_employee_id, 'problem_cleared', '{}'::jsonb
      )
      RETURNING id INTO v_event_id;
    END IF;
  ELSIF p_action = 'clear_help' THEN
    UPDATE public.shift_checklist_run_item_escalations
    SET status = 'resolved',
        resolved_at = now(),
        resolved_by_user_id = v_uid,
        updated_at = now()
    WHERE shift_checklist_run_item_id = v_ri.id
      AND kind = 'help'
      AND status = 'open'
      AND created_by_employee_id = v_actor_employee_id;
    GET DIAGNOSTICS v_rowcount = ROW_COUNT;
    IF v_rowcount = 0 THEN
      v_idempotent := true;
    ELSE
      INSERT INTO public.shift_checklist_run_item_events (
        organization_id, shift_checklist_run_id, shift_checklist_run_item_id,
        actor_user_id, actor_employee_id, event_type, payload
      ) VALUES (
        p_organization_id, v_run.id, v_ri.id, v_uid, v_actor_employee_id, 'help_cleared', '{}'::jsonb
      )
      RETURNING id INTO v_event_id;
    END IF;
  END IF;

  SELECT to_jsonb(ri.*) INTO v_out
  FROM public.shift_checklist_run_items ri
  WHERE ri.id = p_run_item_id;

  RETURN jsonb_build_object(
    'ok', true,
    'error', null,
    'idempotent', v_idempotent,
    'action', p_action,
    'run_item', v_out,
    'event_id', v_event_id,
    'escalation_id', v_esc_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.hh_shift_checklist_run_item_mutate(uuid, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hh_shift_checklist_run_item_mutate(uuid, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hh_shift_checklist_run_item_mutate(uuid, uuid, text, jsonb) TO service_role;

COMMENT ON FUNCTION public.hh_shift_checklist_run_item_mutate IS
  'Employee execution mutations on shift_checklist_run_items (by run item id). Validates org + assignment. Audit in shift_checklist_run_item_events; problem/help in shift_checklist_run_item_escalations.';

COMMENT ON TABLE public.shift_checklist_run_item_events IS
  'Append-only audit for run item execution; inserted only from hh_shift_checklist_run_item_mutate.';

COMMENT ON TABLE public.shift_checklist_run_item_escalations IS
  'Open problems / help requests tied to a run item; managers may also update via RLS.';
