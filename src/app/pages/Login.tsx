import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { useAuthModal } from "../context/AuthModalContext";

/**
 * Deep links / redirects to /login shouldn't show a different-looking full page.
 * Land on the home landing page and open the shared login modal (blurred
 * backdrop), so signing in looks identical everywhere.
 */
export function Login() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { openLogin } = useAuthModal();

  useEffect(() => {
    if (!user) openLogin();
    navigate("/", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
