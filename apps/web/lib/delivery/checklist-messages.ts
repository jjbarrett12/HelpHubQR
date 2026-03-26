import type { ShiftType } from "@/lib/helphub/types";
import { publicChecklistUrl } from "@/lib/helphub/app-url";

const SHIFT_WORD: Record<ShiftType, string> = {
  open: "opening",
  mid: "mid-shift",
  close: "closing",
  custom: "shift",
};

export function firstNameFromFullName(fullName: string): string {
  const t = fullName.trim();
  if (!t) return "there";
  return t.split(/\s+/)[0] ?? t;
}

export function shiftTypeWord(shiftType: string): string {
  return SHIFT_WORD[shiftType as ShiftType] ?? "shift";
}

export function buildChecklistSmsBody(params: {
  firstName: string;
  shiftType: string;
  link: string;
}): string {
  const kind = shiftTypeWord(params.shiftType);
  return `Hi ${params.firstName}, here is your ${kind} checklist for today:\n${params.link}\nPlease complete it before leaving.`;
}

export function buildChecklistEmailContent(params: {
  firstName: string;
  shiftType: string;
  link: string;
}): { subject: string; text: string; html: string } {
  const kind = shiftTypeWord(params.shiftType);
  const subject = "Your shift checklist for today";
  const text = `Hi ${params.firstName},

Here is your ${kind} checklist for today:
${params.link}

Please complete it before you leave.

— HelpHubQR`;

  const html = `<p>Hi ${escapeHtml(params.firstName)},</p>
<p>Here is your <strong>${escapeHtml(kind)}</strong> checklist for today:</p>
<p><a href="${escapeHtml(params.link)}">${escapeHtml(params.link)}</a></p>
<p>Please complete it before you leave.</p>
<p style="color:#666;font-size:12px">— HelpHubQR</p>`;

  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function resolveChecklistLink(accessToken: string): string {
  return publicChecklistUrl(accessToken);
}
