import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getRole } from "@/lib/session";
import { MaintenanceScreen } from "@/components/MaintenanceScreen";
import { BtPrinterButton } from "@/components/BtPrinterButton";

import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Manapalle Mutton - Order Fresh Meat Online" },
      {
        name: "description",
        content:
          "Order fresh meat delivered to your community. Simple mobile login, checkout by community & block.",
      },
      { property: "og:title", content: "Manapalle Mutton - Order Fresh Meat Online" },
      {
        property: "og:description",
        content:
          "Order fresh meat delivered to your community. Simple mobile login, checkout by community & block.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Manapalle Mutton - Order Fresh Meat Online" },
      {
        name: "twitter:description",
        content:
          "Order fresh meat delivered to your community. Simple mobile login, checkout by community & block.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6">
      <h1 className="text-3xl font-bold text-primary">Page Not Found</h1>
      <p className="text-lg text-muted-foreground">The page you're looking for doesn't exist.</p>
      <a
        href="/"
        className="rounded-xl bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground transition hover:opacity-90"
      >
        Go Home
      </a>
    </div>
  ),
  errorComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6">
      <h1 className="text-3xl font-bold text-destructive">Something went wrong</h1>
      <p className="max-w-md text-center text-lg text-muted-foreground">
        Please try refreshing the page or come back later.
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Refresh Page
        </button>
        <a
          href="/"
          className="rounded-xl border bg-card px-8 py-4 text-lg font-semibold transition hover:shadow-md"
        >
          Go Home
        </a>
      </div>
    </div>
  ),
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <MaintenanceCheck />
    </QueryClientProvider>
  );
}

function MaintenanceCheck() {
  const role = getRole();
  const isAdminLogin = typeof window !== "undefined" && window.location.pathname === "/admin-login";

  const { data: settings = {}, isLoading } = useQuery<Record<string, string>>({
    queryKey: ["maintenance"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*");
      if (error) {
        console.error("Failed to fetch settings:", error);
        return {};
      }
      const map: Record<string, string> = {};
      (data || []).forEach((s) => {
        map[s.key] = s.value;
      });
      return map;
    },
    staleTime: 60_000,
  });

  if (role === "admin") {
    return (
      <>
        <Outlet />
        <BtPrinterButton />
      </>
    );
  }

  if (isAdminLogin) {
    return <Outlet />;
  }

  if (!isLoading && settings.maintenance_mode === "true") {
    return <MaintenanceScreen message={settings.maintenance_message} />;
  }

  return <Outlet />;
}
