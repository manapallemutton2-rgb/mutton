import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Search, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPhone, getRole } from "@/lib/session";
import { addToCart, getCart } from "@/lib/cart";
import { AppHeader } from "@/components/AppHeader";

type Product = {
  id: string;
  name: string;
  unit: string;
  price: number;
  active: boolean;
  image_url?: string | null;
  stock?: number | null;
};

const SIZE_OPTIONS = [
  { label: "500g", multiplier: 0.5 },
  { label: "750g", multiplier: 0.75 },
  { label: "1kg", multiplier: 1 },
];

export const Route = createFileRoute("/shop")({
  component: ShopPage,
  head: () => ({ meta: [{ title: "Shop - Manapalle Mutton" }] }),
});

function ShopPage() {
  const navigate = useNavigate();
  const [added, setAdded] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const phone = getPhone();
    const role = getRole();
    if (!phone) {
      navigate({ to: "/login" });
      return;
    }
    if (role === "admin") {
      navigate({ to: "/admin" });
      return;
    }
  }, [navigate]);

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
    staleTime: 300_000,
  });

  const ordersOpen = settings.orders_open !== "false";

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["products", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, unit, price, image_url, active, created_at, stock")
        .eq("active", true);
      if (error) {
        console.error("Failed to load products:", error);
        return [];
      }
      return ((data as Product[]) || []).sort((a, b) => {
        const aIsMutton = a.name.toLowerCase().startsWith("mutton");
        const bIsMutton = b.name.toLowerCase().startsWith("mutton");
        if (aIsMutton && !bIsMutton) return -1;
        if (!aIsMutton && bIsMutton) return 1;
        return a.name.localeCompare(b.name);
      });
    },
    staleTime: 60_000,
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("products-stock")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        queryClient.invalidateQueries({ queryKey: ["products", "active"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const cartCount = getCart().reduce((s, i) => s + i.quantity, 0);
  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  const add = (p: Product, sizeLabel: string, sizePrice: number) => {
    const cart = getCart();
    const inCart = cart.find((c) => c.product_id === p.id && c.unit === sizeLabel);
    const inCartQty = inCart ? inCart.quantity : 0;
    // Convert cart quantity to kg for stock comparison
    const sizeMultiplier = SIZE_OPTIONS.find((s) => s.label === sizeLabel)?.multiplier ?? 1;
    const cartKg = inCartQty * sizeMultiplier;
    if (p.stock != null && cartKg >= p.stock) {
      return;
    }
    addToCart({ product_id: p.id, name: p.name, unit: sizeLabel, price: sizePrice }, 1);
    const key = p.id + "|" + sizeLabel;
    setAdded(key);
    setTimeout(() => setAdded(null), 1000);
  };

  const hasSizes = (p: Product) => p.unit === "kg";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Shop" />
      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        {!ordersOpen && (
          <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 p-4 text-center text-base font-semibold text-red-700">
            Orders are currently closed. Please check back later.
          </div>
        )}

        {/* HERO */}
        <section className="relative overflow-hidden py-12 sm:py-20" style={{ backgroundColor: "#F4EAD5" }}>
          <div className="absolute inset-0 opacity-10">
            <svg viewBox="0 0 1240 400" preserveAspectRatio="none" className="h-full w-full">
              <path d="M0 280 C 200 240, 380 360, 640 300 S 1080 200, 1240 270 L1240 400 L0 400 Z" fill="#145B42" opacity="0.08" />
            </svg>
          </div>
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl text-center lg:text-left">
                <span className="mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider" style={{ backgroundColor: "#145B42", color: "#F4EAD5" }}>
                  Village-raised, home-delivered
                </span>
                <h1 className="text-3xl font-bold leading-tight sm:text-5xl lg:text-6xl" style={{ color: "#145B42" }}>
                  Fresh Mutton
                  <span className="block text-2xl font-medium sm:text-4xl lg:text-5xl" style={{ color: "#4F7F35" }}>From Our Village</span>
                  <span className="block text-2xl font-medium sm:text-4xl lg:text-5xl" style={{ color: "#4F7F35" }}>To Your Home</span>
                </h1>
                <p className="mt-4 text-base sm:text-lg" style={{ color: "#6B4630" }}>
                  100% fresh, tender and hygienically packed mutton, cut by hand and delivered straight from Manapalle village to your kitchen.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
                  <button onClick={() => document.getElementById("product-grid")?.scrollIntoView({ behavior: "smooth" })} className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold shadow-lg transition hover:shadow-xl active:scale-[0.98]" style={{ backgroundColor: "#145B42", color: "#F4EAD5" }}>
                    Shop Now
                  </button>
                  <a href="tel:9030901233" className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold shadow-lg transition hover:shadow-xl active:scale-[0.98]" style={{ backgroundColor: "#C94F5C", color: "#FFF8EC" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                    Call 90309 01233
                  </a>
                </div>
              </div>
              <div className="shrink-0">
                <img src="/lamb.jpg" alt="Fresh Mutton" className="mx-auto h-48 w-auto rounded-2xl shadow-2xl sm:h-64 lg:h-80" />
              </div>
            </div>
          </div>
        </section>

        <div className="flex items-center justify-center py-4">
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

        {/* TRUST STRIP */}
        <section className="relative z-10 mx-auto max-w-5xl px-4 py-4 sm:px-6">
          <div className="grid grid-cols-2 gap-3 rounded-2xl bg-card p-4 shadow-lg sm:grid-cols-4 sm:p-6">
            {[
              { title: "100% Natural", desc: "No chemicals, no preservatives.", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66L7 18"/><path d="M17 8c2-1 4 0 4 0s1 2 0 4"/><path d="M17 8A8 8 0 003.5 17.5"/></svg> },
              { title: "Tender & Juicy", desc: "Handpicked mutton for the best taste.", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> },
              { title: "Hygienically Packed", desc: "Cleaned and packed with care.", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
              { title: "Delivered Fresh", desc: "Fast delivery to keep it fresh.", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> },
            ].map((item) => (
              <div key={item.title} className="flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-3 sm:px-4">
                <span className="text-primary">{item.icon}</span>
                <div>
                  <div className="text-xs font-bold text-primary sm:text-sm">{item.title}</div>
                  <div className="text-[11px] text-muted-foreground sm:text-xs">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="mb-5 flex items-center gap-3 sm:mb-6">
          <div className="flex flex-1 items-center gap-3 rounded-xl border bg-card px-4 py-3 transition focus-within:ring-2 focus-within:ring-primary sm:px-5 sm:py-3.5">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
          </div>
          <button
            onClick={() => navigate({ to: "/cart" })}
            className="relative flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-base font-medium text-primary-foreground shadow-sm transition hover:opacity-90 active:scale-95 sm:px-5"
          >
            <ShoppingCart className="h-5 w-5" />
            <span className="hidden sm:inline">Cart</span>
            {cartCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground shadow-sm sm:h-6 sm:w-6 sm:text-xs">
                {cartCount}
              </span>
            )}
          </button>
        </div>

        {isLoading ? (
          <div id="product-grid" className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse overflow-hidden rounded-2xl border bg-card">
                <div className="h-40 bg-muted sm:h-52" />
                <div className="p-4 sm:p-6">
                  <div className="h-5 w-2/3 rounded bg-muted" />
                  <div className="mt-3 h-6 w-24 rounded bg-muted" />
                  <div className="mt-4 h-12 w-full rounded-xl bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div id="product-grid" className="rounded-2xl border bg-card py-16 text-center sm:py-20">
            <p className="text-lg font-medium text-muted-foreground sm:text-xl">
              No products found
            </p>
            <p className="mt-2 text-sm text-muted-foreground/70 sm:text-base">
              Try a different search term
            </p>
          </div>
        ) : (
          <div id="product-grid" className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {filtered.map((p, idx) => {
              const sizes = hasSizes(p) ? SIZE_OPTIONS : null;
              return (
                <div
                  key={p.id}
                  className={`animate-slide-up stagger-${Math.min(idx + 1, 6)} group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:shadow-lg`}
                >
                  <div className="relative h-40 shrink-0 overflow-hidden sm:h-52">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted text-sm text-muted-foreground">
                        No Image
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-between p-4 sm:p-6">
                    <div>
                      <h3 className="text-lg font-semibold sm:text-xl">{p.name}</h3>
                    </div>

                    {sizes ? (
                      <div className="mt-4 space-y-2">
                        {sizes.map((size) => {
                          const calcPrice = Math.round(p.price * size.multiplier);
                          const key = p.id + "|" + size.label;
                          const isAdded = added === key;
                          const cartItem = getCart().find((c) => c.product_id === p.id && c.unit === size.label);
                          const cartKg = (cartItem?.quantity ?? 0) * size.multiplier;
                          const outOfStock = !ordersOpen || (p.stock != null && cartKg >= p.stock);
                          const remaining = p.stock != null ? Math.max(0, p.stock - cartKg) : null;
                          return (
                            <div
                              key={size.label}
                              className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 sm:px-4 sm:py-3 ${
                                 isAdded ? "border-green-400 bg-green-50" : ""
                               }`}
                            >
                              <div className="min-w-0 flex-1">
                                <span className="text-sm font-medium sm:text-base">{size.label}</span>
                                <span className="ml-2 text-sm text-muted-foreground">
                                  INR {calcPrice}
                                </span>
                                {remaining !== null && (
                                  <span className={`ml-2 text-xs ${outOfStock ? "text-red-500" : "text-green-600"}`}>
                                    {outOfStock ? "Out" : `${remaining % 1 === 0 ? remaining.toFixed(0) : remaining.toFixed(1)} kg left`}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => add(p, size.label, calcPrice)}
                                disabled={!ordersOpen || outOfStock}
                                className={`flex shrink-0 items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:px-4 sm:py-2 sm:text-sm ${
                                  isAdded
                                    ? "bg-green-600 text-white"
                                    : !ordersOpen || outOfStock
                                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                      : "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]"
                                }`}
                              >
                                {isAdded ? (
                                  <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                ) : !ordersOpen ? (
                                  "Closed"
                                ) : outOfStock ? (
                                  "Out"
                                ) : (
                                  <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-4">
                        {(() => {
                          const cartItem = getCart().find((c) => c.product_id === p.id && c.unit === p.unit);
                          const cartQty = cartItem?.quantity ?? 0;
                          const outOfStock = !ordersOpen || (p.stock != null && cartQty >= p.stock);
                          const remaining = p.stock != null ? Math.max(0, p.stock - cartQty) : null;
                          const unitDisplay = p.unit === "tray" ? "Tray (30)" : p.unit === "dozen" ? "Dozen (12)" : p.unit;
                          return (
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm text-muted-foreground">per {unitDisplay}</p>
                                <span className="text-xl font-bold text-primary sm:text-2xl">
                                  INR {Number(p.price).toFixed(0)}
                                </span>
                                {remaining !== null && (
                                  <span className={`ml-2 text-xs ${outOfStock ? "text-red-500" : "text-green-600"}`}>
                                    {outOfStock ? "Out of stock" : `${remaining} ${p.unit === "tray" ? "tray" : p.unit === "dozen" ? "dozen" : "pcs"} left`}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => add(p, p.unit, Number(p.price))}
                                disabled={!ordersOpen || outOfStock}
                                className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition sm:px-6 sm:py-3.5 sm:text-base ${
                                  added === p.id + "|" + p.unit
                                    ? "bg-green-600 text-white"
                                    : !ordersOpen || outOfStock
                                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                      : "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]"
                                }`}
                              >
                                {added === p.id + "|" + p.unit ? (
                                  <><Check className="h-4 w-4 sm:h-5 sm:w-5" /> Added</>
                                ) : !ordersOpen ? (
                                  "Orders Closed"
                                ) : outOfStock ? (
                                  "Out of Stock"
                                ) : (
                                  <><Plus className="h-4 w-4 sm:h-5 sm:w-5" /> Add to Cart</>
                                )}
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
