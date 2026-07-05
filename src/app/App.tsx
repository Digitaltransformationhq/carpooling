import { useEffect, useRef } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider, useAuth } from "./context/AuthContext";
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
      <RouteBackfill />
      <RouterProvider router={router} />
      <InstallPrompt />
    </AuthProvider>
  );
}
