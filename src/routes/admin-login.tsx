import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck, Lock, User, Loader2 } from "lucide-react";
import { setSession, getRole } from "@/lib/session";
import { validateAdminLogin } from "@/lib/admin-auth.server";

export const Route = createFileRoute("/admin-login")({
  beforeLoad: () => {
    if (getRole() === "admin") {
      throw { to: "/admin" };
    }
  },
  component: AdminLoginPage,
  head: () => ({ meta: [{ title: "Admin Login - Manapalle Mutton" }] }),
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const [adminId, setAdminId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!adminId.trim() || !password.trim()) {
      setError("Please enter both Admin ID and password");
      return;
    }

    setLoading(true);
    try {
      const result = await validateAdminLogin({ data: { adminId: adminId.trim(), password } });
      if (result.valid) {
        setSession("Admin", "admin", "admin");
        navigate({ to: "/admin" });
      } else {
        setError(result.error || "Invalid admin credentials");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm">
        <div className="mb-6 text-center">
          <img
            src="/MM.jpeg"
            alt="Manapalle Mutton logo"
            className="mx-auto mb-3 h-20 w-20 rounded-xl object-contain"
          />
          <h1 className="text-2xl font-bold text-primary">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">
            Manapalle <span className="text-xs opacity-70">Mutton & Chicken</span>
          </p>
        </div>

        <div className="mb-5 rounded-lg border bg-orange-50 px-4 py-3 text-xs text-orange-700 dark:bg-orange-950 dark:text-orange-300">
          <ShieldCheck className="mr-1 inline h-4 w-4" /> Authorized personnel only
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Admin ID</label>
            <div className="flex items-center overflow-hidden rounded-xl border bg-background focus-within:ring-2 focus-within:ring-primary">
              <span className="flex items-center bg-muted px-4 py-3">
                <User className="h-5 w-5 text-muted-foreground" />
              </span>
              <input
                type="text"
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                placeholder="Enter admin ID"
                className="w-full bg-transparent px-4 py-3 text-base outline-none"
                autoFocus
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Password</label>
            <div className="flex items-center overflow-hidden rounded-xl border bg-background focus-within:ring-2 focus-within:ring-primary">
              <span className="flex items-center bg-muted px-4 py-3">
                <Lock className="h-5 w-5 text-muted-foreground" />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-transparent px-4 py-3 text-base outline-none"
                disabled={loading}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-4 text-base font-semibold text-white transition hover:bg-orange-700 disabled:opacity-60 active:scale-[0.98]"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Verifying...
              </>
            ) : (
              "Login to Admin Panel"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <a href="/login" className="font-medium text-primary hover:underline">
            Back to User Login
          </a>
        </p>
      </div>
    </div>
  );
}
