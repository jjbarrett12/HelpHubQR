import { createHelpHubServiceClient } from "@/lib/helphub/supabase-service";
import type { QrDestinationContent, QrDestinationType } from "@/lib/qr/types";
import { isValidPublicQrSlug } from "@/lib/qr/slug";

export type PublicQrPayload = {
  code: { id: string; label: string; slug: string; organization_id: string };
  destination: {
    id: string;
    name: string;
    type: QrDestinationType;
    content: QrDestinationContent | null;
    target_checklist_id: string | null;
  };
  checklist?: { name: string; items: Array<{ task_text: string; sort_order: number }> };
};

/**
 * Load QR code + destination for public /qr/[slug]. Uses service role; slug is the only public identifier.
 * Enforces org consistency and active destination.
 */
export async function loadPublicQrBySlug(slug: string): Promise<PublicQrPayload | null> {
  if (!isValidPublicQrSlug(slug)) return null;

  let supabase: ReturnType<typeof createHelpHubServiceClient>;
  try {
    supabase = createHelpHubServiceClient();
  } catch {
    return null;
  }

  const codeRes = await supabase
    .from("qr_codes")
    .select("id, label, slug, organization_id, qr_destination_id")
    .eq("slug", slug)
    .maybeSingle();

  if (codeRes.error || !codeRes.data) return null;

  const code = codeRes.data as {
    id: string;
    label: string;
    slug: string;
    organization_id: string;
    qr_destination_id: string;
  };

  const destRes = await supabase
    .from("qr_destinations")
    .select("id, name, type, target_checklist_id, content, is_active, organization_id")
    .eq("id", code.qr_destination_id)
    .maybeSingle();

  if (destRes.error || !destRes.data) return null;

  const d = destRes.data as {
    id: string;
    name: string;
    type: string;
    target_checklist_id: string | null;
    content: QrDestinationContent | null;
    is_active: boolean;
    organization_id: string;
  };

  if (!d.is_active || d.organization_id !== code.organization_id) return null;

  const destination: PublicQrPayload["destination"] = {
    id: d.id,
    name: d.name,
    type: d.type as QrDestinationType,
    content: d.content,
    target_checklist_id: d.target_checklist_id,
  };

  const payload: PublicQrPayload = {
    code: {
      id: code.id,
      label: code.label,
      slug: code.slug,
      organization_id: code.organization_id,
    },
    destination,
  };

  if (destination.type === "checklist" && destination.target_checklist_id) {
    const clRes = await supabase
      .from("checklists")
      .select("id, name, organization_id")
      .eq("id", destination.target_checklist_id)
      .maybeSingle();
    const cl = clRes.data as { id: string; name: string; organization_id: string } | null;
    if (!cl || cl.organization_id !== code.organization_id) return null;

    const itemsRes = await supabase
      .from("checklist_items")
      .select("task_text, sort_order")
      .eq("checklist_id", cl.id)
      .order("sort_order", { ascending: true });
    if (itemsRes.error) return null;

    const items = (itemsRes.data ?? []) as Array<{ task_text: string; sort_order: number }>;
    payload.checklist = { name: cl.name, items };
  }

  return payload;
}
