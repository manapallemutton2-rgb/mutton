import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { User, Phone, ArrowRight, Megaphone } from "lucide-react";
import { setSession, getRole } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { AboutSection } from "@/components/AboutSection";

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    if (getRole() === "admin") throw { to: "/admin" };
    if (getRole() === "user") throw { to: "/shop" };
  },
  component: LoginPage,
  head: () => ({ meta: [{ title: "Login - Manapalle Mutton" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const { data: settings = {} } = useQuery<Record<string, string>>({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*");
      if (error) return {};
      const map: Record<string, string> = {};
      (data || []).forEach((s) => {
        map[s.key] = s.value;
      });
      return map;
    },
    staleTime: 30_000,
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }
    if (!/^\d{10}$/.test(phone)) {
      setError("Enter a valid 10-digit mobile number");
      return;
    }
    setSession(name.trim(), phone, "user");
    navigate({ to: "/shop" });
  };

  return (
    <div className="flex min-h-screen">
      {/* Left: About Us (desktop) */}
      <div className="hidden w-1/2 overflow-y-auto p-10 lg:block">
        <AboutSection />
        <div className="mt-4 space-y-1 rounded-xl bg-muted/30 px-5 py-4 text-sm text-muted-foreground">
          <p>G-3, Vaishnavi Towers, Sri Lakshmi Nagar Colony,</p>
          <p>Near Marrichettu Junction, Manikonda,</p>
          <p>Hyderabad - 500089.</p>
          <p className="pt-1 font-semibold text-primary">Cell: 9030901233</p>
        </div>
      </div>

      {/* Right: Form */}
      <div className="flex w-full items-center justify-center px-4 sm:px-6 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <img
              src="/MM.jpeg"
              alt="Logo"
              className="mx-auto mb-3 h-20 w-20 rounded-2xl object-contain shadow-lg"
            />
            <h1 className="text-3xl font-bold text-primary leading-tight sm:text-4xl">
              Manapalle
              <span className="block text-lg font-medium opacity-80 sm:text-xl">
                Mutton & Chicken
              </span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Fresh from the Village, Straight to Your Home — 9030901233
            </p>
          </div>

          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Welcome back</h1>
            <p className="mt-2 text-lg text-muted-foreground">
              Enter your details to start ordering
            </p>
          </div>

          {/* Admin Message */}
          {settings.popup_message && (
            <div className="mb-6 rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Megaphone className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold text-primary">{settings.popup_message}</p>
                  {settings.popup_sheep && (
                    <p className="mt-1 text-lg font-bold text-muted-foreground">
                      No of Sheeps: {settings.popup_sheep}
                    </p>
                  )}
                  {settings.popup_users && (
                    <p className="text-lg font-bold text-muted-foreground">
                      Active Users: {settings.popup_users}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="mb-2 block text-base font-medium">Your Name</label>
              <div className="flex items-center overflow-hidden rounded-xl border bg-background transition focus-within:ring-2 focus-within:ring-primary">
                <span className="pl-5">
                  <User className="h-5 w-5 text-muted-foreground" />
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full bg-transparent px-4 py-4 text-base outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-base font-medium">Mobile Number</label>
              <div className="flex items-center overflow-hidden rounded-xl border bg-background transition focus-within:ring-2 focus-within:ring-primary">
                <span className="flex items-center border-r bg-muted px-4 py-4 text-base text-muted-foreground">
                  +91
                </span>
                <span className="pl-4">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  placeholder="10-digit mobile number"
                  className="w-full bg-transparent px-3 py-4 text-base outline-none"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-destructive/10 px-5 py-4 text-base text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-primary py-4 text-lg font-semibold text-primary-foreground transition hover:opacity-90 active:scale-[0.98]"
            >
              Start Shopping
              <ArrowRight className="h-5 w-5" />
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            <a href="/admin-login" className="font-medium text-primary hover:underline">
              Admin Login
            </a>
          </p>

          {/* About Us (mobile) */}
          <div className="mt-10 lg:hidden">
            <AboutSection />
            <div className="mt-4 space-y-1 rounded-xl bg-muted/30 px-5 py-4 text-sm text-muted-foreground">
              <p>G-3, Vaishnavi Towers, Sri Lakshmi Nagar Colony,</p>
              <p>Near Marrichettu Junction, Manikonda,</p>
              <p>Hyderabad - 500089.</p>
              <p className="pt-1 font-semibold text-primary">Cell: 9030901233</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
