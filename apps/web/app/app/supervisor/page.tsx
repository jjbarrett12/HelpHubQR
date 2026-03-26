import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Legacy path — checklist runs is the primary operational view. */
export default async function SupervisorPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const q =
    filter === "overdue" || filter === "escalated" || filter === "open" || filter === "all"
      ? `?filter=${filter}`
      : "";
  redirect(`/app/checklist-runs${q}`);
}
