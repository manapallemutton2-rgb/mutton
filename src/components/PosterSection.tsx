import { Beef, Drumstick, Fish, Bird, Shrimp, Egg } from "lucide-react";

export function PosterSection() {
  return (
    <section
      aria-label="Mana Palle story poster"
      className="mt-4 overflow-hidden rounded-[20px] border-2 bg-[#FFFBE6] shadow-sm"
      style={{ borderColor: "#237B4B" }}
    >
      {/* Brochure head */}
      <div
        className="px-4 py-5 text-center text-white"
        style={{
          background: "linear-gradient(100deg, #064C32, #0C6B43, #064C32)",
        }}
      >
        <h2 className="font-serif text-2xl font-bold tracking-[0.08em] sm:text-4xl">
          MANA PALLE
        </h2>
        <p className="mt-1 text-[11px] tracking-wide text-[#F7E9A5] sm:text-xs">
          PRODUCTS · “Pure Heritage. Zero Processing. Delivered Direct.”
        </p>
      </div>

      <div className="p-3 sm:p-6">
        {/* Intro */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="font-serif text-xl font-bold leading-tight text-[#07583A] sm:text-2xl">
              The Paradigm Shift
              <br />
              in Food Purity
            </h3>
            <p className="mt-2 text-sm font-medium">Dear Discerning Resident,</p>
            <p className="mt-1 text-[13px] leading-relaxed text-[#183D2C] sm:text-sm">
              In today&apos;s mass-produced world, we focus on fresh sourcing, careful
              handling and clear product information. Our goal is to bring village
              freshness directly to your home.
            </p>
            <p className="mt-2 text-[13px] leading-relaxed sm:text-sm">
              <strong>Manapalle Products</strong> — freshness and transparency,
              delivered direct.
            </p>
          </div>
          <aside className="self-center rounded-2xl bg-[#07583A] p-5 text-sm leading-relaxed text-white">
            <span className="text-xl font-bold text-[#F5D66B]">“</span>
            <p>We don&apos;t expect you to blindly trust a label. We want you to trust your own senses.</p>
            <p className="mt-2">
              In our ecosystem, quality is a shared responsibility — from sourcing to
              your kitchen.
            </p>
          </aside>
        </div>

        {/* Four-Zero */}
        <h3 className="mb-3 mt-6 text-center text-sm font-black uppercase tracking-wide text-[#07583A] sm:text-base">
          The Four-Zero Compliance Matrix
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <article className="rounded-xl border-2 border-[#4E9A57] bg-white p-3 text-center">
            <h4 className="text-[11px] font-bold uppercase">Chemicals</h4>
            <strong className="block font-serif text-3xl text-[#237B4B]">0%</strong>
            <p className="mt-1 text-[11px] leading-snug">
              Clear product sourcing and handling information.
            </p>
          </article>
          <article className="rounded-xl border-2 border-[#F28A19] bg-white p-3 text-center">
            <h4 className="text-[11px] font-bold uppercase">Preservatives</h4>
            <strong className="block font-serif text-3xl text-[#F28A19]">0%</strong>
            <p className="mt-1 text-[11px] leading-snug">
              Product-specific details should be verified before publishing.
            </p>
          </article>
          <article className="rounded-xl border-2 border-[#2884B8] bg-white p-3 text-center">
            <h4 className="text-[11px] font-bold uppercase">Frozen Stock</h4>
            <strong className="block font-serif text-3xl text-[#2884B8]">0%</strong>
            <p className="mt-1 text-[11px] leading-snug">
              Explain your actual storage and delivery process.
            </p>
          </article>
          <article className="rounded-xl border-2 border-[#D83D4D] bg-white p-3 text-center">
            <h4 className="text-[11px] font-bold uppercase">Public Access</h4>
            <strong className="block font-serif text-3xl text-[#D83D4D]">100%</strong>
            <p className="mt-1 text-[11px] leading-snug">
              Clear ordering information and customer support.
            </p>
          </article>
        </div>

        {/* Photos */}
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {["/1.jpeg", "/2.jpeg", "/3.jpeg", "/4.jpeg"].map((src) => (
            <div key={src} className="overflow-hidden rounded-xl">
              <img src={src} alt="" className="h-44 w-full object-cover sm:h-56" loading="lazy" />
            </div>
          ))}
        </div>

        {/* Launch pipeline */}
        <h3 className="mb-3 mt-6 text-center text-sm font-black uppercase tracking-wide text-[#07583A] sm:text-base">
          Our Launch Pipeline: The Unfolding of Purity
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
          {[
            { Icon: Beef, t: "Premium Mutton", d: "Product details, sourcing information and available cuts can be managed here." },
            { Icon: Drumstick, t: "Fresh Broiler Chicken", d: "Add product description, weight options, pricing and delivery availability." },
            { Icon: Fish, t: "Fresh Fish & Seafood", d: "List available varieties and daily availability; update this content from your CMS." },
            { Icon: Bird, t: "Authentic Country Poultry", d: "Add verified details about sourcing and preparation." },
            { Icon: Shrimp, t: "Traceable Fresh Fish", d: "Use this card for fish varieties, freshness details and order links." },
            { Icon: Egg, t: "Free-Range Country Eggs", d: "Add pack sizes, price and delivery area." },
          ].map(({ Icon, t, d }) => (
            <article
              key={t}
              className="rounded-2xl border bg-white p-3 sm:p-3.5"
              style={{ borderColor: "#D8DDAF" }}
            >
              <h4 className="flex items-center gap-1.5 text-[13px] font-bold leading-snug text-[#07583A] sm:text-sm">
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> {t}
              </h4>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">{d}</p>
            </article>
          ))}
        </div>

        {/* Why different */}
        <div className="mt-4 rounded-2xl border border-[#B6D1A2] bg-[#EAF2D7] p-3 sm:p-4">
          <h3 className="mb-2.5 text-center text-sm font-black text-[#07583A] sm:text-base">
            Why Manapalle Is Different
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ["✓ Clear Product Information", "Explain product quality, sourcing and handling in plain language."],
              ["✓ Freshness Promise", "Describe the actual freshness and delivery process accurately."],
              ["✓ Live Order Updates", "Show order confirmation, dispatch and delivery status when available."],
              ["✓ Farmer-led Sourcing", "Add verified details about your farmers and suppliers."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-xl bg-white/85 p-3 text-xs leading-relaxed">
                <strong className="mb-1 block text-[13px] text-[#07583A]">{t}</strong>
                {d}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
