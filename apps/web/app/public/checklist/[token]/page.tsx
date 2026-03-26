import { notFound } from "next/navigation";
import { loadPublicChecklistByToken, markPublicRunOpenedIfNeeded } from "@/lib/helphub/public-checklist";
import { PublicChecklistClient } from "@/components/helphub/PublicChecklistClient";

export default async function PublicChecklistPage({ params }: { params: { token: string } }) {
  const token = decodeURIComponent(params.token);
  const data = await loadPublicChecklistByToken(token);
  if (!data) notFound();

  await markPublicRunOpenedIfNeeded(token);

  const refreshed = await loadPublicChecklistByToken(token);
  if (!refreshed) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicChecklistClient token={token} initial={refreshed} />
    </div>
  );
}
