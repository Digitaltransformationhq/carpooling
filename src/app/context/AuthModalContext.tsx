import { createContext, useContext, useState, type ReactNode } from "react";

interface AuthModalValue {
  open: boolean;
  openLogin: () => void;
  closeLogin: () => void;
}

const AuthModalContext = createContext<AuthModalValue | undefined>(undefined);

/** Controls the global login modal so any button can open it. */
export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <AuthModalContext.Provider
      value={{ open, openLogin: () => setOpen(true), closeLogin: () => setOpen(false) }}
    >
      {children}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal must be used within an AuthModalProvider");
  return ctx;
}
