import { useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import {
  disablePush,
  dismissPushNudge,
  enablePush,
  usePushNotifications,
  type PushState,
} from "../lib/push";

function errorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && typeof (err as { message?: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return "Couldn't turn on notifications. Please try again.";
}

function useToggle() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      console.error("Push toggle failed:", err);
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

/**
 * Inline "turn on ride alerts" card. Only renders while alerts are off on a
 * device that supports them, and hides for a week after "Not now".
 */
export function RideAlertsNudge({
  message = "Get notified when someone requests a seat, your request is accepted, or your ride is about to leave.",
  className = "",
}: {
  message?: string;
  className?: string;
}) {
  const { state, nudgeDismissed } = usePushNotifications();
  const { busy, error, run } = useToggle();

  if (state !== "off" || nudgeDismissed) return null;

  return (
    <div
      className={`flex items-start gap-3 border border-primary/40 bg-primary/5 rounded-xl p-4 ${className}`}
    >
      <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
        <Bell className="w-4 h-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">Turn on ride alerts</p>
        <p className="text-sm text-muted-foreground mt-0.5">{message}</p>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => run(enablePush)}
            disabled={busy}
            className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {busy ? "Turning on…" : "Turn on"}
          </button>
          <button
            onClick={dismissPushNudge}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Not now
          </button>
        </div>
      </div>
      <button
        onClick={dismissPushNudge}
        aria-label="Dismiss"
        className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

const STATUS_TEXT: Record<PushState, string> = {
  loading: "Checking…",
  on: "On for this device.",
  off: "Off for this device.",
  denied:
    "Notifications are blocked for this site. Click the lock icon next to the address bar → Notifications → Allow, then reload the page.",
  "needs-install":
    "On iPhone or iPad, first add CACommute to your Home Screen (Share → Add to Home Screen), then open it from there to turn on alerts.",
  unsupported: "This browser doesn't support notifications.",
};

/** Notifications section for the Account page. */
export function RideAlertsSettings() {
  const { state } = usePushNotifications();
  const { busy, error, run } = useToggle();
  const on = state === "on";

  return (
    <div className="bg-card border border-primary rounded-2xl p-6 md:p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            {on ? <Bell className="w-5 h-5 text-primary" /> : <BellOff className="w-5 h-5 text-muted-foreground" />}
            Ride alerts
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Browser notifications, even when CACommute is closed: seat requests, accepted or
            declined requests, ride started, cancelled or completed, and a reminder 30 minutes
            before departure.
          </p>
          <p className={`text-sm mt-3 ${on ? "text-green-600" : "text-foreground"}`}>
            {STATUS_TEXT[state]}
          </p>
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </div>
        {(state === "on" || state === "off") && (
          <button
            onClick={() => run(on ? disablePush : enablePush)}
            disabled={busy}
            className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${
              on
                ? "border border-border hover:bg-muted"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {busy ? "…" : on ? "Turn off" : "Turn on"}
          </button>
        )}
      </div>
    </div>
  );
}
