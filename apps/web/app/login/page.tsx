import Image from "next/image";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { LoginRedirect } from "@/components/LoginRedirect";

const isSupabaseConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

export default function LoginPage() {
  const configured = isSupabaseConfigured();
  return (
    <>
      <Suspense fallback={null}>
        <LoginRedirect />
      </Suspense>
    <main
      className="min-h-screen flex flex-col items-center pt-[12vh] p-4"
      style={{
        background: "linear-gradient(152deg, #e0f2fe 0%, #bae6fd 25%, #7dd3fc 50%, #38bdf8 65%, #0ea5e9 85%, #0284c7 100%)",
      }}
    >
      <div className="w-full max-w-sm space-y-5">
        <div className="flex justify-center [&_img]:drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]">
          <Image
            src="/helphub-logo.png"
            alt="HelpHub"
            width={280}
            height={80}
            className="object-contain w-full max-w-[280px]"
            priority
          />
        </div>
        <div className="rounded-xl bg-white/95 shadow-xl p-6 space-y-4">
          {!configured && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-medium">Connection not configured</p>
              <p className="mt-1 text-amber-800">
                Copy <code className="rounded bg-amber-100 px-1">apps/web/.env.example</code> to{" "}
                <code className="rounded bg-amber-100 px-1">apps/web/.env.local</code> and set your Supabase URL and anon key.
              </p>
            </div>
          )}
          <div>
            <p className="text-center text-sm text-neutral-600 mb-4">
              Staff sign in
            </p>
            <Suspense fallback={<p className="text-center text-sm text-neutral-500">Loading…</p>}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
    </>
  );
}
