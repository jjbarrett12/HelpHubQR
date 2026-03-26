export type SendSmsResult =
  | { ok: true; provider: "twilio"; providerMessageId: string }
  | { ok: false; error: string };

/**
 * Send SMS via Twilio REST API (server-side only).
 */
export async function sendSMS(params: { to: string; body: string; from: string }): Promise<SendSmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!accountSid || !authToken) {
    return { ok: false, error: "Twilio is not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)" };
  }

  const from = params.from.trim();
  if (!from) {
    return { ok: false, error: "SMS From number is not configured" };
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const form = new URLSearchParams();
  form.set("To", params.to.trim());
  form.set("From", from);
  form.set("Body", params.body);

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const json = (await res.json().catch(() => ({}))) as { message?: string; sid?: string };
  if (!res.ok) {
    const msg = typeof json.message === "string" ? json.message : `Twilio HTTP ${res.status}`;
    return { ok: false, error: msg };
  }

  const sid = typeof json.sid === "string" ? json.sid : "";
  if (!sid) {
    return { ok: false, error: "Twilio returned no message SID" };
  }

  return { ok: true, provider: "twilio", providerMessageId: sid };
}
