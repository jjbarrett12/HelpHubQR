import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  ClipboardList,
  LayoutGrid,
  QrCode,
  Scale,
  Settings,
  Users,
  Inbox,
  AlertTriangle,
  ListChecks,
  UserCog,
  MapPin,
  Briefcase,
  Tags,
  ImagePlus,
  Mail,
  ListTodo,
  Shield,
  HelpCircle,
  Sparkles,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** If true, active when pathname starts with href + "/" */
  prefixMatch?: boolean;
};

export type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

/** Primary command-center modules (product-facing names). */
export const primaryNavSections: NavSection[] = [
  {
    id: "operations",
    label: "Operations",
    items: [
      { href: "/app/today", label: "Today", icon: LayoutGrid },
      { href: "/app/schedule", label: "Schedule", icon: CalendarDays, prefixMatch: true },
      { href: "/app/checklists", label: "Checklists", icon: ClipboardList, prefixMatch: true },
      { href: "/app/requests", label: "Requests", icon: Inbox, prefixMatch: true },
    ],
  },
  {
    id: "workplace",
    label: "Workplace",
    items: [
      { href: "/app/qr-hub", label: "QR hub", icon: QrCode, prefixMatch: true },
      { href: "/app/issues", label: "Issues", icon: AlertTriangle, prefixMatch: true },
    ],
  },
  {
    id: "people",
    label: "People",
    items: [{ href: "/app/team", label: "Team", icon: Users, prefixMatch: true }],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    items: [{ href: "/app/fairness", label: "Fairness", icon: Scale, prefixMatch: true }],
  },
  {
    id: "system",
    label: "System",
    items: [
      { href: "/app/onboarding", label: "Setup", icon: Sparkles, prefixMatch: true },
      { href: "/app/settings", label: "Settings", icon: Settings, prefixMatch: true },
    ],
  },
];

/** Deeper tools — still operational, grouped for scanability. */
export const toolsNavSection: NavSection = {
  id: "tools",
  label: "More tools",
  items: [
    { href: "/app/shift-ops", label: "Shift operations", icon: UserCog, prefixMatch: true },
    { href: "/app/checklist-runs", label: "Today’s runs", icon: ListChecks, prefixMatch: true },
    { href: "/app/employees", label: "Employees", icon: Users, prefixMatch: true },
    { href: "/app/roles", label: "Roles", icon: Briefcase, prefixMatch: true },
    { href: "/app/locations", label: "Locations", icon: MapPin, prefixMatch: true },
    { href: "/app/task-taxonomy", label: "Task taxonomy", icon: Tags, prefixMatch: true },
    { href: "/app/checklists/import", label: "Import checklist", icon: ImagePlus, prefixMatch: true },
    { href: "/app/delivery-settings", label: "Delivery settings", icon: Mail, prefixMatch: true },
    { href: "/app/my-shifts", label: "My shifts", icon: CalendarDays, prefixMatch: true },
    { href: "/app/my-requests", label: "My requests", icon: ListTodo, prefixMatch: true },
    { href: "/platform-admin", label: "Platform admin", icon: Shield, prefixMatch: true },
    { href: "/app/help", label: "Help", icon: HelpCircle, prefixMatch: true },
  ],
};

export function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.prefixMatch) {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }
  return pathname === item.href;
}
