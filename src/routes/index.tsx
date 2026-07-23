import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { getPhone, getRole } from "@/lib/session";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    const p = getPhone();
    const role = getRole();
    if (!p) {
      navigate({ to: "/login" });
    } else if (role === "admin") {
      navigate({ to: "/admin" });
    } else {
      navigate({ to: "/shop" });
    }
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <img
          src="/MM.jpeg"
          alt="Manapalle Mutton"
          className="mx-auto mb-4 h-24 w-24 rounded-2xl object-contain shadow-lg"
        />
        <h1 className="text-4xl font-bold text-primary">Manapalle Mutton</h1>
        <p className="mt-4 text-xl text-muted-foreground animate-pulse-soft">Loading...</p>
      </div>
    </div>
  );
}
