"use client";

import { cn } from "@/lib/utils";

/**
 * The one panel treatment used across the editor. Every floating surface —
 * toolbar, tool rail, canvas, properties, timeline — shares this radius,
 * border and elevation so the chrome reads as one system rather than a set of
 * separately styled boxes.
 */
export function Surface({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.07] bg-card/80 backdrop-blur-xl",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_48px_-24px_rgba(0,0,0,0.9)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * A grouped block inside a properties panel: quiet label, inset card. Keeps
 * long panels scannable instead of one undifferentiated column of controls.
 */
export function PanelSection({
  title,
  action,
  className,
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      {title || action ? (
        <div className="flex items-center justify-between px-1">
          {title ? (
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {title}
            </h3>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        {children}
      </div>
    </section>
  );
}
