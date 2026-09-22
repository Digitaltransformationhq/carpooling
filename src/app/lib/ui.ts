/**
 * Shared button styles.
 *
 * Everything is a pill, matching the header nav and filter chips. The primary
 * gets a top-lit gradient and an inset white hairline so it reads as a raised
 * surface rather than a flat fill, and the prominent variants lift 2px on
 * hover and settle on press.
 *
 * These are class strings rather than a <Button> component because the app
 * uses <button>, <a> and react-router's <Link> interchangeably, and a wrapper
 * would have to forward all three. Append extra classes freely — `w-full` for
 * form submits, for example:
 *
 *     <button className={`${btn("primary", "lg")} w-full`}>Save</button>
 */

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-tight " +
  "transition-all duration-200 ease-out " +
  "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 " +
  "motion-reduce:transition-none motion-reduce:hover:translate-y-0";

const VARIANTS = {
  /** Main call to action — one per view. */
  primary:
    "bg-gradient-to-b from-amber-300 to-primary text-primary-foreground " +
    "ring-1 ring-inset ring-white/40 " +
    "shadow-[0_8px_24px_-10px_rgba(202,138,4,0.7)] " +
    "hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-10px_rgba(202,138,4,0.8)] " +
    "active:translate-y-0 active:shadow-[0_6px_16px_-8px_rgba(202,138,4,0.7)]",

  /** Sits next to a primary, or on a photo — glass rather than solid white. */
  secondary:
    "bg-card/80 backdrop-blur-sm text-foreground ring-1 ring-black/[0.07] shadow-sm " +
    "hover:bg-card hover:ring-black/15 hover:-translate-y-0.5 hover:shadow-md " +
    "active:translate-y-0",

  /** Low emphasis — dismissals, tertiary links, "Not now". */
  ghost: "text-foreground/80 hover:text-foreground hover:bg-accent",

  /** Destructive: remove, delete, cancel a booking. */
  danger:
    "text-destructive ring-1 ring-destructive/25 " +
    "hover:bg-destructive/10 hover:ring-destructive/40",

  /**
   * Destructive but quiet — an admin utility that shouldn't be the loudest
   * thing on a card. Its own variant rather than `ghost` plus an override,
   * because two competing text-colour utilities would resolve by stylesheet
   * order, not by the order they're written in the class attribute.
   */
  dangerGhost: "text-destructive/80 hover:text-destructive hover:bg-destructive/10",
} as const;

const SIZES = {
  sm: "px-4 py-2 text-sm gap-1.5",
  md: "px-5 py-2.5",
  lg: "px-7 py-3.5",
} as const;

export type BtnVariant = keyof typeof VARIANTS;
export type BtnSize = keyof typeof SIZES;

export function btn(variant: BtnVariant = "primary", size: BtnSize = "md"): string {
  return `${BASE} ${SIZES[size]} ${VARIANTS[variant]}`;
}
