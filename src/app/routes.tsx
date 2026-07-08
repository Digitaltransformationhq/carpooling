import { createBrowserRouter } from "react-router";
import { Root } from "./pages/Root";
import { Home } from "./pages/Home";
import { SearchResults } from "./pages/SearchResults";
import { RideDetails } from "./pages/RideDetails";
import { PublishRide } from "./pages/PublishRide";
import { PeerConnect } from "./pages/PeerConnect";
import { ForthcomingEvents } from "./pages/ForthcomingEvents";
import { Admin } from "./pages/Admin";
import { AdminLogin } from "./pages/AdminLogin";
import { Profile } from "./pages/Profile";
import { Account } from "./pages/Account";
import { Login } from "./pages/Login";
import { NotFound } from "./pages/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: "search", Component: SearchResults },
      { path: "ride/:id", Component: RideDetails },
      { path: "publish", Component: PublishRide },
      { path: "connect", Component: PeerConnect },
      { path: "events", Component: ForthcomingEvents },
      { path: "admin", Component: Admin },
      { path: "admin/login", Component: AdminLogin },
      { path: "profile", Component: Profile },
      { path: "account", Component: Account },
      { path: "login", Component: Login },
      { path: "*", Component: NotFound },
    ],
  },
]);
