export type SendEmailResult =
  | { ok: true; provider: "resend" | "sendgrid"; providerMessageId: string }
  | { ok: false; error: string };

export type TransactionalEmailParams = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  fromEmail: string;
  fromName?: string;
  replyTo?: string | null;
};

/**
 * Transactional email via Resend (preferred) or SendGrid — same pattern as notify-guest-completed.
 */
export async function sendEmail(params: TransactionalEmailParams): Promise<SendEmailResult> {
  const fromEmail = params.fromEmail.trim();
  if (!fromEmail) {
    return { ok: false, error: "From email is not configured" };
  }

  const fromName = params.fromName?.trim() || "HelpHubQR";
  const fromHeader = `${fromName} <${fromEmail}>`;

  const resendKey = process.env.RESEND_API_KEY?.trim();
  const sendgridKey = process.env.SENDGRID_API_KEY?.trim();

  if (resendKey) {
    const body: Record<string, unknown> = {
      from: fromHeader,
      to: [params.to.trim()],
      subject: params.subject,
      text: params.text,
    };
    if (params.html) body.html = params.html;
    if (params.replyTo?.trim()) body.reply_to = params.replyTo.trim();

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json().catch(() => ({}))) as { message?: string; id?: string };
    if (!res.ok) {
      return { ok: false, error: typeof json.message === "string" ? json.message : `Resend HTTP ${res.status}` };
    }
    const id = typeof json.id === "string" ? json.id : `resend-${Date.now()}`;
    return { ok: true, provider: "resend", providerMessageId: id };
  }

  if (sendgridKey) {
    const content: Array<{ type: string; value: string }> = [{ type: "text/plain", value: params.text }];
    if (params.html) content.push({ type: "text/html", value: params.html });

    const payload: Record<string, unknown> = {
      personalizations: [{ to: [{ email: params.to.trim() }] }],
      from: { email: fromEmail, name: fromName },
      subject: params.subject,
      content,
    };
    if (params.replyTo?.trim()) {
      payload.reply_to = { email: params.replyTo.trim() };
    }

    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sendgridKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      return { ok: false, error: errText.slice(0, 500) || `SendGrid HTTP ${res.status}` };
    }

    const msgId = res.headers.get("x-message-id") ?? `sendgrid-${Date.now()}`;
    return { ok: true, provider: "sendgrid", providerMessageId: msgId };
  }

  return {
    ok: false,
    error: "No email provider configured (RESEND_API_KEY or SENDGRID_API_KEY)",
  };
}
