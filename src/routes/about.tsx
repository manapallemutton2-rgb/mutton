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
        <div className="mt-8 flex items-center justify-center border-t pt-4">
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
      </main>
    </div>
  );
}
