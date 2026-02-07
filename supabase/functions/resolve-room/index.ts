import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response(
      JSON.stringify({ error: "Token is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const { data, error } = await supabase
    .from("room_tokens")
    .select("room:rooms(id, room_label, site:sites(id, name))")
    .eq("token", token)
    .is("revoked_at", null)
    .single();

  if (error || !data) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired token" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const room = data.room as { id: string; room_label: string; site: { id: string; name: string } };
  return new Response(
    JSON.stringify({
      site_name: room.site.name,
      site_id: room.site.id,
      room_label: room.room_label,
      room_id: room.id,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
