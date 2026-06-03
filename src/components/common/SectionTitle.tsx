import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function SectionTitle({
  icon: Icon,
  title,
  action,
}: {
  icon: LucideIcon;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 ">
      <div className="flex items-center gap-2 font-heading !text-lg font-medium">
        <Icon className="size-4 text-primary" />
        {title}
      </div>
      {action}
    </div>
  );
}
