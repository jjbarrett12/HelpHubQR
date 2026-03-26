"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  adminAddSupportNote,
  adminApplyStarterPack,
  adminClearBlocker,
  adminCreateFirstLocation,
  adminEnsureOnboardingRow,
  adminEnsureWorkforceSettings,
  adminFlagBlocker,
  adminMarkLaunched,
  adminResendOwnerInvite,
  adminRetryProvisionWithStoredKey,
  adminSeedRoles,
  adminSetLaunchState,
  adminSyncActivation,
  adminUpdateOnboardingIndustryPlan,
} from "@/app/platform-admin/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LaunchStateBadge } from "./status-badges";
import { OnboardingStepsPanel } from "./onboarding-steps-panel";
import { ProvisioningTimeline } from "./provisioning-timeline";
import { ADMIN_ONBOARDING_BASE_PATH } from "@/lib/admin-onboarding/constants";
import { deriveStarterPackStatus } from "@/lib/admin-onboarding/starter-pack-status";
import type { AdminOnboardingDetailPayload, OwnerInviteUiStatus } from "@/lib/admin-onboarding/types";
import { STARTER_PACKS } from "@/lib/onboarding/starter-packs";
import { Textarea } from "@/components/ui/textarea";
import { ADMIN_ONBOARDING_INDUSTRY_KEYS, BLOCKER_CATEGORIES } from "@/lib/admin-onboarding/schemas";

type Props = { detail: AdminOnboardingDetailPayload; dataSource: "live" | "mock" };

function industryLabel(key: string) {
  return STARTER_PACKS[key]?.displayName ?? key.replace(/_/g, " ");
}

function inviteStatusBadge(status: OwnerInviteUiStatus) {
  const variant =
    status === "accepted"
      ? "default"
      : status === "failed"
        ? "destructive"
        : status === "pending"
          ? "secondary"
          : "outline";
  return (
    <Badge variant={variant} className="font-mono text-[10px]">
      {status}
    </Badge>
  );
}

export function OnboardingDetailConsole({ detail, dataSource }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | "replay" | "launched" | "starter_force" | "invite" | "legacy_blocked">(
    null
  );
  const [magicLinkDialog, setMagicLinkDialog] = useState<{ link: string; warning: string } | null>(null);
  const [flagBlockerOpen, setFlagBlockerOpen] = useState(false);
  const [clearBlockerOpen, setClearBlockerOpen] = useState(false);
  const [blockerCategory, setBlockerCategory] = useState<string>("other");
  const [blockerReason, setBlockerReason] = useState("");
  const [clearResolutionNote, setClearResolutionNote] = useState("");
  const [supportNoteDraft, setSupportNoteDraft] = useState("");

  const { org, onboarding, steps, events, locations, ownerUserId, ownerInvite, supportNotes, ownerInviteLog } = detail;
  const packStatus = deriveStarterPackStatus(steps);

  const industryDefault = useMemo(() => {
    const raw = onboarding?.industry ?? "general";
    return (ADMIN_ONBOARDING_INDUSTRY_KEYS as readonly string[]).includes(raw) ? raw : "general";
  }, [onboarding?.industry]);

  const hasBlockerDetail =
    onboarding?.launch_state === "blocked" ||
    Boolean(onboarding?.blocker_reason || onboarding?.blocker_category || onboarding?.blocker_flagged_at);

  function run(fn: () => Promise<{ error?: string; ok?: boolean } | void>) {
    setMsg(null);
    setErr(null);
    start(() => {
      void (async () => {
        const r = await fn();
        if (r && "error" in r && r.error) setErr(r.error);
        else {
          setMsg("Done");
          router.refresh();
        }
      })();
    });
  }

  function runInviteResend() {
    setMsg(null);
    setErr(null);
    start(() => {
      void (async () => {
        const r = await adminResendOwnerInvite(org.id);
        if ("error" in r && r.error) {
          setErr(r.error);
          return;
        }
        if (r.ok && r.mode === "magiclink" && "magicLink" in r && r.magicLink) {
          setMagicLinkDialog({
            link: r.magicLink,
            warning: r.warning ?? "Distribute through an approved channel only.",
          });
        } else {
          setMsg(r.ok ? "Invite email sent (or queued)." : "Done");
        }
        router.refresh();
      })();
    });
  }

  return (
    <div className="space-y-8 max-w-6xl">
      {dataSource === "mock" && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
          Mock detail — actions will fail against real API. Use <code className="font-mono text-xs">ADMIN_ONBOARDING_MOCK=0</code>.
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
          <p className="text-xs font-mono text-muted-foreground mt-1 break-all">{org.id}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <LaunchStateBadge state={onboarding?.launch_state} />
            {onboarding?.completed_at && <Badge className="bg-emerald-700">Launched (record)</Badge>}
            <Badge variant="outline">Starter pack: {packStatus}</Badge>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={ADMIN_ONBOARDING_BASE_PATH}>← All orgs</Link>
        </Button>
      </div>

      {(msg || err) && (
        <p
          className={`text-sm rounded-md px-3 py-2 ${err ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}
        >
          {err ?? msg}
        </p>
      )}

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-border p-4 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Org summary</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Provision key</dt>
            <dd className="font-mono text-xs break-all">{org.provisioning_idempotency_key ?? "—"}</dd>
            <dt className="text-muted-foreground">Owner user</dt>
            <dd className="font-mono text-xs break-all">{ownerUserId ?? "—"}</dd>
            <dt className="text-muted-foreground">Owner email</dt>
            <dd className="font-mono text-xs break-all">{ownerInvite.ownerEmail ?? "—"}</dd>
            <dt className="text-muted-foreground">Created</dt>
            <dd className="text-xs">{new Date(org.created_at).toLocaleString()}</dd>
          </dl>
        </div>
        <div className="rounded-lg border border-border p-4 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Onboarding summary</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Mode</dt>
            <dd className="font-mono text-xs">{onboarding?.onboarding_mode ?? "—"}</dd>
            <dt className="text-muted-foreground">Industry</dt>
            <dd>{onboarding?.industry ?? "—"}</dd>
            <dt className="text-muted-foreground">Plan</dt>
            <dd>{onboarding?.plan_key ?? "—"}</dd>
            <dt className="text-muted-foreground">Wizard step</dt>
            <dd>{onboarding?.current_step ?? "—"}</dd>
          </dl>
        </div>
      </section>

      {hasBlockerDetail && (
        <section className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Blocker (support)</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Category</dt>
            <dd className="font-mono text-xs">{onboarding?.blocker_category ?? "—"}</dd>
            <dt className="text-muted-foreground">Reason</dt>
            <dd className="text-sm whitespace-pre-wrap">{onboarding?.blocker_reason ?? "—"}</dd>
            <dt className="text-muted-foreground">Flagged</dt>
            <dd className="text-xs font-mono break-all">
              {onboarding?.blocker_flagged_at
                ? `${new Date(onboarding.blocker_flagged_at).toLocaleString()} · ${onboarding.blocker_flagged_by ?? "?"}`
                : "—"}
            </dd>
            <dt className="text-muted-foreground">Cleared</dt>
            <dd className="text-xs font-mono break-all">
              {onboarding?.blocker_cleared_at
                ? `${new Date(onboarding.blocker_cleared_at).toLocaleString()} · ${onboarding.blocker_cleared_by ?? "?"}`
                : "—"}
            </dd>
            <dt className="text-muted-foreground">Resolution note</dt>
            <dd className="text-sm whitespace-pre-wrap">{onboarding?.blocker_resolution_note ?? "—"}</dd>
          </dl>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button size="sm" variant="destructive" disabled={pending || dataSource === "mock"} onClick={() => setFlagBlockerOpen(true)}>
              Flag / update blocker
            </Button>
            <Button size="sm" variant="outline" disabled={pending || dataSource === "mock"} onClick={() => setClearBlockerOpen(true)}>
              Clear blocker
            </Button>
          </div>
        </section>
      )}

      {!hasBlockerDetail && onboarding?.launch_state !== "blocked" && (
        <section className="rounded-lg border border-border p-4 space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Blocker</h2>
          <p className="text-xs text-muted-foreground">No active blocker record. Use flag if rollout is stalled.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="destructive" disabled={pending || dataSource === "mock"} onClick={() => setFlagBlockerOpen(true)}>
              Flag blocker
            </Button>
            <Button size="sm" variant="outline" disabled={pending || dataSource === "mock"} onClick={() => setClearBlockerOpen(true)}>
              Clear blocker (metadata)
            </Button>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-border p-4 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Assign industry / plan</h2>
        <p className="text-xs text-muted-foreground">Validated on the server (Zod). Includes operational keys such as “other”.</p>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const industry = String(fd.get("industry") ?? "");
            const plan_key = String(fd.get("plan_key") ?? "");
            run(() => adminUpdateOnboardingIndustryPlan(org.id, { industry, plan_key }));
          }}
        >
          <div className="space-y-1">
            <Label className="text-xs">Industry</Label>
            <select
              name="industry"
              defaultValue={industryDefault}
              className="flex h-9 rounded-md border border-input bg-background px-2 py-1 text-sm min-w-[180px]"
            >
              {ADMIN_ONBOARDING_INDUSTRY_KEYS.map((k) => (
                <option key={k} value={k}>
                  {industryLabel(k)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Plan key</Label>
            <Input name="plan_key" defaultValue={onboarding?.plan_key ?? ""} placeholder="pilot, growth…" className="h-9 w-40" />
          </div>
          <Button type="submit" size="sm" disabled={pending || dataSource === "mock"}>
            Save
          </Button>
        </form>
      </section>

      <section className="rounded-lg border border-border p-4 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Owner invite</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {inviteStatusBadge(ownerInvite.status)}
          <span className="text-xs text-muted-foreground">
            Last sent: {ownerInvite.lastSentAt ? new Date(ownerInvite.lastSentAt).toLocaleString() : "—"}
          </span>
          <span className="text-xs text-muted-foreground">
            Accepted: {ownerInvite.acceptedAt ? new Date(ownerInvite.acceptedAt).toLocaleString() : "—"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Status merges Supabase Auth (confirmed email / last sign-in) with the invite audit log. Resend uses Auth admin invite;
          if the user already exists, a one-time magic link is generated for operator handoff (not stored in the database).
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={pending || dataSource === "mock" || !ownerUserId}
            onClick={() => setConfirm("invite")}
          >
            Resend owner invite…
          </Button>
        </div>
        {ownerInviteLog.length > 0 && (
          <div className="rounded-md border border-border/60 max-h-36 overflow-y-auto text-xs">
            <div className="sticky top-0 bg-muted/80 px-2 py-1 font-medium">Recent invite attempts (audit)</div>
            <ul className="divide-y divide-border/60">
              {ownerInviteLog.map((row) => (
                <li key={row.id} className="px-2 py-1.5 font-mono">
                  <span className="text-muted-foreground">{new Date(row.created_at).toLocaleString()}</span> · {row.action}{" "}
                  <span className="text-foreground">{row.status}</span>
                  {row.error_message ? <span className="text-destructive ml-1">— {row.error_message}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border p-4 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Support notes</h2>
        <p className="text-xs text-muted-foreground">Append-only internal notes. Author and time are recorded for audit.</p>
        <div className="space-y-2 max-h-56 overflow-y-auto rounded-md border border-border/60 divide-y divide-border/60">
          {supportNotes.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">No notes yet.</p>
          ) : (
            supportNotes.map((n) => (
              <div key={n.id} className="p-3 text-sm space-y-1">
                <div className="text-[11px] text-muted-foreground">
                  {new Date(n.created_at).toLocaleString()}
                  {n.created_by_email ? ` · ${n.created_by_email}` : n.created_by ? ` · ${n.created_by}` : ""}
                </div>
                <p className="whitespace-pre-wrap">{n.body}</p>
              </div>
            ))
          )}
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Add note</Label>
          <Textarea
            value={supportNoteDraft}
            onChange={(e) => setSupportNoteDraft(e.target.value)}
            placeholder="Internal context only — customer-visible content belongs elsewhere."
            className="min-h-[80px] text-sm"
            disabled={dataSource === "mock"}
          />
          <Button
            size="sm"
            disabled={pending || dataSource === "mock" || !supportNoteDraft.trim()}
            onClick={() => {
              const body = supportNoteDraft;
              setSupportNoteDraft("");
              run(() => adminAddSupportNote(org.id, body));
            }}
          >
            Add note
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border p-4 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">First location</h2>
        <form
          className="flex flex-wrap gap-3 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const name = String(fd.get("loc_name") ?? "");
            const address = String(fd.get("loc_address") ?? "") || null;
            run(() => adminCreateFirstLocation(org.id, name, address));
          }}
        >
          <div className="space-y-1 flex-1 min-w-[180px]">
            <Label className="text-xs">Name</Label>
            <Input name="loc_name" required placeholder="Building A" className="h-9" disabled={dataSource === "mock"} />
          </div>
          <div className="space-y-1 flex-[2] min-w-[220px]">
            <Label className="text-xs">Address (optional)</Label>
            <Input name="loc_address" placeholder="123 Main St…" className="h-9" disabled={dataSource === "mock"} />
          </div>
          <Button type="submit" size="sm" variant="secondary" disabled={pending || dataSource === "mock"}>
            Create (idempotent)
          </Button>
        </form>
        <div className="rounded-md bg-muted/40 border border-border/60 divide-y max-h-40 overflow-y-auto">
          {locations.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">No locations.</p>
          ) : (
            locations.map((loc) => (
              <div key={loc.id} className="p-2 text-sm flex justify-between gap-2">
                <span className="font-medium">{loc.name}</span>
                <span className="text-xs text-muted-foreground truncate">{loc.address ?? "—"}</span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Operational actions</h2>
        <p className="text-xs text-muted-foreground">
          All server-side; provisioning engine handles idempotency. Destructive / broad actions require confirmation.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={pending || dataSource === "mock"} onClick={() => run(() => adminEnsureOnboardingRow(org.id))}>
            Ensure onboarding row
          </Button>
          <Button size="sm" variant="secondary" disabled={pending || dataSource === "mock"} onClick={() => run(() => adminSeedRoles(org.id))}>
            Seed roles
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending || dataSource === "mock"}
            onClick={() => run(() => adminApplyStarterPack(org.id, false))}
          >
            Apply starter pack
          </Button>
          <Button size="sm" variant="outline" disabled={pending || dataSource === "mock"} onClick={() => setConfirm("starter_force")}>
            Retry starter pack (new key)
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending || dataSource === "mock"}
            onClick={() => run(() => adminEnsureWorkforceSettings(org.id))}
          >
            Workforce defaults
          </Button>
          <Button size="sm" variant="outline" disabled={pending || dataSource === "mock"} onClick={() => run(() => adminSyncActivation(org.id))}>
            Sync activation from data
          </Button>
          <Button size="sm" variant="outline" disabled={pending || dataSource === "mock"} onClick={() => setConfirm("replay")}>
            Replay full provision
          </Button>
          <Button size="sm" variant="outline" disabled={pending || dataSource === "mock"} onClick={() => setConfirm("legacy_blocked")}>
            Legacy: set blocked (minimal metadata)
          </Button>
          <Button size="sm" disabled={pending || dataSource === "mock"} onClick={() => setConfirm("launched")}>
            Mark launched
          </Button>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Activation steps</h2>
          <OnboardingStepsPanel steps={steps} />
        </div>
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Provisioning timeline</h2>
          <ProvisioningTimeline events={events} />
        </div>
      </section>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm === "replay" && "Replay full provision?"}
              {confirm === "launched" && "Mark launched?"}
              {confirm === "invite" && "Resend owner invite?"}
              {confirm === "legacy_blocked" && "Set blocked (legacy)?"}
              {confirm === "starter_force" && "Retry starter pack with new idempotency key?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirm === "replay" &&
              "Re-runs provisionOrganization with the stored provisioning idempotency key. Safe to retry; completed steps no-op."}
            {confirm === "launched" && "Sets launch_state to launched and completes wizard. Confirm customer is actually live."}
            {confirm === "invite" &&
              "Sends an Auth invite email when possible. If the account already exists, a magic link will be shown once — copy it and send through your approved channel."}
            {confirm === "legacy_blocked" &&
              "Sets blocked state with generic category/reason for backwards compatibility. Prefer “Flag blocker” with structured fields when possible."}
            {confirm === "starter_force" &&
              "Forces a new starter pack idempotency suffix — use when templates changed and you need another load."}
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant={confirm === "starter_force" || confirm === "legacy_blocked" ? "destructive" : "default"}
              disabled={pending || dataSource === "mock"}
              onClick={() => {
                const c = confirm;
                setConfirm(null);
                if (c === "replay") run(() => adminRetryProvisionWithStoredKey(org.id));
                if (c === "launched") run(() => adminMarkLaunched(org.id));
                if (c === "invite") runInviteResend();
                if (c === "legacy_blocked") run(() => adminSetLaunchState(org.id, "blocked"));
                if (c === "starter_force") run(() => adminApplyStarterPack(org.id, true));
              }}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={magicLinkDialog !== null} onOpenChange={(o) => !o && setMagicLinkDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Magic link (one-time)</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-destructive">{magicLinkDialog?.warning}</p>
          <Label className="text-xs">Link</Label>
          <Textarea readOnly className="font-mono text-[11px] min-h-[100px]" value={magicLinkDialog?.link ?? ""} />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (magicLinkDialog?.link) void navigator.clipboard.writeText(magicLinkDialog.link);
              }}
            >
              Copy
            </Button>
            <Button onClick={() => setMagicLinkDialog(null)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={flagBlockerOpen} onOpenChange={setFlagBlockerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flag blocker</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Sets launch_state to blocked and records category, reason, and actor timestamp.</p>
          <div className="space-y-2">
            <Label className="text-xs">Category</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
              value={blockerCategory}
              onChange={(e) => setBlockerCategory(e.target.value)}
            >
              {BLOCKER_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <Label className="text-xs">Reason</Label>
            <Textarea value={blockerReason} onChange={(e) => setBlockerReason(e.target.value)} className="min-h-[72px] text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setFlagBlockerOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending || dataSource === "mock" || blockerReason.trim().length < 3}
              onClick={() => {
                setFlagBlockerOpen(false);
                run(() =>
                  adminFlagBlocker(org.id, {
                    category: blockerCategory as (typeof BLOCKER_CATEGORIES)[number],
                    reason: blockerReason.trim(),
                  })
                );
              }}
            >
              Flag
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={clearBlockerOpen} onOpenChange={setClearBlockerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear blocker</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Sets launch_state to in_progress and records who cleared it. Optional resolution note.</p>
          <Label className="text-xs">Resolution note (optional)</Label>
          <Textarea
            value={clearResolutionNote}
            onChange={(e) => setClearResolutionNote(e.target.value)}
            className="min-h-[72px] text-sm"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setClearBlockerOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={pending || dataSource === "mock"}
              onClick={() => {
                setClearBlockerOpen(false);
                run(() =>
                  adminClearBlocker(org.id, {
                    resolution_note: clearResolutionNote.trim() || undefined,
                  })
                );
              }}
            >
              Clear
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
