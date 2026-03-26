import { redirect } from "next/navigation";

/** Legacy URL — template builder lives under /templates/[id]. */
export default function LegacyChecklistTemplateRedirect({ params }: { params: { id: string } }) {
  redirect(`/app/checklists/templates/${params.id}`);
}
