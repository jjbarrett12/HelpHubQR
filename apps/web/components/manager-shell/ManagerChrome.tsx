"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ManagerSidebarNav } from "./ManagerSidebarNav";
import { ManagerTopBar } from "./ManagerTopBar";
import { ManagerOrgSelector } from "./ManagerOrgSelector";

type Props = {
  children: React.ReactNode;
  organizations: { id: string; name: string }[];
  activeOrganizationId: string | null;
  sidebarLogoUrl: string | null;
  sidebarLogoAlt: string;
};

export function ManagerChrome({
  children,
  organizations,
  activeOrganizationId,
  sidebarLogoUrl,
  sidebarLogoAlt,
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const operationalDateLabel = useMemo(() => {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date());
  }, []);

  return (
    <div className="flex min-h-screen bg-[var(--app-bg)] text-foreground">
      {/* Mobile overlay */}
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[min(17rem,88vw)] transition-transform duration-200 md:static md:z-0 md:translate-x-0",
          mobileOpen ? "translate-x-0 shadow-xl" : "-translate-x-full md:translate-x-0",
          collapsed ? "md:w-[4.25rem]" : "md:w-60"
        )}
      >
        <div className="flex h-full flex-col bg-card md:bg-transparent">
          <ManagerSidebarNav
            logoUrl={sidebarLogoUrl}
            logoAlt={sidebarLogoAlt}
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed((c) => !c)}
          />
          <div className="border-t border-border/50 p-3 md:hidden">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Organization</p>
            <ManagerOrgSelector organizations={organizations} activeOrganizationId={activeOrganizationId} />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col md:ml-0">
        <ManagerTopBar
          organizations={organizations}
          activeOrganizationId={activeOrganizationId}
          operationalDateLabel={operationalDateLabel}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main
          className="flex-1 overflow-auto border-l border-border/40 bg-[var(--app-bg)] focus:outline-none"
          aria-label="Main content"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
