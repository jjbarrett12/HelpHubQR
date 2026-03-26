export type DeliveryLatestMap = Partial<
  Record<"sms" | "email", { status: string; error_message: string | null; sent_at: string | null }>
>;

export function indexLatestDeliveriesByRun(
  rows: Array<{
    shift_checklist_run_id: string;
    channel: string;
    status: string;
    error_message: string | null;
    sent_at: string | null;
  }>
): Map<string, DeliveryLatestMap> {
  const latestByRun = new Map<string, DeliveryLatestMap>();
  for (const row of rows) {
    const rid = row.shift_checklist_run_id;
    const ch = row.channel as "sms" | "email";
    let m = latestByRun.get(rid);
    if (!m) {
      m = {};
      latestByRun.set(rid, m);
    }
    if (m[ch]) continue;
    m[ch] = {
      status: row.status,
      error_message: row.error_message,
      sent_at: row.sent_at,
    };
  }
  return latestByRun;
}

export type DeliveryChannelHint = {
  channel: "sms" | "email";
  label: string;
  actionable?: string;
};

function formatLatestLine(
  orgEnabled: boolean,
  contactOk: boolean,
  channelLabel: string,
  latest?: { status: string; error_message: string | null; sent_at: string | null }
): string {
  if (!orgEnabled) {
    return `Enable ${channelLabel} under Delivery settings`;
  }
  if (!contactOk) {
    return channelLabel === "SMS" ? "Add phone in Employees" : "Add email in Employees";
  }
  if (!latest) {
    return "No delivery attempts logged yet";
  }
  if (latest.status === "failed") {
    const err = (latest.error_message ?? "Failed").trim();
    return err.length > 120 ? `${err.slice(0, 117)}…` : err;
  }
  if (latest.status === "pending") {
    return "Pending (in flight or stuck — wait or use Resend)";
  }
  if (latest.status === "sent" || latest.status === "delivered") {
    const when = latest.sent_at ? new Date(latest.sent_at).toLocaleString() : "";
    return when ? `Last: ${latest.status} ${when}` : `Last: ${latest.status}`;
  }
  return `Last status: ${latest.status}`;
}

export function buildDeliveryChannelHints(params: {
  orgSendSms: boolean;
  orgSendEmail: boolean;
  phonePresent: boolean;
  emailPresent: boolean;
  latest: DeliveryLatestMap;
}): DeliveryChannelHint[] {
  return [
    {
      channel: "sms",
      label: "SMS",
      actionable: formatLatestLine(params.orgSendSms, params.phonePresent, "SMS", params.latest.sms),
    },
    {
      channel: "email",
      label: "Email",
      actionable: formatLatestLine(params.orgSendEmail, params.emailPresent, "Email", params.latest.email),
    },
  ];
}
