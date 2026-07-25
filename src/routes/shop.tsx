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

  const add = (p: Product) => {
    const cart = getCart();
    const inCart = cart.find((c) => c.product_id === p.id);
    const inCartQty = inCart ? inCart.quantity : 0;
    if (p.stock != null && inCartQty >= p.stock) {
      return;
    }
    addToCart({ product_id: p.id, name: p.name, unit: p.unit, price: Number(p.price) }, 1);
    setAdded(p.id);
    setTimeout(() => setAdded(null), 1000);
  };

  const isOutOfStock = (p: Product) => {
    if (!ordersOpen) return true;
    if (p.stock == null) return false;
    const cart = getCart();
    const inCart = cart.find((c) => c.product_id === p.id);
    const inCartQty = inCart ? inCart.quantity : 0;
    return inCartQty >= p.stock;
  };

  const stockLabel = (p: Product) => {
    if (!ordersOpen) return "Orders closed";
    if (p.stock == null) return "Unlimited";
    const cart = getCart();
    const inCart = cart.find((c) => c.product_id === p.id);
    const inCartQty = inCart ? inCart.quantity : 0;
    const available = p.stock - inCartQty;
    if (available <= 0) return "Out of stock";
    return `${available} ${p.unit} available`;
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Shop" />
      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        {/* Orders Closed Banner */}
        {!ordersOpen && (
          <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 p-4 text-center text-base font-semibold text-red-700">
            Orders are currently closed. Please check back later.
          </div>
        )}

        {/* Hero Banner */}
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

        {/* Search Bar */}
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

        {/* Products Grid */}
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
            {filtered.map((p, idx) => (
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
                    <p className="mt-0.5 text-sm text-muted-foreground sm:text-base">
                      per {p.unit}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs sm:text-sm">
                    <span
                      className={`font-medium ${isOutOfStock(p) ? "text-red-500" : "text-green-600"}`}
                    >
                      {stockLabel(p)}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-xl font-bold text-primary sm:text-2xl">
                      INR {Number(p.price).toFixed(0)}
                    </span>
                    <button
                      onClick={() => add(p)}
                      disabled={!ordersOpen || isOutOfStock(p)}
                      className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition sm:px-6 sm:py-3.5 sm:text-base ${
                        added === p.id
                          ? "bg-green-600 text-white"
                          : !ordersOpen || isOutOfStock(p)
                            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                            : "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]"
                      }`}
                    >
                      {added === p.id ? (
                        <>
                          <Check className="h-4 w-4 sm:h-5 sm:w-5" /> Added
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 sm:h-5 sm:w-5" />{" "}
                          {!ordersOpen
                            ? "Orders Closed"
                            : isOutOfStock(p)
                              ? "Out of Stock"
                              : "Add to Cart"}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-10">
          <AboutSection />
        </div>
      </main>
    </div>
  );
}
