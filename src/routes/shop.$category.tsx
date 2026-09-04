import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Plus, Search, ShoppingCart, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPhone, getRole } from "@/lib/session";
import { addToCart, getCart } from "@/lib/cart";
import { AppHeader } from "@/components/AppHeader";
import { OrdersClosedBanner } from "@/components/OrdersClosedBanner";

type Product = {
  id: string;
  name: string;
  unit: string;
  price: number;
  active: boolean;
  category: string;
  subcategory?: string | null;
  image_url?: string | null;
  stock?: number | null;
  priority?: number | null;
};
type PublicCategory = { name: string; slug: string; image_url?: string | null };
type PublicSubcategory = { name: string; slug: string; category_slug: string; priority?: number | null };
type PublicCategoryQueryClient = {
  from: (table: "categories") => {
    select: (columns: string) => Promise<{ data: unknown[] | null; error: unknown | null }>;
  };
};

const SIZE_OPTIONS = [
  { label: "500g", multiplier: 0.5 },
  { label: "750g", multiplier: 0.75 },
  { label: "1kg", multiplier: 1 },
];
// Size options for different categories
const ALL_SIZE_OPTIONS = SIZE_OPTIONS;

// Fish, prawns, and crab products are sold only in 1kg portions.
function getCategorySizeOptions(categorySlug: string, productName: string) {
  const fishOnly = `${categorySlug} ${productName}`.toLowerCase();
  if (/(fish|prawns?|crab)/.test(fishOnly)) {
    return [{ label: "1kg", multiplier: 1 }];
  }
  return ALL_SIZE_OPTIONS;
}



const FALLBACK_META = { label: "Category", color: "#145B42", bg: "#F3F4F6", image: undefined };

export const Route = createFileRoute("/shop/$category")({
  component: CategoryPage,
  head: ({ params }) => {
    const meta = FALLBACK_META;
    return { meta: [{ title: `${meta.label} - Manapalle Products` }] };
  },
});

function CategoryPage() {
  const { category } = Route.useParams();
  const navigate = useNavigate();
  const [added, setAdded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showClosedPopup, setShowClosedPopup] = useState(false);

  const { data: categoryRows = [] } = useQuery<PublicCategory[]>({
    queryKey: ["categories", "public"],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as PublicCategoryQueryClient)
        .from("categories")
        .select("name, slug, image_url");
      if (error) return [];
      return (data as unknown as PublicCategory[]) || [];
    },
    staleTime: 60_000,
  });

  const publicCategory = categoryRows.find((item) => item.slug === category);
  const fallbackMeta = FALLBACK_META;
  const catMeta = {
    ...fallbackMeta,
    label: publicCategory?.name || fallbackMeta.label,
    image: publicCategory?.image_url || fallbackMeta.image,
  };

  const { data: publicSubcategories = [] } = useQuery<PublicSubcategory[]>({
    queryKey: ["subcategories", "public", category],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as {
        from: (table: "subcategories") => {
          select: (columns: string) => Promise<{ data: unknown[] | null; error: unknown | null }>;
        };
      })
        .from("subcategories")
        .select("name, slug, category_slug, priority");
      if (error) return [];
      return ((data as unknown as PublicSubcategory[]) || [])
        .filter((item) => item.category_slug === category)
        .sort(
          (a, b) =>
            (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER) ||
            a.name.localeCompare(b.name),
        );
    },
    staleTime: 60_000,
  });

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
        .select("id, name, unit, price, image_url, active, category, subcategory, stock, priority");
      if (error) {
        console.error("Failed to load products:", error);
        return [];
      }
      const result = (data as Product[]) || [];
      result.sort((a, b) => {
        const pa = a.priority ?? 9999;
        const pb = b.priority ?? 9999;
        if (pa !== pb) return pa - pb;
        return a.name.localeCompare(b.name);
      });
      return result;
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

  const filtered = products.filter((p) => {
    const matchesCategory = p.category === category;
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  }).sort((a, b) => (a.subcategory || "").localeCompare(b.subcategory || "") || a.name.localeCompare(b.name));

  const add = (p: Product, sizeLabel: string, sizePrice: number) => {
    if (!ordersOpen) {
      setShowClosedPopup(true);
      return;
    }
    const cart = getCart();
    const inCart = cart.find((c) => c.product_id === p.id && c.unit === sizeLabel);
    const inCartQty = inCart ? inCart.quantity : 0;
    const sizeMultiplier = ALL_SIZE_OPTIONS.find((s) => s.label === sizeLabel)?.multiplier ?? 1;
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
      <AppHeader title={catMeta.label} />
      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        <OrdersClosedBanner />
        {/* ORDERS CLOSED POPUP */}
        {showClosedPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
            <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
              <button
                onClick={() => setShowClosedPopup(false)}
                className="absolute right-3 top-3 rounded-full p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#C94F5C"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-7 w-7"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <h3 className="text-center text-lg font-bold text-gray-900">Orders are Closed</h3>
              <p className="mt-2 text-center text-sm text-gray-500">
                We are not accepting orders right now. Please check back later or call us for
                inquiries.
              </p>
              <div className="mt-5 flex gap-3">
                <a
                  href="tel:9030901233"
                  className="flex-1 rounded-xl bg-[#C94F5C] py-3 text-center text-sm font-semibold text-white transition active:scale-[0.98]"
                >
                  Call Us
                </a>
                <button
                  onClick={() => setShowClosedPopup(false)}
                  className="flex-1 rounded-xl border border-gray-200 bg-gray-50 py-3 text-center text-sm font-semibold text-gray-700 transition hover:bg-gray-100 active:scale-[0.98]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HEADER: Back + Search + Cart */}
        <div className="mb-5 flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/shop" })}
            className="flex items-center justify-center rounded-xl border bg-card p-3 shadow-sm transition active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex flex-1 items-center gap-3 rounded-xl border bg-card px-4 py-3 transition focus-within:ring-2 focus-within:ring-primary">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${catMeta.label.toLowerCase()}...`}
              className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
          </div>
          <button
            onClick={() => navigate({ to: "/cart" })}
            className="relative flex items-center justify-center rounded-xl bg-primary p-3 text-primary-foreground shadow-sm transition hover:opacity-90 active:scale-95"
          >
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground shadow-sm">
                {cartCount}
              </span>
            )}
          </button>
        </div>

        {/* CATEGORY TITLE */}
        <div className="mb-4 flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg"
            style={{ backgroundColor: catMeta.bg }}
          >
            {catMeta.image ? (
              <img src={catMeta.image} alt={catMeta.label} className="h-full w-full object-cover" />
            ) : (
              <span
                className="text-sm font-bold text-white"
                style={{
                  backgroundColor: catMeta.color,
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {catMeta.label.charAt(0)}
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold" style={{ color: catMeta.color }}>
            {catMeta.label}
          </h1>
          <span className="text-sm text-muted-foreground">({filtered.length})</span>
        </div>

        {publicSubcategories.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-2">
            {publicSubcategories.map((subcategory) => (
              <span
                key={subcategory.slug}
                className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary"
              >
                {subcategory.name} ({filtered.filter((p) => p.subcategory === subcategory.slug).length})
              </span>
            ))}
          </div>
        )}

        {/* PRODUCTS */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse overflow-hidden rounded-xl border bg-card">
                <div className="aspect-square bg-muted" />
                <div className="p-3">
                  <div className="h-4 w-2/3 rounded bg-muted" />
                  <div className="mt-2 h-3 w-16 rounded bg-muted" />
                  <div className="mt-3 space-y-1.5">
                    <div className="h-7 w-full rounded-lg bg-muted" />
                    <div className="h-7 w-full rounded-lg bg-muted" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border bg-card py-16 text-center">
            <p className="text-lg font-medium text-muted-foreground">No products found</p>
            <p className="mt-2 text-sm text-muted-foreground/70">Try a different search term</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {filtered.map((p, idx) => {
              const sizes = hasSizes(p) ? getCategorySizeOptions(category, p.name) : null;
              return (
                <div key={p.id} className="contents">
                  {p.subcategory && (idx === 0 || filtered[idx - 1]?.subcategory !== p.subcategory) && (
                    <h2 className="col-span-full mt-3 border-b pb-2 text-lg font-bold text-primary first:mt-0">
                      {publicSubcategories.find((item) => item.slug === p.subcategory)?.name || p.subcategory}
                    </h2>
                  )}
                  <div
                    className={`animate-slide-up stagger-${Math.min(idx + 1, 6)} group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition hover:shadow-md`}
                  >
                  {/* Image */}
                  <div className="relative aspect-square shrink-0 overflow-hidden">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground">
                        No Image
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex flex-1 flex-col p-3">
                    <h3 className="text-sm font-semibold leading-tight sm:text-base">{p.name}</h3>

                    {sizes ? (
                      <div className="mt-auto pt-2 space-y-1.5">
                        {sizes.map((size) => {
                          const calcPrice = Math.round(p.price * size.multiplier);
                          const key = p.id + "|" + size.label;
                          const isAdded = added === key;
                          const cartItem = getCart().find(
                            (c) => c.product_id === p.id && c.unit === size.label,
                          );
                          const cartKg = (cartItem?.quantity ?? 0) * size.multiplier;
                          const outOfStock = p.stock != null && cartKg >= p.stock;
                          const remaining = p.stock != null ? Math.max(0, p.stock - cartKg) : null;
                          return (
                            <div
                              key={size.label}
                              className={`flex items-center justify-between gap-1 rounded-lg border px-2 py-1.5 text-xs ${
                                isAdded ? "border-green-400 bg-green-50" : ""
                              }`}
                            >
                              <div className="min-w-0">
                                <span className="font-medium">{size.label}</span>
                                <span className="ml-1 text-muted-foreground">INR {calcPrice}</span>
                                {remaining !== null && remaining <= 2 && (
                                  <span
                                    className={`ml-1 ${outOfStock ? "text-red-500" : "text-orange-500"}`}
                                  >
                                    {outOfStock
                                      ? "Out"
                                      : `${remaining % 1 === 0 ? remaining.toFixed(0) : remaining.toFixed(1)}kg`}
                                  </span>
                                )}
                              </div>
                              {ordersOpen ? (
                                <button
                                  onClick={() => add(p, size.label, calcPrice)}
                                  disabled={outOfStock}
                                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition ${
                                    isAdded
                                      ? "bg-green-600 text-white"
                                      : outOfStock
                                        ? "bg-gray-200 text-gray-400"
                                        : "bg-primary text-primary-foreground active:scale-90"
                                  }`}
                                >
                                  {isAdded ? (
                                    <Check className="h-3 w-3" />
                                  ) : outOfStock ? (
                                    "X"
                                  ) : (
                                    <Plus className="h-3 w-3" />
                                  )}
                                </button>
                              ) : (
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gray-200 text-gray-400">
                                  <Plus className="h-3 w-3" />
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-auto pt-2">
                        {(() => {
                          const cartItem = getCart().find(
                            (c) => c.product_id === p.id && c.unit === p.unit,
                          );
                          const cartQty = cartItem?.quantity ?? 0;
                          const outOfStock = p.stock != null && cartQty >= p.stock;
                          const remaining = p.stock != null ? Math.max(0, p.stock - cartQty) : null;
                          const unitDisplay =
                            p.unit === "tray" ? "Tray" : p.unit === "dozen" ? "Dozen" : p.unit;
                          return (
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-[10px] text-muted-foreground">
                                  per {unitDisplay}
                                </p>
                                <span className="text-sm font-bold text-primary">
                                  INR {Number(p.price).toFixed(0)}
                                </span>
                                {remaining !== null && remaining <= 2 && (
                                  <span
                                    className={`ml-1 text-[10px] ${outOfStock ? "text-red-500" : "text-orange-500"}`}
                                  >
                                    {outOfStock ? "Out" : `${remaining} left`}
                                  </span>
                                )}
                              </div>
                              {ordersOpen ? (
                                <button
                                  onClick={() => add(p, p.unit, Number(p.price))}
                                  disabled={outOfStock}
                                  className={`flex h-8 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                    added === p.id + "|" + p.unit
                                      ? "bg-green-600 text-white"
                                      : outOfStock
                                        ? "bg-gray-200 text-gray-400"
                                        : "bg-primary text-primary-foreground active:scale-95"
                                  }`}
                                >
                                  {added === p.id + "|" + p.unit ? (
                                    <>
                                      <Check className="h-3 w-3" /> Added
                                    </>
                                  ) : outOfStock ? (
                                    "Out"
                                  ) : (
                                    <>
                                      <Plus className="h-3 w-3" /> Add
                                    </>
                                  )}
                                </button>
                              ) : (
                                <span className="flex h-8 items-center gap-1 rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-400">
                                  <Plus className="h-3 w-3" /> Closed
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
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
