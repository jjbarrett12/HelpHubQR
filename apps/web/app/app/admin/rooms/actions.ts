"use server";

import { createClient } from "@/lib/supabase/server";
import { formatRoomsDbError } from "@/lib/rooms/db-error";
import { revalidatePath } from "next/cache";
import { generateRawRoomToken, hashRoomToken } from "@/lib/room-token/hash";
import { isRoomTokenActive } from "@/lib/room-token/active";
import { isArchivedRecord } from "@/lib/tenant/archive";

async function assertSiteActiveForRoomOps(
  supabase: Awaited<ReturnType<typeof createClient>>,
  siteId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: site } = await supabase.from("sites").select("id, archived_at").eq("id", siteId).single();
  if (!site) return { ok: false, error: "Site not found or access denied" };
  if (isArchivedRecord(site)) {
    return { ok: false, error: "This customer is archived. Restore access from platform support or use an active customer." };
  }
  return { ok: true };
}

async function revokeExpiredTokensForRoom(
  supabase: Awaited<ReturnType<typeof createClient>>,
  roomId: string
) {
  const now = new Date().toISOString();
  await supabase
    .from("room_tokens")
    .update({ revoked_at: now, revoked_reason: "expired" })
    .eq("room_id", roomId)
    .is("revoked_at", null)
    .not("expires_at", "is", null)
    .lte("expires_at", now);
}

function guestUrlForRawToken(raw: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  return `${base}/t/${raw}`;
}

export type GenerateTokenResult =
  | { ok: true; alreadyExisted: true }
  | { ok: true; mintedUrl: string }
  | { ok: false; error: string };

export const generateRoomToken = async (roomId: string): Promise<GenerateTokenResult> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: room } = await supabase
    .from("rooms")
    .select("id, archived_at, site_id")
    .eq("id", roomId)
    .single();
  if (!room) return { ok: false, error: "Room not found or access denied" };
  if (isArchivedRecord(room)) return { ok: false, error: "This location is archived." };
  const { data: siteRow } = await supabase.from("sites").select("archived_at").eq("id", room.site_id).single();
  if (isArchivedRecord(siteRow)) return { ok: false, error: "This customer is archived." };

  await revokeExpiredTokensForRoom(supabase, roomId);

  const { data: row } = await supabase
    .from("room_tokens")
    .select("id, expires_at, revoked_at")
    .eq("room_id", roomId)
    .is("revoked_at", null)
    .maybeSingle();

  if (row && isRoomTokenActive(row)) {
    revalidatePath("/app/admin/rooms");
    return { ok: true, alreadyExisted: true };
  }

  const now = new Date().toISOString();
  let rotatedFrom: string | null = null;
  if (row && !isRoomTokenActive(row)) {
    rotatedFrom = row.id;
    await supabase
      .from("room_tokens")
      .update({ revoked_at: now, revoked_reason: "expired" })
      .eq("id", row.id);
  }

  const raw = generateRawRoomToken();
  const token_hash = hashRoomToken(raw);
  const { error } = await supabase.from("room_tokens").insert({
    room_id: roomId,
    token_hash,
    rotated_from_token_id: rotatedFrom,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/admin/rooms");
  return { ok: true, mintedUrl: guestUrlForRawToken(raw) };
};

export type RotateRoomTokenResult =
  | { ok: true; mintedUrl: string }
  | { ok: false; error: string };

/** Revokes the current active token (if any) and mints a new one; links history via rotated_from_token_id. */
export async function rotateRoomToken(roomId: string, siteId: string): Promise<RotateRoomTokenResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: room } = await supabase
    .from("rooms")
    .select("id, archived_at, site_id")
    .eq("id", roomId)
    .eq("site_id", siteId)
    .single();
  if (!room) return { ok: false, error: "Room not found or access denied" };
  if (isArchivedRecord(room)) return { ok: false, error: "This location is archived." };
  const { data: siteRow } = await supabase.from("sites").select("archived_at").eq("id", siteId).single();
  if (isArchivedRecord(siteRow)) return { ok: false, error: "This customer is archived." };

  await revokeExpiredTokensForRoom(supabase, roomId);

  const { data: active } = await supabase
    .from("room_tokens")
    .select("id")
    .eq("room_id", roomId)
    .is("revoked_at", null)
    .maybeSingle();

  const now = new Date().toISOString();
  if (active?.id) {
    await supabase
      .from("room_tokens")
      .update({ revoked_at: now, revoked_reason: "rotated" })
      .eq("id", active.id);
  }

  const raw = generateRawRoomToken();
  const token_hash = hashRoomToken(raw);
  const { error } = await supabase.from("room_tokens").insert({
    room_id: roomId,
    token_hash,
    rotated_from_token_id: active?.id ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/admin/rooms");
  return { ok: true, mintedUrl: guestUrlForRawToken(raw) };
}

export type PrepareQrPrintResult =
  | { ok: true; cards: { roomId: string; room_label: string; url: string }[] }
  | { ok: false; error: string };

/**
 * Build printable /t/... URLs. Raw tokens only exist in the response (and browser memory during print).
 * When reissue is true, existing active tokens for the selected rooms are revoked first (previous prints stop working).
 */
export async function prepareQrPrintUrls(
  siteId: string,
  roomIds: string[],
  options: { reissue: boolean }
): Promise<PrepareQrPrintResult> {
  if (!options.reissue) {
    return {
      ok: false,
      error:
        'Turn on “Issue new secure links” below to print. We only store hashed tokens in the database, so printing requires minting new links (old printed codes for those rooms will stop working).',
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const uniqueIds = [...new Set(roomIds)].filter(Boolean);
  if (uniqueIds.length === 0) return { ok: false, error: "No rooms selected." };

  const siteGate = await assertSiteActiveForRoomOps(supabase, siteId);
  if (!siteGate.ok) return siteGate;

  const { data: rooms, error: roomsErr } = await supabase
    .from("rooms")
    .select("id, room_label, archived_at")
    .eq("site_id", siteId)
    .in("id", uniqueIds)
    .is("archived_at", null);

  if (roomsErr || !rooms || rooms.length !== uniqueIds.length) {
    return {
      ok: false,
      error:
        "One or more rooms were not found, or some are archived. Archived rooms cannot receive new QR links unless enabled in site settings.",
    };
  }

  const cards: { roomId: string; room_label: string; url: string }[] = [];

  for (const room of rooms) {
    await revokeExpiredTokensForRoom(supabase, room.id);

    const { data: active } = await supabase
      .from("room_tokens")
      .select("id")
      .eq("room_id", room.id)
      .is("revoked_at", null)
      .maybeSingle();

    const now = new Date().toISOString();
    if (active?.id) {
      await supabase
        .from("room_tokens")
        .update({ revoked_at: now, revoked_reason: "qr_reprint" })
        .eq("id", active.id);
    }

    const raw = generateRawRoomToken();
    const token_hash = hashRoomToken(raw);
    const { error: insErr } = await supabase.from("room_tokens").insert({
      room_id: room.id,
      token_hash,
      rotated_from_token_id: active?.id ?? null,
    });
    if (insErr) return { ok: false, error: insErr.message };
    cards.push({
      roomId: room.id,
      room_label: room.room_label ?? "",
      url: guestUrlForRawToken(raw),
    });
  }

  revalidatePath("/app/admin/rooms");
  return { ok: true, cards };
}

export type CreateRoomWithTokenResult =
  | { ok: true; roomId: string; guestUrl: string }
  | { ok: false; error: string };

export async function createRoomWithToken(
  siteId: string,
  label: string,
  floor: string | null
): Promise<CreateRoomWithTokenResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const trimmed = label.trim();
  if (!trimmed) return { ok: false, error: "Location name is required." };

  const siteGate = await assertSiteActiveForRoomOps(supabase, siteId);
  if (!siteGate.ok) return siteGate;

  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .insert({
      site_id: siteId,
      room_label: trimmed,
      floor: floor?.trim() || null,
      active: true,
    })
    .select("id")
    .single();

  if (roomErr || !room) return { ok: false, error: formatRoomsDbError(roomErr?.message) };

  await revokeExpiredTokensForRoom(supabase, room.id);

  const raw = generateRawRoomToken();
  const token_hash = hashRoomToken(raw);
  const { error: tokErr } = await supabase.from("room_tokens").insert({
    room_id: room.id,
    token_hash,
  });
  if (tokErr) return { ok: false, error: tokErr.message };

  revalidatePath("/app/admin/rooms");
  return { ok: true, roomId: room.id, guestUrl: guestUrlForRawToken(raw) };
}

export type BulkRoomsWithTokensResult =
  | { ok: true; created: { roomId: string; room_label: string; guestUrl: string }[] }
  | { ok: false; error: string };

export async function createRoomsBulkWithTokens(
  siteId: string,
  rows: { room_label: string; floor: string | null }[]
): Promise<BulkRoomsWithTokensResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const normalized = rows
    .map((r) => ({
      room_label: r.room_label.trim(),
      floor: r.floor?.trim() || null,
    }))
    .filter((r) => r.room_label.length > 0);

  if (normalized.length === 0) return { ok: false, error: "No valid rows." };
  if (normalized.length > 500) return { ok: false, error: "Maximum 500 rooms per import." };

  const siteGate = await assertSiteActiveForRoomOps(supabase, siteId);
  if (!siteGate.ok) return siteGate;

  const toInsert = normalized.map((r) => ({
    site_id: siteId,
    room_label: r.room_label,
    floor: r.floor,
    active: true,
  }));

  const { data: inserted, error: insertErr } = await supabase.from("rooms").insert(toInsert).select("id, room_label");

  if (insertErr || !inserted?.length) {
    return {
      ok: false,
      error: insertErr ? formatRoomsDbError(insertErr.message) : "Failed to create rooms.",
    };
  }

  const rawList = inserted.map(() => generateRawRoomToken());
  const tokenRows = inserted.map((r, i) => ({
    room_id: r.id,
    token_hash: hashRoomToken(rawList[i]),
  }));

  const { error: tokErr } = await supabase.from("room_tokens").insert(tokenRows);
  if (tokErr) return { ok: false, error: tokErr.message };

  const created = inserted.map((r, i) => ({
    roomId: r.id,
    room_label: r.room_label ?? "",
    guestUrl: guestUrlForRawToken(rawList[i]),
  }));

  revalidatePath("/app/admin/rooms");
  return { ok: true, created };
}

export type ArchiveRoomResult = { ok: true } | { ok: false; error: string };

/** Soft-archive room; revoke active QR token. */
export const archiveRoom = async (roomId: string, siteId: string): Promise<ArchiveRoomResult> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: room } = await supabase
    .from("rooms")
    .select("id, site_id, archived_at")
    .eq("id", roomId)
    .eq("site_id", siteId)
    .single();
  if (!room) return { ok: false, error: "Room not found or access denied" };
  if (room.archived_at) return { ok: false, error: "This location is already archived." };

  const now = new Date().toISOString();
  await supabase
    .from("room_tokens")
    .update({ revoked_at: now, revoked_reason: "room_archived" })
    .eq("room_id", roomId)
    .is("revoked_at", null);

  const { error } = await supabase.from("rooms").update({ archived_at: now }).eq("id", roomId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/admin/rooms");
  revalidatePath(`/app/sites/${siteId}`);
  return { ok: true };
};

/** @deprecated Use archiveRoom */
export const deleteRoom = archiveRoom;
export type DeleteRoomResult = ArchiveRoomResult;

export type SiteGuestQrSettingResult = { ok: true } | { ok: false; error: string };

/** Rare override: allow guest links to resolve for archived rooms at this site (still blocked if the site is archived). */
export async function updateSiteAllowGuestQrForArchivedRooms(
  siteId: string,
  allow: boolean
): Promise<SiteGuestQrSettingResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: site } = await supabase.from("sites").select("id").eq("id", siteId).single();
  if (!site) return { ok: false, error: "Site not found or access denied" };

  const { error } = await supabase.from("site_settings").upsert(
    {
      site_id: siteId,
      allow_guest_qr_for_archived_rooms: allow,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "site_id" }
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/admin/rooms");
  return { ok: true };
}
