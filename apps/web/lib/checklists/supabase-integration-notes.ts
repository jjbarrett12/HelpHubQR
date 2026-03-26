/**
 * Checklist system — Supabase & OCR integration map (manager web app).
 *
 * **Hub** (`/app/checklists?hub=…`)
 * - Templates: `checklists`, `checklist_items`, `staff_roles`, `locations`
 * - Active runs / history: `shift_checklist_runs`, `employee_shifts`, `employees`
 * - Import queue: `imported_documents`, `imported_document_tasks`
 * - Taxonomy: deep-link to `/app/task-taxonomy` → `task_taxonomy`
 *
 * **Template builder** (`/app/checklists/templates/[id]`)
 * - Read/write `checklists` metadata; items in `checklist_items` (sort_order, task_key, requires_photo,
 *   section_title, duration_estimate_minutes — migration `20260324150000_checklist_sections_duration_run_proof.sql`)
 * - Actions: `app/app/helphub/actions/checklists.ts`, `task-taxonomy.ts` (bulk key apply)
 *
 * **Run review** (`/app/checklists/runs/[id]`)
 * - Loader: `lib/checklists/load-shift-run-review.ts` — joins `shift_checklist_run_items` + `checklist_items` +
 *   assignee `employees`
 * - Proof: `shift_checklist_run_items.proof_photo_storage_path` → TODO signed URL + thumbnail (private bucket)
 * - Overrides: `override_source`, `override_reason`, `suppressed`, `assignment_status`, `assigned_employee_id`
 * - Demo payload: `/app/checklists/runs/demo` → `lib/checklists/mock-data.ts`
 *
 * **Import pipeline** (`/app/checklists/import`, `/import/[documentId]`)
 * - Upload + OCR + AI: existing actions under `helphub/actions/import-checklist.ts` and storage paths
 * - TODO: section assignment in review UI — either `imported_document_tasks.section_label` column or
 *   client-only grouping before insert into `checklist_items.section_title`
 * - On promote: ensure new template opens at `/app/checklists/templates/[id]` (already wired)
 */

export const CHECKLIST_INTEGRATION_NOTES_VERSION = 1;
