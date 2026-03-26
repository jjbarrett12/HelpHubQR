import { Inbox } from "lucide-react";

export function OnboardingEmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 px-6 text-center">
      <Inbox className="h-10 w-10 text-muted-foreground mb-3" aria-hidden />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-md">{description}</p>}
    </div>
  );
}
