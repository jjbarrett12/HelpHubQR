"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOrganization, setActiveOrganization } from "@/app/app/helphub/actions/org";

type Props = {
  organizations: { id: string; name: string }[];
  activeOrganizationId: string | null;
};

export function HelpHubOrgBar({ organizations, activeOrganizationId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border/60 bg-muted/30 px-6 py-3 text-sm">
      <span className="font-medium text-muted-foreground">Organization</span>
      <select
        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm disabled:opacity-50"
        disabled={pending || organizations.length === 0}
        value={activeOrganizationId ?? ""}
        onChange={(e) => {
          const id = e.target.value;
          if (!id) return;
          startTransition(async () => {
            await setActiveOrganization(id);
            router.refresh();
          });
        }}
      >
        {organizations.length === 0 ? (
          <option value="">No organizations yet</option>
        ) : (
          organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))
        )}
      </select>
      <details className="relative">
        <summary className="cursor-pointer list-none rounded-md border border-dashed border-border px-2 py-1 text-muted-foreground hover:text-foreground">
          + New organization
        </summary>
        <div className="absolute left-0 z-20 mt-2 w-72 rounded-md border bg-card p-3 shadow-md">
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                await createOrganization(fd);
                router.refresh();
                (e.currentTarget as HTMLFormElement).reset();
              });
            }}
          >
            <input name="name" placeholder="Company name" className="w-full rounded-md border px-2 py-1.5 text-sm" required />
            <button type="submit" className="w-full rounded-md bg-primary px-2 py-1.5 text-sm text-primary-foreground">
              Create
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}
