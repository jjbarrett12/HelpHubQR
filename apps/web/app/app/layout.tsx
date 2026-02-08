import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/dashboard/AppSidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    redirect("/login");
  }
  return (
    <div className="flex min-h-screen bg-transparent">
      <AppSidebar />
      <main className="flex-1 overflow-auto border-l border-sidebar min-h-screen bg-card/30 dark:bg-app-dark border-card-border focus:outline-none" aria-label="Main content">
        {children}
      </main>
    </div>
  );
}
