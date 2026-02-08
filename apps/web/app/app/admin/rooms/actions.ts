"use server";

import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function generateToken(): string {
  return randomBytes(24).toString("hex");
}

export type GenerateTokenResult = { ok: true; alreadyExisted?: boolean } | { ok: false; error: string };

export const generateRoomToken = async (roomId: string): Promise<GenerateTokenResult> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: existing } = await supabase
    .from("room_tokens")
    .select("token")
    .eq("room_id", roomId)
    .maybeSingle();
  if (existing) {
    revalidatePath("/app/admin/rooms");
    return { ok: true, alreadyExisted: true };
  }

  const token = generateToken();
  const { error } = await supabase.from("room_tokens").insert({ room_id: roomId, token });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/admin/rooms");
  return { ok: true };
};

export type DeleteRoomResult = { ok: true } | { ok: false; error: string };

export const deleteRoom = async (roomId: string, siteId: string): Promise<DeleteRoomResult> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: room } = await supabase
    .from("rooms")
    .select("id, site_id")
    .eq("id", roomId)
    .eq("site_id", siteId)
    .single();
  if (!room) return { ok: false, error: "Room not found or access denied" };

  const { error } = await supabase.from("rooms").delete().eq("id", roomId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/admin/rooms");
  return { ok: true };
};
