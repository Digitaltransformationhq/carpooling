import { useEffect } from "react";
import { X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useAuthModal } from "../context/AuthModalContext";
import { LoginForm } from "./LoginForm";

/** Global login modal — opened from the header (or anywhere) via useAuthModal(). */
export function LoginModal() {
  const { open, closeLogin } = useAuthModal();
  const { user } = useAuth();

  // Close automatically once signed in, and lock body scroll while open.
  useEffect(() => {
    if (open && user) closeLogin();
  }, [open, user, closeLogin]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeLogin();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, closeLogin]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 py-8 overflow-y-auto"
      onClick={closeLogin}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-md my-auto" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={closeLogin}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <LoginForm onSuccess={closeLogin} />
      </div>
    </div>
  );
}
