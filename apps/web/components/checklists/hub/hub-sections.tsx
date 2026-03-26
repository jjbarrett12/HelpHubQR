import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  upsertChecklistFormAction,
  deleteChecklistFormAction,
} from "@/app/app/helphub/actions/checklists";
import type { ShiftChecklistRunStatus } from "@/lib/helphub/types";
import { ShiftRunStatusBadge } from "@/components/helphub/ShiftRunStatusBadge";

const SHIFT_LABEL: Record<string, string> = {
  open: "Open",
  mid: "Mid",
  close: "Close",
  custom: "Custom",
};

function firstString(p: string | string[] | undefined): string | undefined {
  if (typeof p === "string") return p;
  if (Array.isArray(p) && typeof p[0] === "string") return p[0];
  return undefined;
}

export async function TemplatesHubSection({ orgId }: { orgId: string }) {
  const supabase = await createClient();
  const [{ data: checklists }, { data: roles }, { data: locations }] = await Promise.all([
    supabase.from("checklists").select("*").eq("organization_id", orgId).order("name"),
    supabase.from("staff_roles").select("id, name").eq("organization_id", orgId).order("name"),
    supabase.from("locations").select("id, name").eq("organization_id", orgId).order("name"),
  ]);

  const roleName = new Map((roles ?? []).map((r) => [r.id as string, r.name as string]));
  const locName = new Map((locations ?? []).map((l) => [l.id as string, l.name as string]));

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl space-y-8">
      <section className="rounded-xl border border-border/60 bg-card/40 p-5 space-y-3 shadow-sm">
        <p className="text-sm font-semibold">New template</p>
        <p className="text-xs text-muted-foreground">
          Defines repeatable work for a role and shift type. Runs are created separately when a shift is issued.
        </p>
        <form action={upsertChecklistFormAction} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <label className="text-sm">Name</label>
            <input name="name" required className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-sm">Description</label>
            <textarea name="description" className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm min-h-[72px]" />
          </div>
          <div className="space-y-1">
            <label className="text-sm">Role / station tag</label>
            <select name="staff_role_id" required className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm">
              {(roles ?? []).map((r) => (
                <option key={r.id as string} value={r.id as string}>
                  {r.name as string}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm">Shift type</label>
            <select name="shift_type" required className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm">
              <option value="open">Open</option>
              <option value="mid">Mid</option>
              <option value="close">Close</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-sm">Location scope (optional)</label>
            <select name="location_id" className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm">
              <option value="">All locations (default)</option>
              {(locations ?? []).map((l) => (
                <option key={l.id as string} value={l.id as string}>
                  {l.name as string}
                </option>
              ))}
            </select>
          </div>
          <input type="hidden" name="is_active" value="true" />
          <div className="sm:col-span-2">
            <Button type="submit">Create template</Button>
          </div>
        </form>
      </section>

      {(checklists ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 py-14 px-4 text-center">
          <p className="text-sm font-medium text-foreground">No templates yet</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Create a template above, or import a photo and promote it after review.
          </p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link href="/app/checklists?hub=import">Go to import review</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {(checklists ?? []).map((c) => (
            <li
              key={c.id as string}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/30 p-3"
            >
              <div className="min-w-0 space-y-1">
                <div className="font-medium truncate">{c.name as string}</div>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                  <span>{roleName.get(c.staff_role_id as string) ?? "Role"}</span>
                  <span>·</span>
                  <span>{SHIFT_LABEL[String(c.shift_type)] ?? c.shift_type}</span>
                  {c.location_id ? (
                    <>
                      <span>·</span>
                      <span>{locName.get(c.location_id as string) ?? "Location"}</span>
                    </>
                  ) : null}
                  {c.is_active ? <Badge variant="outline">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="secondary" asChild>
                  <Link href={`/app/checklists/templates/${c.id as string}`}>Open builder</Link>
                </Button>
                <form action={deleteChecklistFormAction}>
                  <input type="hidden" name="id" value={c.id as string} />
                  <Button type="submit" size="sm" variant="ghost" className="text-destructive">
                    Delete
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export async function RunsHubSection({ orgId }: { orgId: string }) {
  const supabase = await createClient();
  const { data: runRows, error } = await supabase
    .from("shift_checklist_runs")
    .select(
      `
      id,
      status,
      updated_at,
      checklist:checklists(name),
      employee_shift:employee_shifts(
        shift_date,
        employee:employees(full_name),
        staff_role:staff_roles(name)
      )
    `
    )
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(40);

  if (error) {
    return (
      <div className="p-6 text-sm text-destructive">
        Could not load runs: {error.message}
        {/* TODO: RLS / shift_checklist_runs policy */}
      </div>
    );
  }

  function one<T>(x: T | T[] | null | undefined): T | null {
    if (x == null) return null;
    return Array.isArray(x) ? x[0] ?? null : x;
  }

  const rows =
    (runRows ?? []).map((raw) => {
      const checklist = one(raw.checklist as { name: string } | { name: string }[] | null);
      const es = one(
        raw.employee_shift as unknown as {
          shift_date: string;
          employee: { full_name: string } | { full_name: string }[] | null;
          staff_role: { name: string } | { name: string }[] | null;
        } | null
      );
      const emp = one(es?.employee ?? null);
      const role = one(es?.staff_role ?? null);
      return {
        id: raw.id as string,
        status: raw.status as ShiftChecklistRunStatus,
        updated_at: raw.updated_at as string,
        checklistName: checklist?.name ?? "Checklist",
        employeeName: emp?.full_name ?? "Employee",
        roleName: role?.name ?? "Role",
        shiftDate: es?.shift_date ?? "—",
      };
    }) ?? [];

  const openish = rows.filter((r) => r.status !== "completed" && r.status !== "expired");

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          In-flight and recent runs. Open a row for <span className="font-medium text-foreground">execution truth</span>{" "}
          (completion, proof, comments).
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/app/checklist-runs">Full run list</Link>
        </Button>
      </div>

      {openish.length === 0 && rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 py-14 px-4 text-center text-sm text-muted-foreground">
          No shift checklist runs yet. Runs appear when shifts are issued with a checklist attached.
          {/* TODO: employee_shifts → shift_checklist_runs creation */}
        </div>
      ) : openish.length === 0 ? (
        <p className="text-xs text-muted-foreground">No active runs right now — showing recent below.</p>
      ) : null}

      <ul className="space-y-2">
        {(openish.length ? openish : rows).map((r) => (
          <li key={r.id} className="rounded-lg border border-border/60 bg-card/30 p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium truncate">{r.checklistName}</span>
                <ShiftRunStatusBadge status={r.status} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {r.employeeName} · {r.roleName} · <span className="tabular-nums">{r.shiftDate}</span>
              </p>
              <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                Updated {new Date(r.updated_at).toLocaleString()}
              </p>
            </div>
            <Button size="sm" asChild>
              <Link href={`/app/checklists/runs/${r.id}`}>Review run</Link>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function ImportHubSection({ orgId }: { orgId: string }) {
  const supabase = await createClient();
  const { data: docs } = await supabase
    .from("imported_documents")
    .select("id, status, review_checklist_name, original_filename, created_at, updated_at, error_message")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(25);

  const inFlight = (docs ?? []).filter((d) => ["uploaded", "processing", "review"].includes(d.status as string));

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Photo / OCR import pipeline</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Upload captures text; AI proposes structure. Review is mandatory before a live template exists.
            {/* TODO: OCR service webhook status, retry failed imports */}
          </p>
        </div>
        <Button asChild>
          <Link href="/app/checklists/import">New upload</Link>
        </Button>
      </div>

      {inFlight.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 py-12 px-4 text-center text-sm text-muted-foreground">
          Nothing waiting in review. Start an import to see documents here.
        </div>
      ) : (
        <ul className="space-y-2">
          {inFlight.map((d) => (
            <li key={d.id as string} className="rounded-lg border border-border/60 p-3 flex flex-wrap justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{(d.review_checklist_name as string) || "Untitled import"}</p>
                <p className="text-xs text-muted-foreground">
                  {(d.original_filename as string) || "file"} · {String(d.status)}
                </p>
                {d.error_message ? (
                  <p className="text-xs text-destructive mt-1">{d.error_message as string}</p>
                ) : null}
              </div>
              <Button size="sm" variant="secondary" asChild>
                <Link href={`/app/checklists/import/${d.id as string}`}>Review</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-muted-foreground">
        Completed imports are promoted to templates — find them under Templates, or open the full import log below.
      </p>
      {(docs ?? []).length > inFlight.length ? (
        <details className="rounded-lg border border-border/50 bg-muted/20 p-3 text-sm">
          <summary className="cursor-pointer font-medium">Recent imports (all statuses)</summary>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {(docs ?? []).map((d) => (
              <li key={d.id as string} className="flex justify-between gap-2">
                <span className="truncate">{(d.review_checklist_name as string) || d.id}</span>
                <span>{String(d.status)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

export async function HistoryHubSection({ orgId }: { orgId: string }) {
  const supabase = await createClient();
  const { data: runRows } = await supabase
    .from("shift_checklist_runs")
    .select(
      `
      id,
      status,
      completed_at,
      updated_at,
      checklist:checklists(name),
      employee_shift:employee_shifts(shift_date, employee:employees(full_name))
    `
    )
    .eq("organization_id", orgId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(35);

  function one<T>(x: T | T[] | null | undefined): T | null {
    if (x == null) return null;
    return Array.isArray(x) ? x[0] ?? null : x;
  }

  const rows = (runRows ?? []).map((raw) => {
    const checklist = one(raw.checklist as { name: string } | { name: string }[] | null);
    const es = one(
      raw.employee_shift as unknown as {
        shift_date: string;
        employee: { full_name: string } | { full_name: string }[] | null;
      } | null
    );
    const emp = one(es?.employee ?? null);
    return {
      id: raw.id as string,
      checklistName: checklist?.name ?? "Checklist",
      shiftDate: es?.shift_date ?? "—",
      employeeName: emp?.full_name ?? "Employee",
      completedAt: (raw.completed_at as string | null) ?? null,
      updated_at: raw.updated_at as string,
    };
  });

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Completed execution records. Same review screen as active runs — timestamps and proof reflect what happened on
        shift.
      </p>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 py-14 px-4 text-center text-sm text-muted-foreground">
          No completed runs yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-lg border border-border/60 bg-card/20 p-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-sm">{r.checklistName}</p>
                <p className="text-xs text-muted-foreground">
                  {r.employeeName} · <span className="tabular-nums">{r.shiftDate}</span>
                </p>
                <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                  {r.completedAt ? `Completed ${new Date(r.completedAt).toLocaleString()}` : `Updated ${new Date(r.updated_at).toLocaleString()}`}
                </p>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/app/checklists/runs/${r.id}`}>Open</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export async function TaxonomyHubSection() {
  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-2xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Task keys connect checklist lines to preferences, fairness signals, and imports. Taxonomy is shared across
        templates — it is not a checklist run.
      </p>
      <div className="rounded-xl border border-border/60 bg-card/30 p-6 space-y-3">
        <p className="text-sm font-semibold">Manage normalized keys</p>
        <p className="text-xs text-muted-foreground">
          Add labels, deactivate retired keys, and bulk-apply suggestions from template builders.
        </p>
        <Button asChild>
          <Link href="/app/task-taxonomy">Open task taxonomy</Link>
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {/* TODO: Supabase task_taxonomy table; optional sync from external CMMS */}
      </p>
    </div>
  );
}

export function parseHubParam(searchParams: Record<string, string | string[] | undefined>) {
  const raw = firstString(searchParams.hub);
  const allowed = new Set(["templates", "runs", "import", "history", "taxonomy"]);
  if (raw && allowed.has(raw)) return raw as "templates" | "runs" | "import" | "history" | "taxonomy";
  return "templates" as const;
}
