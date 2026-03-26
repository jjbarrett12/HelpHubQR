/**
 * Staff session JWT: sign and verify.
 * Payload: property_id, role (hk|eng|sup), shift_token_id?, device_id?, exp (8–12h).
 */

import { createHmac, timingSafeEqual } from "crypto";

const ALG = "HS256";
const TTL_SEC = 10 * 60 * 60; // 10 hours

export type StaffJwtPayload = {
  property_id: string;
  role: "hk" | "eng" | "sup";
  shift_token_id?: string;
  device_id?: string;
  exp: number;
  iat: number;
};

function getSecret(): string {
  const secret = process.env.STAFF_JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("STAFF_JWT_SECRET must be set and at least 16 characters");
  }
  return secret;
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64url");
}

function base64UrlDecode(str: string): Buffer {
  const padded = str + "==".slice(0, (4 - (str.length % 4)) % 4);
  return Buffer.from(padded, "base64url");
}

export function signStaffJwt(payload: Omit<StaffJwtPayload, "exp" | "iat">): string {
  const secret = getSecret();
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + TTL_SEC;
  const header = { alg: ALG, typ: "JWT" };
  const payloadStr = JSON.stringify({ ...payload, iat, exp });
  const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header), "utf8"));
  const payloadB64 = base64UrlEncode(Buffer.from(payloadStr, "utf8"));
  const signatureInput = `${headerB64}.${payloadB64}`;
  const sig = createHmac("sha256", secret).update(signatureInput).digest();
  const sigB64 = base64UrlEncode(sig);
  return `${signatureInput}.${sigB64}`;
}

export function verifyStaffJwt(token: string): StaffJwtPayload | null {
  try {
    const secret = getSecret();
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [, payloadB64, sigB64] = parts;
    const signatureInput = `${parts[0]}.${payloadB64}`;
    const expectedSig = createHmac("sha256", secret).update(signatureInput).digest();
    const actualSig = base64UrlDecode(sigB64);
    if (actualSig.length !== expectedSig.length || !timingSafeEqual(expectedSig, actualSig)) {
      return null;
    }
    const payloadJson = base64UrlDecode(payloadB64).toString("utf8");
    const payload = JSON.parse(payloadJson) as StaffJwtPayload;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.property_id || !payload.role) return null;
    return payload;
  } catch {
    return null;
  }
}
