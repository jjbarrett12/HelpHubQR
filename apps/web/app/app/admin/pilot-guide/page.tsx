import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function PilotGuidePage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  return (
    <div className="p-6 max-w-3xl">
      <nav className="mb-6 flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app">Dashboard</Link>
        </Button>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-2xl font-semibold tracking-tight">Pilot onboarding checklist</h1>
      </nav>

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
        <p>Use this checklist to onboard a pilot property in under 2 hours.</p>

        <section>
          <h2 className="text-lg font-semibold">1. Create property + branding (≈15 min)</h2>
          <p>Create the property in the database; link the supervisor account in <strong>supervisor_profiles</strong>. In the app go to <strong>Property – MVP config</strong> and set name, timezone, logo URL, primary color, support phone.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. Import rooms/locations (≈15 min)</h2>
          <p>Add <strong>locations</strong> (type: room or public_area, identifier: e.g. room number). Ensure each has a <strong>qr_codes</strong> row with a secure random qrId.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">3. Request types + SLAs (≈10 min)</h2>
          <p>In Property – MVP config, keep <strong>6–10</strong> request types. Set default SLA (minutes) and Active per type.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">4. Generate QR codes and print (≈20 min)</h2>
          <p>Use <strong>QR code export</strong> on the property page: Download CSV, then Print / PDF. Guest URLs are <code>APP_URL/q/qrId</code>. Place printed QRs in each room.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">5. BOH shift token (≈5 min)</h2>
          <p>Create a <strong>shift_tokens</strong> row for the property. Post a staff QR or instructions so staff can tap &quot;I&apos;m staff&quot; and enter the shift key on shared devices.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">6. Train supervisors (≈15 min)</h2>
          <p>Show the <strong>Supervisor</strong> console: Open / Overdue / Escalated filters, task detail with event timeline and proof of work. Optional: <code>GET /api/metrics</code> for counts and SLA %.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">7. Train staff (≈10 min)</h2>
          <p>Scan room QR → &quot;I&apos;m staff&quot; → enter shift key. One screen: Start / Complete (optional note + photo) / Escalate. Offline actions queue and sync when back online.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">8. Run pilot (4 weeks)</h2>
          <p>Daily champion check-in. Review adoption %, SLA %, time-to-response, reopen rate.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Success targets</h2>
          <ul>
            <li>70%+ of eligible tasks captured</li>
            <li>60%+ staff adoption (by events)</li>
            <li>Observable reduction in radio/call volume</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
