import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-5 w-5 text-primary shrink-0" />
        <span className="ds-page-title text-xl md:text-2xl">Get set up</span>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed mb-8">
        Short guided setup. You can skip steps and resume anytime from{" "}
        <Link href="/app/onboarding" className="text-neon underline">
          Setup
        </Link>
        .
      </p>
      {children}
    </div>
  );
}
