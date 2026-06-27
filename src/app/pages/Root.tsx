import { Outlet, useLocation } from "react-router";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { CompleteProfileModal } from "../components/CompleteProfileModal";

export function Root() {
  // The home hero sits behind the floating navbar; other pages need top
  // clearance so their content isn't covered by it.
  const { pathname } = useLocation();
  const isHome = pathname === "/";

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className={`flex-1 ${isHome ? "" : "pt-24"}`}>
        <Outlet />
      </main>
      <Footer />
      <CompleteProfileModal />
    </div>
  );
}
