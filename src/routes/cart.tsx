import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { CartItem, cartTotal, getCart, removeFromCart, updateQty, unitToKg } from "@/lib/cart";
import { getPhone } from "@/lib/session";

export const Route = createFileRoute("/cart")({
  component: CartPage,
  head: () => ({ meta: [{ title: "Cart - Manapalle Mutton" }] }),
});

const step = (unit: string) => (unit.includes("g") || unit === "kg" ? 0.5 : 1);

function groupItems(items: CartItem[]) {
  const groups = new Map<string, CartItem[]>();
  for (const item of items) {
    const g = groups.get(item.name) || [];
    g.push(item);
    groups.set(item.name, g);
  }
  return Array.from(groups.entries());
}

function CartPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CartItem[]>([]);

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

  useEffect(() => {
    const update = () => {
      if (!getPhone()) {
        navigate({ to: "/login" });
        return;
      }
      setItems(getCart());
    };
    update();
    window.addEventListener("cart-updated", update);
    window.addEventListener("session-updated", update);
    return () => {
      window.removeEventListener("cart-updated", update);
      window.removeEventListener("session-updated", update);
    };
  }, [navigate]);

  const total = cartTotal(items);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Cart" />
      <main className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6">
        {!ordersOpen && (
          <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 p-4 text-center text-base font-semibold text-red-700">
            Orders are currently closed. You cannot place orders right now.
          </div>
        )}
        <Link
          to="/shop"
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground sm:mb-6 sm:text-base"
        >
          <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" /> Back to Shop
        </Link>
        <h1 className="mb-5 text-2xl font-bold sm:mb-6 sm:text-3xl">Your Cart</h1>

        {items.length === 0 ? (
          <div className="rounded-2xl border bg-card py-16 text-center sm:py-20">
            <ShoppingBag className="mx-auto mb-5 h-16 w-16 text-muted-foreground/30 sm:h-20 sm:w-20" />
            <p className="text-lg font-medium text-muted-foreground sm:text-xl">
              Your cart is empty
            </p>
            <p className="mt-2 text-sm text-muted-foreground/70 sm:text-base">
              Add some fresh meat to get started
            </p>
            <Link
              to="/shop"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-base font-semibold text-primary-foreground transition hover:opacity-90 sm:mt-8 sm:px-8 sm:py-4 sm:text-lg"
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-5 lg:flex-row lg:gap-6">
            {/* Items List */}
            <div className="flex-1 space-y-3 sm:space-y-4">
              {groupItems(items).map(([name, nameItems]) => {
                const totalKg = nameItems.reduce((s, i) => s + unitToKg(i.unit, i.quantity), 0);
                const groupTotal = nameItems.reduce((s, i) => s + i.price * i.quantity, 0);
                const showKg = nameItems.some((i) => unitToKg(i.unit, i.quantity) !== i.quantity);
                return (
                    <div key={name} className="rounded-2xl border bg-card p-3 sm:p-5">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-1 border-b pb-2">
                      <p className="text-sm font-bold sm:text-lg">{name}</p>
                      <p className="text-xs font-semibold text-primary sm:text-base">
                        {showKg ? `${totalKg.toFixed(1)}kg · ` : ""}INR {Math.round(groupTotal)}
                      </p>
                    </div>
                    {nameItems.map((item) => {
                      const key = item.product_id + "|" + item.unit;
                      const itemKg = unitToKg(item.unit, item.quantity);
                      return (
                        <div key={key} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2">
                          <div className="min-w-0 flex-1 basis-full xs:basis-auto">
                            <p className="text-xs text-muted-foreground sm:text-sm">
                              {item.unit} · INR {item.price}/{item.unit}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 rounded-lg border bg-background">
                            <button
                              onClick={() => updateQty(item.product_id, item.unit, item.quantity - step(item.unit))}
                              className="flex h-7 w-7 items-center justify-center rounded-l-lg transition hover:bg-muted sm:h-9 sm:w-9"
                            >
                              <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
                            </button>
                            <span className="flex w-7 items-center justify-center text-xs font-medium sm:w-10 sm:text-sm">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQty(item.product_id, item.unit, item.quantity + step(item.unit))}
                              className="flex h-7 w-7 items-center justify-center rounded-r-lg transition hover:bg-muted sm:h-9 sm:w-9"
                            >
                              <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                            </button>
                          </div>
                          <div className="ml-auto flex items-center gap-2">
                            <span className="text-xs font-bold text-primary sm:text-sm">
                              INR {Math.round(item.price * item.quantity)}
                            </span>
                            {showKg && (
                              <span className="text-[10px] text-muted-foreground sm:text-xs">
                                {itemKg.toFixed(1)}kg
                              </span>
                            )}
                            <button
                              onClick={() => removeFromCart(item.product_id, item.unit)}
                              className="rounded-lg p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Order Summary */}
            <div className="w-full shrink-0 lg:w-[340px]">
              <div className="rounded-2xl border bg-card p-5 lg:sticky lg:top-24 sm:p-6">
                <h2 className="mb-4 text-lg font-semibold sm:mb-5 sm:text-xl">Order Summary</h2>
                <div className="space-y-3 text-sm sm:space-y-4 sm:text-base">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items ({itemCount})</span>
                    <span className="font-medium">INR {Math.round(total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery</span>
                    <span className="font-medium text-green-700">Free</span>
                  </div>
                  <div className="border-t pt-3 sm:pt-4">
                    <div className="flex justify-between text-lg font-bold sm:text-xl">
                      <span>Total</span>
                      <span className="text-primary">INR {Math.round(total)}</span>
                    </div>
                  </div>
                </div>
                <Link
                  to="/checkout"
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-foreground transition hover:opacity-90 active:scale-[0.98] sm:mt-6 sm:py-4 sm:text-lg"
                >
                  Proceed to Checkout
                </Link>
                <Link
                  to="/shop"
                  className="mt-3 block text-center text-sm text-muted-foreground hover:text-foreground sm:mt-4 sm:text-base"
                >
                  Continue Shopping
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
