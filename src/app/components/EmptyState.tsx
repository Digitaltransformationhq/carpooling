import type { ReactNode } from "react";

interface EmptyStateProps {
  /** Small pill above the title — a reward hook, a count, a status. */
  eyebrow?: ReactNode;
  title: string;
  body: string;
  /** Buttons. Lay them out with the shared `btn()` styles. */
  actions?: ReactNode;
  /**
   * The skeleton shown on the right. Defaults to a ride card; pass
   * <EventPreview /> or <MemberPreview /> on pages that list something else,
   * or `null` for no preview at all. Showing a ghost of the thing that's
   * missing beats a centred icon describing its absence.
   */
  preview?: ReactNode;
  className?: string;
}

/**
 * The app's empty state. Asymmetric on purpose — the centred
 * icon-heading-paragraph-button stack is the most generic layout there is,
 * and it leaves a lot of dead space in a wide container.
 */
export function EmptyState({
  eyebrow,
  title,
  body,
  actions,
  preview = <RoutePreview />,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/[0.07] via-card to-card p-6 sm:p-8 md:p-10 ${className}`}
    >
      {/* soft brand glow, purely decorative */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between md:gap-12">
        <div className="min-w-0 md:max-w-md">
          {eyebrow}
          <h3
            className={`text-2xl font-bold tracking-tight text-balance md:text-3xl ${
              eyebrow ? "mt-4" : ""
            }`}
          >
            {title}
          </h3>
          <p className="mt-2 text-muted-foreground text-pretty">{body}</p>
          {actions && <div className="mt-6 flex flex-wrap items-center gap-3">{actions}</div>}
        </div>

        {preview}
      </div>
    </div>
  );
}

/** The dashed card every preview sits in. */
function PreviewShell({ children }: { children: ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className="w-full shrink-0 rounded-xl border border-dashed border-primary/30 bg-card/70 p-4 md:w-80"
    >
      {children}
    </div>
  );
}

/** A grey placeholder bar. */
function Bar({ className = "" }: { className?: string }) {
  return <div className={`rounded-full bg-muted ${className}`} />;
}

/** A ride card reduced to its skeleton, with the connector still animating. */
export function RoutePreview() {
  return (
    <PreviewShell>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 text-primary"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
            <circle cx="7" cy="17" r="2" />
            <path d="M9 17h6" />
            <circle cx="17" cy="17" r="2" />
          </svg>
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <Bar className="h-2.5 w-24" />
          <Bar className="h-2 w-16 opacity-70" />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] bg-primary/70">
          <span className="h-1.5 w-1.5 rounded-[1px] bg-white" />
        </span>
        <div className="route-flow h-[3px] flex-1" />
        <svg
          viewBox="-2 -2 18 20"
          className="h-3.5 w-3.5 shrink-0 text-primary/70"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
        >
          <path d="M0 0L14 8L0 16Z" />
        </svg>
      </div>
    </PreviewShell>
  );
}

/** An event row reduced to its skeleton — date badge, title, venue. */
export function EventPreview() {
  return (
    <PreviewShell>
      <div className="flex items-center gap-4">
        <div className="shrink-0 border-r border-border/60 pr-4 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-primary/70">
            Soon
          </div>
          <Bar className="mx-auto mt-1.5 h-2 w-10" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <Bar className="h-2.5 w-28" />
          <Bar className="h-2 w-20 opacity-70" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Bar className="h-2 w-14 opacity-70" />
        <span className="ml-auto rounded-full bg-primary/15 px-3 py-1 text-[11px] font-semibold text-primary/70">
          Carpool
        </span>
      </div>
    </PreviewShell>
  );
}

/** A directory card reduced to its skeleton — avatar, name, ID, actions. */
export function MemberPreview() {
  return (
    <PreviewShell>
      <div className="flex items-center gap-3.5">
        <span className="h-11 w-11 shrink-0 rounded-full bg-muted ring-2 ring-primary/10 ring-offset-2 ring-offset-card" />
        <div className="min-w-0 flex-1 space-y-2">
          <Bar className="h-2.5 w-24" />
          <Bar className="h-2 w-16 opacity-70" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-border/60 pt-3">
        <Bar className="h-6 flex-1 opacity-60" />
        <Bar className="h-6 flex-1 opacity-60" />
      </div>
    </PreviewShell>
  );
}
