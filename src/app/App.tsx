import { useEffect, useRef } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AuthModalProvider } from "./context/AuthModalContext";
import { backfillMissingRoutes } from "./data/rides";
import { InstallPrompt } from "./components/InstallPrompt";
import { syncPushSubscription } from "./lib/push";

/** Once per session, fill in driving routes for the signed-in user's older
 *  rides so they can be matched along their corridor. Runs quietly. */
function RouteBackfill() {
  const { user } = useAuth();
  const done = useRef(false);
  useEffect(() => {
    if (user && !done.current) {
      done.current = true;
      backfillMissingRoutes().catch(() => {});
    }
  }, [user]);
  return null;
}

/** Keeps this device's push subscription attached to the signed-in account,
 *  and routes in-app when a ride alert is clicked while the app is open. */
function PushBridge() {
  const { user } = useAuth();
  useEffect(() => {
    if (user) syncPushSubscription().catch(() => {});
  }, [user]);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "cacommute:navigate" && typeof e.data.url === "string") {
        router.navigate(e.data.url);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <AuthModalProvider>
        <RouteBackfill />
        <PushBridge />
        <RouterProvider router={router} />
        <InstallPrompt />
      </AuthModalProvider>
    </AuthProvider>
  );
}
