/** Coarse module for support triage (best-effort from event_type). */
export function provisionEventModule(eventType: string): string {
  const t = eventType.toLowerCase();
  if (t.includes("bootstrap")) return "bootstrap";
  if (t.startsWith("provision_organization") || t.includes("provision_")) return "provisioning";
  if (t.startsWith("starter_") || t.includes("starter_pack")) return "starter_pack";
  if (t.includes("seed_default_roles") || t.includes("seed_roles")) return "roles";
  if (t.includes("workforce") || t.includes("location")) return "org_defaults";
  if (t.includes("failed")) return "failure";
  return "other";
}
