import React from "react";
import { cn } from "../../lib/utils";

/** Titulo de modulo unificado */
export function PageHeader({ title, description, icon: Icon, actions, className }) {
  return (
    <header className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4", className)}>
      <div className="min-w-0">
        <h2 className="text-xl font-semibold tracking-tight text-[var(--text)] flex items-center gap-2">
          {Icon && <Icon size={20} className="text-[var(--primary)] shrink-0" aria-hidden />}
          {title}
        </h2>
        {description && (
          <p className="text-sm text-[var(--muted)] mt-1 max-w-2xl leading-relaxed">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
