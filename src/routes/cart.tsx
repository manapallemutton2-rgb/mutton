import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { CartItem, cartTotal, getCart, removeFromCart, updateQty } from "@/lib/cart";
import { getPhone } from "@/lib/session";

export const Route = createFileRoute("/cart")({
  component: CartPage,
  head: () => ({ meta: [{ title: "Cart - Manapalle Mutton" }] }),
});

const step = (unit: string) => (unit.includes("g") || unit === "kg" ? 0.5 : 1);

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
              {items.map((item, idx) => (
                <div
                  key={item.product_id}
                  className={`animate-slide-up stagger-${Math.min(idx + 1, 6)} flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4 transition hover:shadow-md sm:flex-nowrap sm:gap-5 sm:p-5`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold sm:text-lg">{item.name}</p>
                    <p className="text-sm text-muted-foreground sm:text-base">
                      INR {item.price} / {item.unit}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 rounded-xl border bg-background">
                    <button
                      onClick={() => updateQty(item.product_id, item.quantity - step(item.unit))}
                      className="flex h-10 w-10 items-center justify-center rounded-l-xl transition hover:bg-muted sm:h-12 sm:w-12"
                    >
                      <Minus className="h-4 w-4 sm:h-5 sm:w-5" />
                    </button>
                    <span className="flex w-10 items-center justify-center text-base font-medium sm:w-14 sm:text-lg">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQty(item.product_id, item.quantity + step(item.unit))}
                      className="flex h-10 w-10 items-center justify-center rounded-r-xl transition hover:bg-muted sm:h-12 sm:w-12"
                    >
                      <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                    </button>
                  </div>
                  <div className="ml-auto text-base font-bold text-primary sm:w-24 sm:text-xl">
                    INR {Math.round(item.price * item.quantity)}
                  </div>
                  <button
                    onClick={() => removeFromCart(item.product_id)}
                    className="rounded-xl p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive sm:p-3"
                  >
                    <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                </div>
              ))}
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
