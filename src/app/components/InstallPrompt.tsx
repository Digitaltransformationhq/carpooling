import { useEffect, useState } from "react";
import { Download, X, Share, Plus } from "lucide-react";

/**
 * Chrome/Edge/Android fire `beforeinstallprompt` only when the app is
 * installable AND not currently installed. That means the moment the user
 * uninstalls the PWA and comes back, the browser fires it again — so simply
 * reacting to this event gives us the "offer on every visit, hide while
 * installed, offer again after uninstall" behaviour for free, no bookkeeping.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

/** True when the app is already running as an installed PWA. */
function isRunningInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari exposes this non-standard flag when launched from the home screen
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** iOS doesn't support programmatic install — detect it so we can show manual steps. */
function isIOS(): boolean {
  const ua = navigator.userAgent;
  const iOSDevice = /iphone|ipad|ipod/i.test(ua);
  // iPadOS 13+ reports as a Mac, so also check for a touch-capable "Mac"
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOSDevice || iPadOS;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  // Dismissal lives only in component state: it resets on a full page load
  // (i.e. the next visit), which is exactly the "offer every visit" behaviour.
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(isRunningInstalled);

  // Show the iOS banner only when not already installed and on an iOS device.
  const iosEligible = isIOS() && !installed;

  useEffect(() => {
    if (installed) return;

    const onBeforeInstallPrompt = (e: Event) => {
      // Stop Chrome's mini-infobar; we present our own UI instead.
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setShowIOSHelp(false);
    };

    // If the app gets installed/uninstalled in another tab, this keeps us in sync.
    const displayModeQuery = window.matchMedia("(display-mode: standalone)");
    const onDisplayModeChange = (e: MediaQueryListEvent) => setInstalled(e.matches);

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    displayModeQuery.addEventListener("change", onDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      displayModeQuery.removeEventListener("change", onDisplayModeChange);
    };
  }, [installed]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    // A prompt can only be used once — drop it either way.
    setDeferredPrompt(null);
    if (outcome === "accepted") setInstalled(true);
  };

  if (installed || dismissed) return null;

  // Nothing to offer: no captured prompt (Chrome/Edge/Android) and not iOS.
  if (!deferredPrompt && !iosEligible) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-50 p-4 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-sm">
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-lg">
          <img
            src="/logo.png"
            alt="CACommute"
            className="h-11 w-11 shrink-0 rounded-lg object-cover"
          />

          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">Install CACommute</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Add the app to your device for faster access and an offline-ready,
              full-screen experience.
            </p>

            <div className="mt-3 flex items-center gap-2">
              {deferredPrompt ? (
                <button
                  onClick={handleInstall}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  <Download className="h-4 w-4" />
                  Install
                </button>
              ) : (
                <button
                  onClick={() => setShowIOSHelp(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  <Share className="h-4 w-4" />
                  How to install
                </button>
              )}
              <button
                onClick={() => setDismissed(true)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Not now
              </button>
            </div>
          </div>

          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss install prompt"
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* iOS Safari: no programmatic install, so walk the user through the steps. */}
      {showIOSHelp && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setShowIOSHelp(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground">Install on iPhone / iPad</p>
              <button
                onClick={() => setShowIOSHelp(false)}
                aria-label="Close"
                className="rounded-md p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ol className="mt-4 space-y-3 text-sm text-foreground">
              <li className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  1
                </span>
                <span className="flex items-center gap-1.5">
                  Tap the <Share className="inline h-4 w-4" /> Share button in Safari's
                  toolbar.
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  2
                </span>
                <span className="flex items-center gap-1.5">
                  Choose <span className="font-medium">Add to Home Screen</span>
                  <Plus className="inline h-4 w-4" />.
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  3
                </span>
                <span>
                  Tap <span className="font-medium">Add</span> — CACommute will appear on
                  your home screen.
                </span>
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
