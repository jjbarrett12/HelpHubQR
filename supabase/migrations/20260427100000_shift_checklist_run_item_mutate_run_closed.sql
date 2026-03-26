-- Harden hh_shift_checklist_run_item_mutate: block edits when the checklist run is finished or expired;
-- idempotent set_proof when storage path unchanged.
-- Audit remains on shift_checklist_run_item_events (no new table).

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
    IF v_ri.proof_photo_storage_path IS NOT NULL AND trim(v_ri.proof_photo_storage_path) = v_path THEN
      v_idempotent := true;
    ELSE
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
    END IF;
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

COMMENT ON FUNCTION public.hh_shift_checklist_run_item_mutate(uuid, uuid, text, jsonb) IS
  'Employee execution on shift_checklist_run_items.id. Rejects when shift_checklist_runs.status is completed/expired (RUN_CLOSED). Audit: shift_checklist_run_item_events.';
