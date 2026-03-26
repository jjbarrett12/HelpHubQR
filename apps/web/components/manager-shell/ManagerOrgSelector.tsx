"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOrganization, setActiveOrganization } from "@/app/app/helphub/actions/org";
import { Button } from "@/components/ui/button";

type Props = {
  organizations: { id: string; name: string }[];
  activeOrganizationId: string | null;
};

/** Compact org switcher for the command top bar. Supabase: same actions as full org bar. */
export function ManagerOrgSelector({ organizations, activeOrganizationId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="manager-org-select">
        Organization
      </label>
      <select
        id="manager-org-select"
        className="h-9 max-w-[200px] truncate rounded-md border border-input bg-background px-2 text-xs font-medium md:max-w-[240px]"
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
          <option value="">No organizations</option>
        ) : (
          organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))
        )}
      </select>
      <details className="relative">
        <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
          <Button type="button" variant="ghost" size="sm" className="h-9 px-2 text-xs text-muted-foreground">
            + New
          </Button>
        </summary>
        <div className="absolute left-0 z-50 mt-1 w-64 rounded-lg border bg-card p-3 shadow-lg">
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
            <input
              name="name"
              placeholder="Organization name"
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              required
            />
            <Button type="submit" size="sm" className="w-full" disabled={pending}>
              Create
            </Button>
          </form>
        </div>
      </details>
    </div>
  );
}
