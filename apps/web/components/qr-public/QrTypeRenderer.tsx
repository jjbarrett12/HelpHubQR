import type { PublicQrPayload } from "@/lib/qr/public-load";
import { QrIssueReportForm } from "@/components/qr-public/QrIssueReportForm";

function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="content-well space-y-6 py-8 pb-16">
        <header className="space-y-1 border-b border-border/60 pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Scan</p>
          <h1 className="text-xl font-bold leading-tight">{title}</h1>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </header>
        {children}
      </div>
    </div>
  );
}

export function QrTypeRenderer({ payload }: { payload: PublicQrPayload }) {
  const { destination: d, code, checklist } = payload;
  const c = d.content;

  switch (d.type) {
    case "checklist": {
      if (!checklist) {
        return (
          <Shell title={d.name} subtitle={code.label}>
            <p className="text-sm text-muted-foreground">This checklist link is not fully configured yet.</p>
          </Shell>
        );
      }
      return (
        <Shell title={d.name} subtitle={checklist.name}>
          <ol className="list-decimal list-inside space-y-3 text-sm">
            {checklist.items.map((it, i) => (
              <li key={i} className="pl-1 marker:font-semibold">
                <span className="text-foreground">{it.task_text}</span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground pt-4 border-t border-border/40">
            Reference steps for this shift or area. Complete official runs from your personal checklist link when assigned.
          </p>
        </Shell>
      );
    }

    case "training": {
      const title = c?.title ?? d.name;
      return (
        <Shell title={title} subtitle="Training">
          {c?.videoUrl ? (
            <a
              href={c.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-sm font-medium text-primary underline underline-offset-4"
            >
              Open video / resource
            </a>
          ) : null}
          {c?.body ? (
            <div className="max-w-none whitespace-pre-wrap text-sm leading-relaxed">{c.body}</div>
          ) : (
            <p className="text-sm text-muted-foreground">No training content yet.</p>
          )}
        </Shell>
      );
    }

    case "sop": {
      const title = c?.title ?? d.name;
      return (
        <Shell title={title} subtitle="Instructions">
          {c?.body ? (
            <div className="max-w-none whitespace-pre-wrap text-sm leading-relaxed">{c.body}</div>
          ) : (
            <p className="text-sm text-muted-foreground">No instructions yet.</p>
          )}
        </Shell>
      );
    }

    case "announcement": {
      const title = c?.title ?? d.name;
      const items = c?.items?.length ? c.items : c?.body ? [c.body] : [];
      return (
        <Shell title={title} subtitle="Announcements">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No announcements right now.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {items.map((line, i) => (
                <li key={i} className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                  {line}
                </li>
              ))}
            </ul>
          )}
        </Shell>
      );
    }

    case "help": {
      const title = c?.title ?? d.name;
      return (
        <Shell title={title} subtitle="Help">
          {c?.body ? (
            <div className="max-w-none whitespace-pre-wrap text-sm leading-relaxed">{c.body}</div>
          ) : null}
          <div className="flex flex-col gap-2 text-sm">
            {c?.phone ? (
              <a className="font-medium text-primary underline underline-offset-4" href={`tel:${c.phone.replace(/\s/g, "")}`}>
                Call {c.phone}
              </a>
            ) : null}
            {c?.email ? (
              <a className="font-medium text-primary underline underline-offset-4" href={`mailto:${c.email}`}>
                Email {c.email}
              </a>
            ) : null}
          </div>
          {!c?.body && !c?.phone && !c?.email ? (
            <p className="text-sm text-muted-foreground">Contact options will appear here when configured.</p>
          ) : null}
        </Shell>
      );
    }

    case "issue_report": {
      const title = c?.title ?? d.name;
      return (
        <Shell title={title} subtitle="Report an issue">
          {c?.prompt || c?.body ? (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{c?.prompt ?? c?.body}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Describe what needs attention. Your message goes to the team.</p>
          )}
          <QrIssueReportForm slug={code.slug} />
        </Shell>
      );
    }

    default:
      return (
        <Shell title="Unavailable" subtitle={code.label}>
          <p className="text-sm text-muted-foreground">This content type is not available.</p>
        </Shell>
      );
  }
}
