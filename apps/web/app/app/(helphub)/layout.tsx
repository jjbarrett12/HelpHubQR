/**
 * Help Hub feature routes share no extra chrome — organization switching lives in the manager top bar
 * (ManagerChrome + ManagerOrgSelector).
 */
export default function HelphubSectionLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-full">{children}</div>;
}
