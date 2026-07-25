import { Shield, Truck, Leaf, Store } from "lucide-react";

export function AboutSection() {
  return (
    <section className="rounded-2xl border bg-card p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <img
          src="/MM.jpeg"
          alt="Manapalle Mutton"
          className="h-10 w-10 rounded-xl object-contain shadow-sm"
        />
        <div>
          <h2 className="text-lg font-bold text-primary">About Manapalle</h2>
          <p className="text-xs text-muted-foreground">Mutton & Chicken</p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        We bring the finest quality meat directly from village farms to your
        doorstep. Partnering with trusted local farmers who raise livestock
        naturally, every cut is fresh, healthy, and full of authentic flavor.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:gap-3">
        {["/1.jpeg", "/2.jpeg", "/3.jpeg", "/4.jpeg"].map((src) => (
          <div key={src} className="overflow-hidden rounded-xl">
            <img
              src={src}
              alt=""
              className="h-44 w-full object-cover sm:h-56"
              loading="lazy"
            />
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {[
          { icon: Leaf, label: "Farm-Fresh" },
          { icon: Truck, label: "Doorstep Delivery" },
          { icon: Shield, label: "Trust & Hygiene" },
          { icon: Store, label: "Locally Sourced" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
            <item.icon className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-xs font-medium">{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
