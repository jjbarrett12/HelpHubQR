"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OnboardingProgress } from "./OnboardingProgress";
import {
  onboardingApplyStarterPack,
  onboardingAttachExistingOrg,
  onboardingCreateWorkspace,
  onboardingFinish,
  onboardingInviteContinue,
  onboardingOperatingContinue,
  onboardingSaveLocation,
  onboardingSkipLocation,
  onboardingSkipStarterPack,
  onboardingTeamContinue,
} from "@/app/app/onboarding/actions";
import { STARTER_PACKS } from "@/lib/onboarding/starter-packs";
import type { OnboardingWizardStepSlug } from "@/lib/onboarding/types";
import type { OrganizationOnboardingRow, OrganizationOnboardingStepRow } from "@/lib/onboarding/types";
import { nextWizardStep } from "@/lib/onboarding/wizard-steps";

const INDUSTRY_OPTIONS = Object.keys(STARTER_PACKS);

type Props = {
  step: OnboardingWizardStepSlug;
  organizationId: string | null;
  onboarding: OrganizationOnboardingRow | null;
  activationSteps: OrganizationOnboardingStepRow[];
};

export function OnboardingStepForms({ step, organizationId, onboarding, activationSteps }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(
    fn: () => Promise<{ error?: string; ok?: boolean; organizationId?: string }>,
    navigateTo?: string
  ) {
    setError(null);
    start(() => {
      void (async () => {
        const r = await fn();
        if (r?.error) setError(r.error);
        else {
          if (navigateTo) router.push(navigateTo);
          router.refresh();
        }
      })();
    });
  }

  function pathForStep(s: OnboardingWizardStepSlug | null) {
    if (!s) return "/app/onboarding";
    return `/app/onboarding/${s}`;
  }

  return (
    <div>
      <OnboardingProgress active={step} />
      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {step === "workspace" && (
        <WorkspaceSection
          organizationId={organizationId}
          pending={pending}
          onCreate={(fd) =>
            run(async () => onboardingCreateWorkspace(fd), pathForStep(nextWizardStep("workspace")))
          }
          onAttach={() => run(() => onboardingAttachExistingOrg(), pathForStep(nextWizardStep("workspace")))}
        />
      )}

      {step === "location" && organizationId && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => onboardingSaveLocation(new FormData(e.currentTarget)), pathForStep(nextWizardStep("location")));
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="location_name">First location name</Label>
            <Input id="location_name" name="location_name" placeholder="e.g. Main site" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address (optional)</Label>
            <Input id="address" name="address" placeholder="123 Main St" />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              Save & continue
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => onboardingSkipLocation(), pathForStep(nextWizardStep("location")))}
            >
              Skip for now
            </Button>
          </div>
        </form>
      )}

      {step === "team" && organizationId && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => onboardingTeamContinue(new FormData(e.currentTarget)), pathForStep(nextWizardStep("team")));
          }}
        >
          <p className="text-sm text-muted-foreground">
            Default shift roles are created from your industry. Adjust industry if needed — you can edit roles later in
            Team.
          </p>
          <div className="space-y-2">
            <Label htmlFor="team-industry">Industry</Label>
            <select
              id="team-industry"
              name="industry"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              defaultValue={(onboarding?.industry as string) || "general"}
            >
              {INDUSTRY_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {STARTER_PACKS[k]?.displayName ?? k}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={pending}>
            Continue
          </Button>
        </form>
      )}

      {step === "operating" && organizationId && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We will enable default workforce coordination settings (claims, trades, approvals). You can tune them under
            Shift operations later.
          </p>
          <Button
            disabled={pending}
            onClick={() => run(() => onboardingOperatingContinue(), pathForStep(nextWizardStep("operating")))}
          >
            Apply defaults & continue
          </Button>
        </div>
      )}

      {step === "templates" && organizationId && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Load checklist templates and issue categories for your industry ({onboarding?.industry ?? "general"}). Safe to
            retry — provisioning is idempotent.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button
              disabled={pending}
              onClick={() => run(() => onboardingApplyStarterPack(), pathForStep(nextWizardStep("templates")))}
            >
              Load starter pack
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => run(() => onboardingSkipStarterPack(), pathForStep(nextWizardStep("templates")))}
            >
              Skip
            </Button>
          </div>
        </div>
      )}

      {step === "invite" && organizationId && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Invite managers from <Link className="text-neon underline" href="/app/team">Team</Link> when you are ready.
            Employees are added there as well.
          </p>
          <Button
            disabled={pending}
            onClick={() => run(() => onboardingInviteContinue(), pathForStep(nextWizardStep("invite")))}
          >
            Continue
          </Button>
        </div>
      )}

      {step === "activation" && organizationId && (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Finish setup by running something real: preview Today, create a QR destination, or schedule a shift.
          </p>
          <ul className="text-sm space-y-2 list-disc pl-5">
            <li>
              <Link className="text-neon underline" href="/app/today">
                Open Today
              </Link>
            </li>
            <li>
              <Link className="text-neon underline" href="/app/checklists">
                Checklists
              </Link>
            </li>
            <li>
              <Link className="text-neon underline" href="/app/qr-hub">
                QR hub
              </Link>
            </li>
            <li>
              <Link className="text-neon underline" href="/app/schedule">
                Schedule
              </Link>
            </li>
          </ul>
          <ActivationChecklist rows={activationSteps} />
          <Button disabled={pending} onClick={() => run(() => onboardingFinish(), "/app/today")}>
            Mark setup complete
          </Button>
        </div>
      )}
    </div>
  );
}

function ActivationChecklist({ rows }: { rows: OrganizationOnboardingStepRow[] }) {
  const byKey = new Map(rows.map((r) => [r.step_key, r]));
  const keys = [
    "location_created",
    "starter_templates_loaded",
    "managers_invited",
    "employees_invited",
    "qr_destinations_created",
    "first_shift_created",
    "first_checklist_run_completed",
  ] as const;
  return (
    <div className="rounded-lg border border-border p-4 bg-card/40">
      <p className="text-sm font-medium mb-2">Activation checklist</p>
      <ul className="text-sm space-y-1">
        {keys.map((k) => {
          const st = byKey.get(k)?.status;
          const done = st === "completed" || st === "skipped";
          return (
            <li key={k} className={done ? "text-muted-foreground line-through" : ""}>
              {k.replace(/_/g, " ")}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function WorkspaceSection({
  organizationId,
  pending,
  onCreate,
  onAttach,
}: {
  organizationId: string | null;
  pending: boolean;
  onCreate: (fd: FormData) => void;
  onAttach: () => void;
}) {
  if (organizationId) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">You already have a workspace. Continue setup for this organization.</p>
        <Button disabled={pending} onClick={() => onAttach()}>
          Continue with current workspace
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onCreate(new FormData(e.currentTarget));
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="name">Workspace name</Label>
        <Input id="name" name="name" placeholder="Your company" required />
      </div>
      <div className="space-y-2">
        <Label>Industry</Label>
        <select
          name="industry"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          defaultValue="general"
        >
          {INDUSTRY_OPTIONS.map((k) => (
            <option key={k} value={k}>
              {STARTER_PACKS[k]?.displayName ?? k}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        Create workspace
      </Button>
    </form>
  );
}
