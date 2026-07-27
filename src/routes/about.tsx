import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { AboutSection } from "@/components/AboutSection";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({ meta: [{ title: "About Us - Manapalle Mutton" }] }),
});

function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="About Us" />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <AboutSection />
        <div className="mt-4 space-y-1 rounded-xl bg-muted/30 px-5 py-4 text-sm text-muted-foreground">
          <p>Village Gungal, Yacharam Mandal,</p>
          <p>K.V.Rangareddy District - 501506</p>
          <p className="pt-1 font-semibold text-primary">Cell: 9030901233</p>
        </div>
        <div className="mt-8 flex items-center justify-center gap-2 border-t pt-4 text-sm font-semibold text-muted-foreground/60">
          <span>Powered by</span>
          <img
            src="/A+.jpeg"
            alt="A+ Tech"
            className="h-6 w-6 rounded object-contain"
          />
          <span className="font-bold">A+ Tech Services</span>
        </div>
      </main>
    </div>
  );
}
