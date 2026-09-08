import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, LogOut, User, Menu, X, Package, ChevronDown, ChevronUp } from "lucide-react";
import { clearSession, getPhone, getName, getRole } from "@/lib/session";
import { getCart } from "@/lib/cart";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Order = {
  id: string;
  order_number: string;
  phone: string;
  customer_name: string;
  flat_no: string;
  community_name: string;
  block_name: string;
  total: number;
  status: string;
  created_at: string;
};

type OrderItem = {
  id: string;
  order_id: string;
  product_name: string;
  unit: string;
  price: number;
  quantity: number;
};

export function AppHeader({ title }: { title?: string }) {
  const navigate = useNavigate();
  const [phone, setPhone] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      setPhone(getPhone());
      setName(getName());
      setRole(getRole());
      setCount(getCart().reduce((s, i) => s + i.quantity, 0));
    };
    update();
    window.addEventListener("cart-updated", update);
    window.addEventListener("session-updated", update);
    return () => {
      window.removeEventListener("cart-updated", update);
      window.removeEventListener("session-updated", update);
    };
  }, []);

  const { data: orders = [], isLoading: loadingOrders } = useQuery<Order[]>({
    queryKey: ["user", "orders", phone],
    queryFn: async () => {
      if (!phone) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("phone", phone)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Failed to load orders:", error);
        return [];
      }
      return (data as Order[]) || [];
    },
    enabled: !!phone && ordersOpen,
    staleTime: 15_000,
  });

  const { data: items = [], isLoading: loadingItems } = useQuery<OrderItem[]>({
    queryKey: ["user", "order_items", phone],
    queryFn: async () => {
      if (!phone) return [];
      const { data: orderIds, error: idsErr } = await supabase
        .from("orders")
        .select("id")
        .eq("phone", phone);
      if (idsErr || !orderIds || orderIds.length === 0) return [];
      const ids = orderIds.map((o: { id: string }) => o.id);
      const { data, error } = await supabase.from("order_items").select("*").in("order_id", ids);
      if (error) {
        console.error("Failed to load order items:", error);
        return [];
      }
      return (data as OrderItem[]) || [];
    },
    enabled: !!phone && ordersOpen,
    staleTime: 15_000,
  });

  const logout = () => {
    clearSession();
    navigate({ to: "/login" });
  };

  const toggleExpand = (orderId: string) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  const isLoading = loadingOrders || loadingItems;

  return (
    <header className="no-print sticky top-0 z-50 border-b border-white/10 bg-primary shadow-lg">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5 sm:px-6">
        {/* Logo + Brand */}
        <Link
          to={role === "admin" ? "/admin" : "/shop"}
          className="flex items-center gap-3 transition-opacity hover:opacity-80"
        >
          <img
            src="/MM.jpeg"
            alt="Manapalle"
            className="h-10 w-10 rounded-lg object-cover ring-2 ring-white/20 sm:h-12 sm:w-12"
          />
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold tracking-tight text-white sm:text-lg">
                Manapalle Products
              </span>
            </div>
            <p className="hidden text-[10px] leading-tight text-white/50 sm:block">
              Fresh from the Village, Straight to Your Home
            </p>
          </div>
          {title && (
            <span className="hidden text-sm font-light text-white/60 sm:inline">/ {title}</span>
          )}
        </Link>

        {/* Mobile buttons */}
        {phone && role === "user" && (
          <div className="flex items-center gap-1.5 md:hidden">
            <button
              onClick={() => {
                setOrdersOpen(true);
                setExpandedOrder(null);
              }}
              className="flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              <Package className="h-3.5 w-3.5" /> Orders
            </button>
            <Link
              to="/cart"
              className="relative flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-primary shadow-md transition-all hover:shadow-lg active:scale-95"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              {count > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm">
                  {count}
                </span>
              )}
            </Link>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center rounded-lg border border-white/20 bg-white/10 p-1.5 backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              {menuOpen ? (
                <X className="h-4 w-4 text-white" />
              ) : (
                <Menu className="h-4 w-4 text-white" />
              )}
            </button>
          </div>
        )}
        {phone && role !== "user" && (
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center rounded-lg border border-white/20 bg-white/10 p-2 backdrop-blur-sm transition-colors hover:bg-white/20 md:hidden"
          >
            {menuOpen ? (
              <X className="h-5 w-5 text-white" />
            ) : (
              <Menu className="h-5 w-5 text-white" />
            )}
          </button>
        )}

        {/* Desktop nav */}
        <nav className="hidden items-center gap-5 text-sm text-white/90 md:flex">
          <Link
            to="/about"
            className="font-medium text-white/80 transition-colors hover:text-white hover:underline hover:underline-offset-4"
          >
            About Us
          </Link>
          {phone && role === "user" && (
            <>
              <button
                onClick={() => {
                  setOrdersOpen(true);
                  setExpandedOrder(null);
                }}
                className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 font-medium text-white/80 backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/20 hover:text-white"
              >
                <Package className="h-3.5 w-3.5" /> Previous Orders
              </button>
              <Link
                to="/shop"
                className="font-medium text-white/80 transition-colors hover:text-white hover:underline hover:underline-offset-4"
              >
                Shop
              </Link>
              <Link
                to="/cart"
                className="relative flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-primary shadow-md transition-all hover:bg-white/90 hover:shadow-lg active:scale-[0.97]"
              >
                <ShoppingCart className="h-4 w-4" />
                Cart
                {count > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
                    {count}
                  </span>
                )}
              </Link>
              <span className="flex items-center gap-1.5 text-sm font-medium text-white/70">
                <User className="h-3.5 w-3.5" />
                {name}
              </span>
            </>
          )}
          {phone && role === "admin" && (
            <Link
              to="/admin"
              className="font-medium text-white/80 transition-colors hover:text-white hover:underline hover:underline-offset-4"
            >
              Admin
            </Link>
          )}
          {phone && (
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-sm font-medium text-white/60 backdrop-blur-sm transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white/90"
            >
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          )}
        </nav>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && phone && (
        <div className="border-t border-white/10 bg-primary/95 px-6 py-4 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-2 text-sm">
            <Link
              to="/about"
              onClick={() => setMenuOpen(false)}
              className="rounded-lg py-2.5 font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white"
            >
              About Us
            </Link>
            {role === "user" && (
              <>
                <span className="flex items-center gap-2 py-2.5 text-sm text-white/60">
                  <User className="h-4 w-4" /> {name}
                </span>
                <Link
                  to="/shop"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg py-2.5 font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white"
                >
                  Shop
                </Link>
                <button
                  onClick={logout}
                  className="flex items-center gap-2 py-2.5 text-left font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white/90"
                >
                  <LogOut className="h-4 w-4" /> Logout
                </button>
              </>
            )}
            {role === "admin" && (
              <>
                <Link
                  to="/admin"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg py-2.5 font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white"
                >
                  Admin Panel
                </Link>
                <button
                  onClick={logout}
                  className="flex items-center gap-2 py-2.5 text-left font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white/90"
                >
                  <LogOut className="h-4 w-4" /> Logout
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Previous Orders Dialog */}
      <Dialog open={ordersOpen} onOpenChange={setOrdersOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Previous Orders</DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
                  <div className="h-4 w-1/3 rounded bg-muted" />
                  <div className="mt-2 h-3 w-1/2 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Package className="mx-auto mb-3 h-12 w-12" />
              <p className="text-base">No orders yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const orderItems = items.filter((i) => i.order_id === order.id);
                const isExpanded = expandedOrder === order.id;
                return (
                  <div key={order.id} className="rounded-xl border bg-card">
                    <button
                      onClick={() => toggleExpand(order.id)}
                      className="flex w-full items-center justify-between p-4 text-left"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-primary text-base">
                            {order.order_number}
                          </span>
                          <span className="rounded-full bg-accent px-3 py-0.5 text-sm text-muted-foreground">
                            {order.status}
                          </span>
                        </div>
                        <div className="mt-1.5 text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {order.community_name} / {order.block_name}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-base font-bold text-primary">
                          INR {Math.round(Number(order.total))}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t px-4 pb-4 pt-3">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="pb-1.5">Item</th>
                              <th className="pb-1.5 text-center">Qty</th>
                              <th className="pb-1.5 text-right">Amt</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orderItems.map((it) => (
                              <tr key={it.id} className="border-b border-dashed">
                                <td className="py-1.5">{it.product_name}</td>
                                <td className="py-1.5 text-center">
                                  {it.quantity} {it.unit}
                                </td>
                                <td className="py-1.5 text-right">
                                  INR {Math.round(Number(it.price) * Number(it.quantity))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="mt-2 flex justify-between border-t pt-2 text-sm font-bold">
                          <span>Total</span>
                          <span className="text-primary">
                            INR {Math.round(Number(order.total))}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </header>
  );
}
