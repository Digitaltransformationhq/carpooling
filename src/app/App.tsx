import { useEffect, useRef } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AuthModalProvider } from "./context/AuthModalContext";
import { backfillMissingRoutes } from "./data/rides";
import { InstallPrompt } from "./components/InstallPrompt";

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

export default function App() {
  return (
    <AuthProvider>
      <AuthModalProvider>
        <RouteBackfill />
        <RouterProvider router={router} />
        <InstallPrompt />
      </AuthModalProvider>
    </AuthProvider>
  );
}
