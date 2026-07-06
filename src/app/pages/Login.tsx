import { LoginForm } from "../components/LoginForm";

/** Full-page login (deep links / redirects). The header opens the modal instead. */
export function Login() {
  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </div>
  );
}
