-- Workforce coordination: duplicate-request prevention, atomic shift swap, query indexes

-- ---------------------------------------------------------------------------
-- One active coverage row per shift (pending or claimed awaiting manager)
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS shift_coverage_requests_shift_active_uidx
  ON public.shift_coverage_requests (employee_shift_id)
  WHERE status IN ('pending', 'claimed', 'approved');

-- ---------------------------------------------------------------------------
-- One active task-transfer pipeline per run item
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS shift_task_transfer_requests_item_active_uidx
  ON public.shift_task_transfer_requests (shift_checklist_run_item_id)
  WHERE status IN ('pending', 'accepted');

-- ---------------------------------------------------------------------------
-- Atomic swap of employee_id between two shifts (avoids half-applied trades)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hh_atomic_swap_shift_employees(p_shift_a uuid, p_shift_b uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_a uuid;
  v_b uuid;
BEGIN
  IF p_shift_a IS NULL OR p_shift_b IS NULL OR p_shift_a = p_shift_b THEN
    RAISE EXCEPTION 'invalid_shift_pair';
  END IF;

  SELECT employee_id INTO v_a FROM public.employee_shifts WHERE id = p_shift_a FOR UPDATE;
  SELECT employee_id INTO v_b FROM public.employee_shifts WHERE id = p_shift_b FOR UPDATE;

  IF v_a IS NULL OR v_b IS NULL THEN
    RAISE EXCEPTION 'shift_not_found';
  END IF;

  UPDATE public.employee_shifts SET employee_id = v_b, updated_at = now() WHERE id = p_shift_a;
  UPDATE public.employee_shifts SET employee_id = v_a, updated_at = now() WHERE id = p_shift_b;
END;
$$;

REVOKE ALL ON FUNCTION public.hh_atomic_swap_shift_employees(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hh_atomic_swap_shift_employees(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.hh_atomic_swap_shift_employees(uuid, uuid) TO postgres;

-- ---------------------------------------------------------------------------
-- Manager / shift-ops listing performance
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS shift_task_transfer_requests_org_status_created_idx
  ON public.shift_task_transfer_requests (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS shift_coverage_requests_org_status_created_idx
  ON public.shift_coverage_requests (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS shift_trade_offers_org_status_created_idx
  ON public.shift_trade_offers (organization_id, status, created_at DESC);
