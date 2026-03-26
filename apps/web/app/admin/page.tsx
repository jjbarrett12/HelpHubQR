import { redirect } from "next/navigation";
import { ADMIN_ONBOARDING_BASE_PATH } from "@/lib/admin-onboarding/constants";

export default function AdminIndexPage() {
  redirect(ADMIN_ONBOARDING_BASE_PATH);
}
