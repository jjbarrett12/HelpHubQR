import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AppHomePage() {
  const supabase = await createClient();
  const { data: sites } = await supabase.from("sites").select("id, name").order("name");
  if (sites?.length) {
    redirect(`/app/sites/${sites[0].id}`);
  }
  redirect("/app/admin/sites");
}
