import { createFileRoute, useNavigate, Outlet, useMatches } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPhone, getRole } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { OrdersClosedBanner } from "@/components/OrdersClosedBanner";

type Product = {
  id: string;
  name: string;
  unit: string;
  price: number;
  active: boolean;
  category: string;
  image_url?: string | null;
  stock?: number | null;
  priority?: number | null;
};
type PublicCategory = {
  name: string;
  slug: string;
  image_url?: string | null;
  priority?: number | null;
};
type PublicCategoryQueryClient = {
  from: (table: "categories") => {
    select: (columns: string) => Promise<{ data: unknown[] | null; error: unknown | null }>;
  };
};

const publicCategoryQueryClient = supabase as unknown as PublicCategoryQueryClient;

const FALLBACK_META = { label: "Category", color: "#145B42", bg: "#F3F4F6" };

export const Route = createFileRoute("/shop")({
  component: ShopPage,
  head: () => ({ meta: [{ title: "Shop - Manapalle Products" }] }),
});

function ShopPage() {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeDot, setActiveDot] = useState(0);

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

  const matches = useMatches();
  const hasChild = matches.some((m) => m.routeId === "/shop/$category");

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["products", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, unit, price, image_url, active, category, stock, priority");
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

  const { data: publicCategories = [], isLoading: loadingCategories } =
    useQuery<PublicCategory[]>({
      queryKey: ["categories", "public"],
      queryFn: async () => {
        const { data, error } = await publicCategoryQueryClient
          .from("categories")
          .select("name, slug, image_url, priority");
        if (error) {
          console.error("Failed to load public categories:", error);
          return [];
        }
        return (data as unknown as PublicCategory[]) || [];
      },
      staleTime: 60_000,
    });

  const categories = Array.from(
    new Set([
      ...publicCategories.map((category) => category.slug),
      ...products.map((product) => product.category),
    ]),
  )
    .filter(Boolean)
    .sort((a, b) => {
      const aCategory = publicCategories.find((category) => category.slug === a);
      const bCategory = publicCategories.find((category) => category.slug === b);
      return (
        (aCategory?.priority ?? Number.MAX_SAFE_INTEGER) -
          (bCategory?.priority ?? Number.MAX_SAFE_INTEGER) ||
        (aCategory?.name || a).localeCompare(bCategory?.name || b)
      );
    });
  const categoryCounts = categories.reduce(
    (acc, cat) => {
      acc[cat] = products.filter((p) => p.category === cat).length;
      return acc;
    },
    {} as Record<string, number>,
  );

  const getCatMeta = (cat: string) => {
    const category = publicCategories.find((item) => item.slug === cat);
    const fallback = FALLBACK_META;
    return {
      ...fallback,
      label: category?.name || fallback.label,
      image: category?.image_url || fallback.image,
    };
  };

  if (hasChild) {
    return (
      <div className="min-h-screen bg-background">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Shop" />
      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        <OrdersClosedBanner />
        {/* HERO */}
        <section className="relative overflow-hidden" style={{ backgroundColor: "#F4EAD5" }}>
          <div className="absolute inset-0 opacity-10">
            <svg viewBox="0 0 1240 400" preserveAspectRatio="none" className="h-full w-full">
              <path
                d="M0 280 C 200 240, 380 360, 640 300 S 1080 200, 1240 270 L1240 400 L0 400 Z"
                fill="#145B42"
                opacity="0.08"
              />
            </svg>
          </div>
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-row items-center justify-between gap-4 py-6 sm:gap-8 sm:py-10 lg:gap-12">
              <div className="min-w-0 flex-1">
                <span
                  className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider sm:mb-4 sm:px-4 sm:py-1.5 sm:text-xs"
                  style={{ backgroundColor: "#145B42", color: "#F4EAD5" }}
                >
                  Village-raised, home-delivered
                </span>
                <h1
                  className="text-xl font-bold leading-tight sm:text-4xl lg:text-6xl"
                  style={{ color: "#145B42" }}
                >
                  Fresh Mutton
                  <span
                    className="block text-base font-medium sm:text-3xl lg:text-5xl"
                    style={{ color: "#4F7F35" }}
                  >
                    From Our Village
                  </span>
                  <span
                    className="block text-base font-medium sm:text-3xl lg:text-5xl"
                    style={{ color: "#4F7F35" }}
                  >
                    To Your Home
                  </span>
                </h1>
                <p
                  className="mt-3 text-xs sm:mt-4 sm:text-base lg:text-lg"
                  style={{ color: "#6B4630" }}
                >
                  100% fresh, tender and hygienically packed mutton, cut by hand and delivered
                  straight from Manapalle village to your kitchen.
                </p>
              </div>
              <div className="shrink-0">
                <img
                  src="/lamb.jpg"
                  alt="Fresh Mutton"
                  className="h-28 w-auto rounded-xl shadow-xl sm:h-48 sm:rounded-2xl sm:shadow-2xl lg:h-80"
                />
              </div>
            </div>
            <div className="relative flex items-center justify-center gap-3 pb-6 sm:gap-4 sm:pb-10 lg:justify-start">
              <button
                onClick={() =>
                  document.getElementById("category-grid")?.scrollIntoView({ behavior: "smooth" })
                }
                className="inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-bold shadow-lg transition hover:shadow-xl active:scale-[0.98] sm:px-7 sm:py-3 sm:text-sm"
                style={{ backgroundColor: "#145B42", color: "#F4EAD5" }}
              >
                Shop Now
              </button>
              <a
                href="tel:9030901233"
                className="inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-bold shadow-lg transition hover:shadow-xl active:scale-[0.98] sm:px-7 sm:py-3 sm:text-sm"
                style={{ backgroundColor: "#C94F5C", color: "#FFF8EC" }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                </svg>
                Call 90309 01233
              </a>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-2xl px-4 pb-3">
          <a
            href="https://aplustechservices.in"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-center gap-2 overflow-hidden rounded-lg bg-primary/5 px-3 py-2 transition active:scale-[0.98]"
          >
            <span className="shrink-0 text-[10px] text-muted-foreground">Powered by</span>
            <img
              src="/A+.jpeg"
              alt="A+ Tech Services"
              className="h-5 w-5 shrink-0 rounded object-contain transition group-hover:scale-110"
            />
            <span className="shrink-0 text-[10px] font-bold text-primary">A+ Tech Services</span>
          </a>
        </div>

        {/* TRUST STRIP */}
        <section className="relative z-10 mx-auto max-w-5xl px-4 pb-4 sm:px-6">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-card p-2 shadow sm:flex sm:gap-3 sm:p-3">
            {[
              {
                title: "100% Natural",
                icon: (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5 shrink-0 sm:h-6 sm:w-6"
                  >
                    <path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66L7 18" />
                    <path d="M17 8c2-1 4 0 4 0s1 2 0 4" />
                    <path d="M17 8A8 8 0 003.5 17.5" />
                  </svg>
                ),
              },
              {
                title: "Tender & Juicy",
                icon: (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5 shrink-0 sm:h-6 sm:w-6"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ),
              },
              {
                title: "Hygienically Packed",
                icon: (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5 shrink-0 sm:h-6 sm:w-6"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                ),
              },
              {
                title: "Delivered Fresh",
                icon: (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5 shrink-0 sm:h-6 sm:w-6"
                  >
                    <rect x="1" y="3" width="15" height="13" />
                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                    <circle cx="5.5" cy="18.5" r="2.5" />
                    <circle cx="18.5" cy="18.5" r="2.5" />
                  </svg>
                ),
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-center justify-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5 sm:flex-1 sm:px-4 sm:py-3"
              >
                <span className="text-primary">{item.icon}</span>
                <span className="whitespace-nowrap text-xs font-bold text-primary sm:text-sm">
                  {item.title}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* CATEGORIES */}
        <div id="category-grid" className="mt-2">
          <h2 className="mb-3 text-lg font-bold text-foreground sm:text-xl">Choose a Category</h2>

          {isLoading || loadingCategories ? (
            <div className="flex gap-4 overflow-hidden">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-52 w-48 shrink-0 animate-pulse rounded-2xl bg-muted sm:h-56 sm:w-52"
                />
              ))}
            </div>
          ) : (
            <>
              <div
                ref={scrollRef}
                className="hide-scrollbar flex gap-4 overflow-x-auto pb-2"
                onScroll={() => {
                  const el = scrollRef.current;
                  if (!el) return;
                  const cardWidth = 208 + 16;
                  const idx = Math.round(el.scrollLeft / cardWidth);
                  setActiveDot(Math.min(idx, categories.length - 1));
                }}
              >
                {categories.map((cat) => {
                  const meta = getCatMeta(cat);
                  const count = categoryCounts[cat] || 0;
                  return (
                    <button
                      key={cat}
                      onClick={() => navigate({ to: "/shop/$category", params: { category: cat } })}
                      className="group flex w-48 shrink-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:shadow-lg active:scale-[0.97] sm:w-52"
                    >
                      <div className="relative flex h-40 w-full items-center justify-center overflow-hidden bg-white sm:h-44">
                        {meta.image ? (
                          <img
                            src={meta.image}
                            alt={meta.label}
                            className="max-h-full max-w-full object-contain p-1"
                          />
                        ) : (
                          <div
                            className="flex h-full w-full items-center justify-center"
                            style={{ backgroundColor: meta.bg }}
                          >
                            <span
                              className="text-6xl font-extrabold sm:text-7xl"
                              style={{ color: meta.color }}
                            >
                              {meta.label.charAt(0)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="w-full px-3 py-3 text-center">
                        <div
                          className="text-base font-bold sm:text-lg"
                          style={{ color: meta.color }}
                        >
                          {meta.label}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {count} {count === 1 ? "item" : "items"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {categories.length > 1 && (
                <div className="mt-3 flex items-center justify-center gap-1.5">
                  {categories.map((_, i) => (
                    <span
                      key={i}
                      className={`block rounded-full transition-all duration-300 ${
                        i === activeDot
                          ? "h-2 w-2 bg-primary"
                          : "h-1.5 w-1.5 bg-muted-foreground/30"
                      }`}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
