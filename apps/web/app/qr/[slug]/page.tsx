import { notFound } from "next/navigation";
import { loadPublicQrBySlug } from "@/lib/qr/public-load";
import { QrTypeRenderer } from "@/components/qr-public/QrTypeRenderer";

export const dynamic = "force-dynamic";

export default async function PublicQrPage({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug);
  const payload = await loadPublicQrBySlug(slug);
  if (!payload) notFound();
  return <QrTypeRenderer payload={payload} />;
}
