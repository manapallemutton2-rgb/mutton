import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Search, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPhone, getRole } from "@/lib/session";
import { addToCart, getCart } from "@/lib/cart";
import { AppHeader } from "@/components/AppHeader";
import { AboutSection } from "@/components/AboutSection";

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

        <div className="relative mb-6 overflow-hidden rounded-2xl sm:mb-8">
          <img
            src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&h=400&fit=crop"
            alt="Fresh meat selection"
            className="h-40 w-full object-cover sm:h-72"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
          <div className="absolute inset-0 flex items-center">
            <div className="px-5 sm:px-12">
              <h1 className="text-2xl font-bold text-white sm:text-5xl">Fresh Meat</h1>
              <p className="mt-2 max-w-lg text-sm text-white/80 sm:text-lg">
                Fresh from the Village, Straight to Your Home — 9030901233
              </p>
            </div>
          </div>
        </div>

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
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
          <div className="rounded-2xl border bg-card py-16 text-center sm:py-20">
            <p className="text-lg font-medium text-muted-foreground sm:text-xl">
              No products found
            </p>
            <p className="mt-2 text-sm text-muted-foreground/70 sm:text-base">
              Try a different search term
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
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
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm text-muted-foreground">per {p.unit}</p>
                            <span className="text-xl font-bold text-primary sm:text-2xl">
                              INR {Number(p.price).toFixed(0)}
                            </span>
                          </div>
                          <button
                            onClick={() => add(p, p.unit, Number(p.price))}
                            disabled={!ordersOpen}
                            className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition sm:px-6 sm:py-3.5 sm:text-base ${
                              added === p.id + "|" + p.unit
                                ? "bg-green-600 text-white"
                                : !ordersOpen
                                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                  : "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]"
                            }`}
                          >
                            {added === p.id + "|" + p.unit ? (
                              <><Check className="h-4 w-4 sm:h-5 sm:w-5" /> Added</>
                            ) : !ordersOpen ? (
                              "Orders Closed"
                            ) : (
                              <><Plus className="h-4 w-4 sm:h-5 sm:w-5" /> Add to Cart</>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-10">
          <AboutSection />
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
