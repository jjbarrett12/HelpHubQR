"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { primaryNavSections, toolsNavSection, isNavActive } from "./nav-config";
import { LogOut, PanelLeftClose, PanelLeft } from "lucide-react";
import { useState } from "react";

type Props = {
  logoUrl: string | null;
  logoAlt: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

export function ManagerSidebarNav({ logoUrl, logoAlt, collapsed, onToggleCollapse }: Props) {
  const pathname = usePathname() ?? "";
  const [toolsOpen, setToolsOpen] = useState(false);

  const linkClass = (active: boolean) =>
    cn(
      "w-full justify-start gap-2 h-9 px-2 text-sm font-medium rounded-md transition-colors",
      active
        ? "bg-primary/15 text-primary border border-primary/25 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.2)]"
        : "text-muted-foreground hover:text-foreground hover:bg-muted/80 border border-transparent"
    );

  return (
    <div className="flex h-full flex-col border-r border-border/60 bg-card/95 backdrop-blur-sm dark:bg-[hsl(var(--sidebar-bg,0_0%_6%))] dark:border-border/40">
      <div className="flex items-center gap-2 border-b border-border/50 px-3 py-4">
        <Link
          href="/app/today"
          className={cn("min-w-0 flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md", collapsed && "flex justify-center")}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={logoAlt}
              className={cn("h-9 w-auto max-w-full object-contain object-left", collapsed && "object-center")}
            />
          ) : (
            <Image
              src="/helphub-logo.png"
              alt="HelpHubQR"
              width={140}
              height={36}
              className={cn("h-9 w-auto object-contain object-left", collapsed && "object-center")}
            />
          )}
        </Link>
        {onToggleCollapse ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hidden md:flex"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        ) : null}
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-2 py-4" aria-label="Main">
        {primaryNavSections.map((section) => (
          <div key={section.id}>
            {!collapsed ? (
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {section.label}
              </p>
            ) : null}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isNavActive(pathname, item);
                return (
                  <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined}>
                    <Button variant="ghost" className={linkClass(active)}>
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed ? <span className="truncate">{item.label}</span> : null}
                    </Button>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        <div>
          {!collapsed ? (
            <button
              type="button"
              onClick={() => setToolsOpen((o) => !o)}
              className="mb-2 flex w-full items-center justify-between px-2 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
            >
              {toolsNavSection.label}
              <span className="text-xs">{toolsOpen ? "−" : "+"}</span>
            </button>
          ) : null}
          {(collapsed || toolsOpen) ? (
            <div className="space-y-0.5">
              {toolsNavSection.items.map((item) => {
                const Icon = item.icon;
                const active = isNavActive(pathname, item);
                return (
                  <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined}>
                    <Button variant="ghost" className={linkClass(active)}>
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed ? <span className="truncate">{item.label}</span> : null}
                    </Button>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      </nav>

      <div className="border-t border-border/50 p-2">
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="ghost" className="w-full justify-start gap-2 h-9 text-muted-foreground">
            <LogOut className="h-4 w-4" />
            {!collapsed ? "Sign out" : null}
          </Button>
        </form>
      </div>
    </div>
  );
}
