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
        <h1 className="text-4xl font-bold text-primary leading-tight">
          Manapalle
          <span className="block text-xl font-medium opacity-80">Mutton & Chicken</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Fresh from the Village, Straight to Your Home — 9030901233
        </p>
        <p className="mt-4 text-xl text-muted-foreground animate-pulse-soft">Loading...</p>
        <div className="mt-8 flex items-center justify-center">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-primary/10 px-3 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-primary shadow-sm ring-1 ring-primary/20">
            <span>Powered by</span>
            <a href="https://aplustechservices.in" target="_blank" rel="noopener noreferrer">
              <img
                src="/A+.jpeg"
                alt="A+ Tech"
                className="h-6 w-6 sm:h-8 sm:w-8 rounded object-contain"
              />
            </a>
            <span className="font-extrabold">A+ Tech Services</span>
          </div>
        </div>
      </div>
    </div>
  );
}
