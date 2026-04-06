import type { ReactNode } from "react";
import { IconEmpty } from "./Icons";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="glass glass-animate flex flex-col items-center gap-4 p-8 text-center">
        <div className="text-secondary">
          {icon ?? <IconEmpty size={48} />}
        </div>
        <h2 className="text-primary text-lg font-semibold">{title}</h2>
        {description && (
          <p className="text-secondary text-sm">{description}</p>
        )}
        {action}
      </div>
    </div>
  );
}
