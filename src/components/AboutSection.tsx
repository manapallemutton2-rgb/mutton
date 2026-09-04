import { Shield, Truck, Leaf, Store } from "lucide-react";

export function AboutSection() {
  return (
    <section className="rounded-2xl border bg-card p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <img
          src="/MM.jpeg"
          alt="Manapalle Products"
          className="h-10 w-10 rounded-xl object-contain shadow-sm"
        />
        <div>
          <h2 className="text-lg font-bold text-primary">About Manapalle</h2>
          <p className="text-xs text-muted-foreground">Products</p>
        </div>
      </div>
      <h3 className="mt-5 text-xl font-bold leading-tight text-primary">
        Pure in Purpose. Fresh by Nature. Trusted by Families.
      </h3>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
        <p>
          At <strong className="text-foreground">Manapalle Products</strong>, we bring carefully
          sourced food closer to your home - from fresh mutton, chicken, fish and seafood to
          vegetables, wood-pressed oils, eggs and dairy products.
        </p>
        <p>
          We believe great food starts with quality sourcing and careful handling. Wherever
          practical, we work closer to the source to help bring you products that are fresh,
          responsibly handled and closer to their natural goodness.
        </p>
        <p className="font-medium text-primary">
          From our trusted sources to your family table - freshness you can trust, quality you can
          feel.
        </p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:gap-3">
        {["/1.jpeg", "/2.jpeg", "/3.jpeg", "/4.jpeg"].map((src) => (
          <div key={src} className="overflow-hidden rounded-xl">
            <img src={src} alt="" className="h-44 w-full object-cover sm:h-56" loading="lazy" />
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
          <div
            key={item.label}
            className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2"
          >
            <item.icon className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-xs font-medium">{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
