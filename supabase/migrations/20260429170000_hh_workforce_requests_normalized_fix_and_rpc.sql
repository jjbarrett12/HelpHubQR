-- Fix hh_workforce_requests_normalized: coverage branch was missing from_employee_display_name (UNION column mismatch).
-- Refine coverage kind: direct_trade → coverage_direct_trade (provenance; still in shift_coverage_requests).
-- RPC: manager pending approvals slice for command center / compact inbox.

CREATE OR REPLACE VIEW public.hh_workforce_requests_normalized
WITH (security_invoker = true) AS
WITH
  task AS (
    SELECT
      ('shift_task_transfer_requests/' || t.id::text) AS id,
      t.id AS source_id,
      'shift_task_transfer_requests'::text AS raw_table,
      'task_transfer'::text AS kind,
      t.status AS raw_status,
      (
        CASE t.status
          WHEN 'approved' THEN 'approved'
          WHEN 'denied' THEN 'denied'
          WHEN 'cancelled' THEN 'cancelled'
          WHEN 'expired' THEN 'expired'
          WHEN 'declined' THEN 'denied'
          WHEN 'accepted' THEN
            CASE WHEN t.manager_approval_required THEN 'pending_manager'::text ELSE 'approved'::text END
          WHEN 'pending' THEN
            CASE
              WHEN t.to_employee_id IS NULL AND t.request_mode = 'open_offer' THEN 'pending_peer'::text
              WHEN t.manager_approval_required THEN 'pending_manager'::text
              ELSE 'pending_peer'::text
            END
          ELSE 'pending_peer'::text
        END
      ) AS product_status,
      (
        CASE
          WHEN t.expires_at IS NOT NULL AND t.expires_at <= now() + interval '2 hours' THEN 'urgent'::text
          WHEN t.expires_at IS NOT NULL AND t.expires_at <= now() + interval '24 hours' THEN 'soon'::text
          ELSE 'normal'::text
        END
      ) AS urgency,
      t.organization_id,
      COALESCE(t.requested_by_employee_id, t.from_employee_id) AS requester_employee_id,
      t.to_employee_id AS counterparty_employee_id,
      (SELECT e.full_name FROM public.employees e WHERE e.id = COALESCE(t.requested_by_employee_id, t.from_employee_id) LIMIT 1) AS requester_display_name,
      (SELECT e.full_name FROM public.employees e WHERE e.id = t.to_employee_id LIMIT 1) AS counterparty_display_name,
      (SELECT e.full_name FROM public.employees e WHERE e.id = t.from_employee_id LIMIT 1) AS from_employee_display_name,
      t.manager_approval_required,
      (
        (
          CASE t.status
            WHEN 'approved' THEN 'approved'
            WHEN 'denied' THEN 'denied'
            WHEN 'cancelled' THEN 'cancelled'
            WHEN 'expired' THEN 'expired'
            WHEN 'declined' THEN 'denied'
            WHEN 'accepted' THEN
              CASE WHEN t.manager_approval_required THEN 'pending_manager'::text ELSE 'approved'::text END
            WHEN 'pending' THEN
              CASE
                WHEN t.to_employee_id IS NULL AND t.request_mode = 'open_offer' THEN 'pending_peer'::text
                WHEN t.manager_approval_required THEN 'pending_manager'::text
                ELSE 'pending_peer'::text
              END
            ELSE 'pending_peer'::text
          END
        ) = 'pending_manager'::text
      ) AS manager_action_required,
      COALESCE(
        (SELECT ri.task_text_snapshot FROM public.shift_checklist_run_items ri WHERE ri.id = t.shift_checklist_run_item_id LIMIT 1),
        '(task)'
      ) AS context_summary,
      t.created_at AS submitted_at,
      t.updated_at,
      t.expires_at,
      jsonb_build_object(
        'shift_checklist_run_id', t.run_id,
        'shift_checklist_run_item_id', t.shift_checklist_run_item_id
      ) AS related,
      jsonb_build_object(
        'request_mode', t.request_mode,
        'from_employee_id', t.from_employee_id,
        'to_employee_id', t.to_employee_id,
        'reason', t.reason
      ) AS source_detail,
      NULL::jsonb AS fairness_advisory
    FROM public.shift_task_transfer_requests t
  ),
  cov AS (
    SELECT
      ('shift_coverage_requests/' || c.id::text) AS id,
      c.id AS source_id,
      'shift_coverage_requests'::text AS raw_table,
      (
        CASE c.request_type
          WHEN 'open_claim' THEN 'open_shift_pickup'::text
          WHEN 'direct_trade' THEN 'coverage_direct_trade'::text
          ELSE 'coverage'::text
        END
      ) AS kind,
      c.status AS raw_status,
      (
        CASE c.status
          WHEN 'approved' THEN 'approved'
          WHEN 'denied' THEN 'denied'
          WHEN 'cancelled' THEN 'cancelled'
          WHEN 'expired' THEN 'expired'
          WHEN 'claimed' THEN
            CASE WHEN c.manager_approval_required THEN 'pending_manager'::text ELSE 'approved'::text END
          WHEN 'accepted' THEN 'approved'::text
          WHEN 'pending' THEN 'pending_peer'::text
          ELSE 'pending_peer'::text
        END
      ) AS product_status,
      (
        CASE
          WHEN c.expires_at IS NOT NULL AND c.expires_at <= now() + interval '2 hours' THEN 'urgent'::text
          WHEN c.expires_at IS NOT NULL AND c.expires_at <= now() + interval '24 hours' THEN 'soon'::text
          ELSE 'normal'::text
        END
      ) AS urgency,
      c.organization_id,
      c.requested_by_employee_id AS requester_employee_id,
      COALESCE(c.claimed_by_employee_id, c.target_employee_id) AS counterparty_employee_id,
      (SELECT e.full_name FROM public.employees e WHERE e.id = c.requested_by_employee_id LIMIT 1) AS requester_display_name,
      (
        SELECT e.full_name FROM public.employees e
        WHERE e.id = COALESCE(c.claimed_by_employee_id, c.target_employee_id) LIMIT 1
      ) AS counterparty_display_name,
      NULL::text AS from_employee_display_name,
      c.manager_approval_required,
      (
        (
          CASE c.status
            WHEN 'approved' THEN 'approved'
            WHEN 'denied' THEN 'denied'
            WHEN 'cancelled' THEN 'cancelled'
            WHEN 'expired' THEN 'expired'
            WHEN 'claimed' THEN
              CASE WHEN c.manager_approval_required THEN 'pending_manager'::text ELSE 'approved'::text END
            WHEN 'accepted' THEN 'approved'::text
            WHEN 'pending' THEN 'pending_peer'::text
            ELSE 'pending_peer'::text
          END
        ) = 'pending_manager'::text
      ) AS manager_action_required,
      CONCAT_WS(
        ' · ',
        COALESCE(to_char(es.shift_date, 'YYYY-MM-DD'), '?'),
        COALESCE(es.shift_type::text, ''),
        COALESCE(c.request_type::text, '')
      ) AS context_summary,
      c.created_at AS submitted_at,
      c.updated_at,
      c.expires_at,
      jsonb_build_object(
        'employee_shift_id', c.employee_shift_id
      ) AS related,
      jsonb_build_object(
        'request_type', c.request_type,
        'reason', c.reason,
        'claimed_by_employee_id', c.claimed_by_employee_id,
        'target_employee_id', c.target_employee_id
      ) AS source_detail,
      NULL::jsonb AS fairness_advisory
    FROM public.shift_coverage_requests c
    JOIN public.employee_shifts es ON es.id = c.employee_shift_id
  ),
  trd AS (
    SELECT
      ('shift_trade_offers/' || tr.id::text) AS id,
      tr.id AS source_id,
      'shift_trade_offers'::text AS raw_table,
      'shift_swap'::text AS kind,
      tr.status AS raw_status,
      (
        CASE tr.status
          WHEN 'approved' THEN 'approved'
          WHEN 'denied' THEN 'denied'
          WHEN 'cancelled' THEN 'cancelled'
          WHEN 'expired' THEN 'expired'
          WHEN 'accepted' THEN
            CASE WHEN tr.manager_approval_required THEN 'pending_manager'::text ELSE 'approved'::text END
          WHEN 'pending' THEN 'pending_peer'::text
          ELSE 'pending_peer'::text
        END
      ) AS product_status,
      'normal'::text AS urgency,
      tr.organization_id,
      tr.offering_employee_id AS requester_employee_id,
      COALESCE(tr.accepted_by_employee_id, tr.target_employee_id) AS counterparty_employee_id,
      (SELECT e.full_name FROM public.employees e WHERE e.id = tr.offering_employee_id LIMIT 1) AS requester_display_name,
      (
        SELECT e.full_name FROM public.employees e
        WHERE e.id = COALESCE(tr.accepted_by_employee_id, tr.target_employee_id) LIMIT 1
      ) AS counterparty_display_name,
      NULL::text AS from_employee_display_name,
      tr.manager_approval_required,
      (
        (
          CASE tr.status
            WHEN 'approved' THEN 'approved'
            WHEN 'denied' THEN 'denied'
            WHEN 'cancelled' THEN 'cancelled'
            WHEN 'expired' THEN 'expired'
            WHEN 'accepted' THEN
              CASE WHEN tr.manager_approval_required THEN 'pending_manager'::text ELSE 'approved'::text END
            WHEN 'pending' THEN 'pending_peer'::text
            ELSE 'pending_peer'::text
          END
        ) = 'pending_manager'::text
      ) AS manager_action_required,
      CONCAT_WS(
        ' · ',
        COALESCE(to_char(eso.shift_date, 'YYYY-MM-DD'), '?'),
        COALESCE(eso.shift_type::text, ''),
        CASE WHEN tr.requested_shift_id IS NOT NULL THEN 'swap' ELSE 'offer' END
      ) AS context_summary,
      tr.created_at AS submitted_at,
      tr.updated_at,
      NULL::timestamptz AS expires_at,
      jsonb_build_object(
        'offered_shift_id', tr.offered_shift_id,
        'requested_shift_id', tr.requested_shift_id
      ) AS related,
      jsonb_build_object(
        'reason', tr.reason,
        'target_employee_id', tr.target_employee_id,
        'accepted_by_employee_id', tr.accepted_by_employee_id
      ) AS source_detail,
      NULL::jsonb AS fairness_advisory
    FROM public.shift_trade_offers tr
    JOIN public.employee_shifts eso ON eso.id = tr.offered_shift_id
  )
SELECT * FROM task
UNION ALL
SELECT * FROM cov
UNION ALL
SELECT * FROM trd;

COMMENT ON VIEW public.hh_workforce_requests_normalized IS
  'Unified workforce request read model: task_transfer, coverage (direct_cover), coverage_direct_trade (shift_coverage_requests.direct_trade), open_shift_pickup, shift_swap. Composite id = raw_table/source_uuid. security_invoker applies underlying RLS. Extension: UNION more sources or add RPC filter; do not replace raw tables.';

-- Pending manager slice (normalized rows where manager_action_required). SECURITY INVOKER + view RLS.
CREATE OR REPLACE FUNCTION public.hh_workforce_requests_pending_manager_json(
  p_organization_id uuid,
  p_limit integer DEFAULT 25
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
        SELECT *
        FROM public.hh_workforce_requests_normalized r
        WHERE r.organization_id = p_organization_id
          AND r.manager_action_required = true
        ORDER BY r.updated_at DESC
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 200)
      ) sq
    ),
    '[]'::jsonb
  );
$$;

REVOKE ALL ON FUNCTION public.hh_workforce_requests_pending_manager_json(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hh_workforce_requests_pending_manager_json(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hh_workforce_requests_pending_manager_json(uuid, integer) TO service_role;

COMMENT ON FUNCTION public.hh_workforce_requests_pending_manager_json(uuid, integer) IS
  'Returns JSON array of normalized workforce rows needing manager action for an org. Uses caller RLS on the view.';
