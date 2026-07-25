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
          <p>G-3, Vaishnavi Towers, Sri Lakshmi Nagar Colony,</p>
          <p>Near Marrichettu Junction, Manikonda,</p>
          <p>Hyderabad - 500089.</p>
          <p className="pt-1 font-semibold text-primary">Cell: 9030901233</p>
        </div>
      </main>
    </div>
  );
}
