/**
 * QR Hub — integration map
 *
 * **Data**
 * - `qr_destinations` — name, type (QrDestinationType), location_id, content jsonb, target_checklist_id, is_active, slug via `qr_codes` or resolver
 * - `locations` — workplace sites
 * - `qr_codes` — printed/issued instances linked to `qr_destination_id`
 * - Scan analytics: TODO table or ingest from `/q/[qrId]` / `/qr/[slug]` access logs
 *
 * **Hub types → DB**
 * - Product labels in UI may collapse to existing enum: sop, training, checklist, issue_report, help, announcement
 * - Add `hub_subtype` column later if you need finer taxonomy without enum explosion
 *
 * **Generation**
 * - Encode absolute URL to guest/staff route; use `qrcode` (npm) server-side or edge function
 * - Branding: tenant logo from organizations / delivery settings
 *
 * **Revalidation**
 * - `revalidatePath("/app/qr-hub")` on create/update/delete (see `helphub/actions/qr-hub.ts`)
 */

export const QR_HUB_INTEGRATION_VERSION = 1;
