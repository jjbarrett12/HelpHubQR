import { createServiceRoleClient } from "@/lib/supabase/server-admin";

export type SupervisorProperty = { id: string; name: string; timezone: string | null };

export async function getSupervisorPropertyForUser(userId: string): Promise<{
  propertyId: string;
  property: SupervisorProperty;
} | null> {
  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("supervisor_profiles")
    .select("property_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile?.property_id) return null;
  const { data: property } = await admin
    .from("properties")
    .select("id, name, timezone")
    .eq("id", profile.property_id)
    .single();
  if (!property) return null;
  return {
    propertyId: property.id,
    property: {
      id: property.id,
      name: property.name ?? "Property",
      timezone: property.timezone ?? null,
    },
  };
}
