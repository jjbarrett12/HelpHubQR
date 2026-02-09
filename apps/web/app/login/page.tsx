import Image from "next/image";
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
      <LoginRedirect />
    <main
      className="min-h-screen flex flex-col items-center pt-[12vh] p-4"
      style={{
        background: "linear-gradient(152deg, #2a1515 0%, #4a2020 25%, #6b2828 50%, #8b3030 65%, #5a2525 85%, #3a1818 100%)",
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
            <LoginForm />
          </div>
        </div>
      </div>
    </main>
    </>
  );
}
