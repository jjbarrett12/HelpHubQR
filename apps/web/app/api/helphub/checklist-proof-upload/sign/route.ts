import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import { checklistProofUploadSignBodySchema } from "@/lib/validation/schemas";
import { createSupabaseForRouteHandler } from "@/lib/supabase/route-handler-client";
import {
  proofGateErrorToHttp,
  runChecklistProofUploadGate,
} from "@/lib/helphub/checklist-proof-gate";
import { checkProofSignRateLimit } from "@/lib/rateLimitDistributed";
import { logServerEvent } from "@/lib/observability/server-log";

const BUCKET = process.env.UPLOAD_BUCKET ?? "proof";

/**
 * Employee-signed upload URL for checklist run-item or override-task proof photos.
 * Client PUTs image bytes to `signedUrl`, then calls mutate `set_proof` with returned `path`.
 * Authorization: `hh_checklist_proof_upload_gate` with the user JWT (same rules as mutate `set_proof`),
 * then service-role storage signing only after the gate succeeds.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = checklistProofUploadSignBodySchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const msg = flat.formErrors[0] ?? Object.values(flat.fieldErrors).flat()[0] ?? "Validation failed";
    return NextResponse.json({ error: String(msg) }, { status: 400 });
  }

  const { organizationId, contentType, runItemId, overrideTaskId } = parsed.data;

  const supabase = await createSupabaseForRouteHandler(request);
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkProofSignRateLimit(user.id, organizationId);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  const gate = runItemId
    ? await runChecklistProofUploadGate(supabase, organizationId, { runItemId })
    : await runChecklistProofUploadGate(supabase, organizationId, { overrideTaskId: overrideTaskId! });

  if (!gate.ok) {
    const { status, body: errBody } = proofGateErrorToHttp(gate.error);
    logServerEvent("proof_upload_sign_denied", {
      organization_id: organizationId,
      user_id: user.id,
      error: gate.error,
    });
    return NextResponse.json({ error: errBody }, { status });
  }

  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch {
    return NextResponse.json({ error: "Upload signing unavailable" }, { status: 503 });
  }

  const ext = contentType.split("/")[1] ?? "jpg";
  const fileId = crypto.randomUUID();
  const path = runItemId
    ? `${organizationId}/checklist-proofs/${gate.runId}/ri_${runItemId}/${fileId}.${ext}`
    : `${organizationId}/checklist-proofs/${gate.runId}/ov_${overrideTaskId}/${fileId}.${ext}`;

  const signed = await signAndReturn(admin, path);
  logServerEvent("proof_upload_sign_ok", {
    organization_id: organizationId,
    user_id: user.id,
    run_item_id: runItemId ?? null,
    override_task_id: overrideTaskId ?? null,
    run_id: gate.runId,
  });
  return signed;
}

async function signAndReturn(
  admin: ReturnType<typeof createServiceRoleClient>,
  path: string
): Promise<NextResponse> {
  const { data: signed, error: signErr } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (signErr || !signed) {
    return NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 });
  }
  const s = signed as { signedUrl?: string; path: string };
  return NextResponse.json({
    path,
    signedUrl: s.signedUrl ?? s.path,
  });
}
