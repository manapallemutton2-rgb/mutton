import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Printer,
  Receipt,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  TrendingUp,
  Users,
  IndianRupee,
  Power,
  PowerOff,
  Bluetooth,
  ShoppingCart,
  Megaphone,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { getPhone, getRole } from "@/lib/session";
import { isPrinterConnected, printReceipt as btPrintReceipt, ReceiptData } from "@/lib/bt-printer";
import {
  adminUpdateProduct,
  adminDeleteProduct,
  adminInsertProduct,
  adminUpdateSettings,
  adminInsertCommunity,
  adminDeleteCommunity,
  adminInsertBlock,
  adminDeleteBlock,
  adminRemoveProductImage,
} from "@/lib/admin-operations.server";
import { adminUploadImage } from "@/lib/upload-image.server";

type Product = {
  id: string;
  name: string;
  unit: string;
  price: number;
  active: boolean;
  image_url?: string | null;
  stock?: number | null;
};
type Community = { id: string; name: string };
type Block = { id: string; community_id: string; name: string };
type Order = {
  id: string;
  order_number: string;
  phone: string;
  customer_name: string;
  flat_no: string;
  alt_phone: string | null;
  packing_note: string | null;
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

const ORDERS_PER_PAGE = 50;

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Admin - Manapalle Mutton" }] }),
});

type Tab = "stats" | "orders" | "products" | "communities" | "settings";

function AdminPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("orders");
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const p = getPhone();
    const role = getRole();
    if (!p || role !== "admin") {
      navigate({ to: "/login" });
    } else {
      setAuthed(true);
    }
  }, [navigate]);

  if (!authed) return null;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Admin" />
      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        <div className="no-print mb-5 flex gap-2 overflow-x-auto border-b">
          {(["stats", "orders", "products", "communities", "settings"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap px-5 py-3 text-base font-medium capitalize transition ${
                tab === t
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {tab === "stats" && <StatsTab />}
        {tab === "orders" && <OrdersTab />}
        {tab === "products" && <ProductsTab />}
        {tab === "communities" && <CommunitiesTab />}
        {tab === "settings" && <SettingsTab />}
      </main>
    </div>
  );
}

/* ---------------- Stats ---------------- */
function StatsTab() {
  const { data: allOrders = [], isLoading: loadingOrders } = useQuery<Order[]>({
    queryKey: ["admin", "orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Failed to load orders:", error);
        return [];
      }
      return (data as Order[]) || [];
    },
    staleTime: 60_000,
  });

  const { data: products = [], isLoading: loadingProducts } = useQuery<Product[]>({
    queryKey: ["admin", "products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, unit, price, image_url, active, created_at, stock")
        .order("name");
      if (error) {
        console.error("Failed to load products:", error);
        return [];
      }
      return (data as Product[]) || [];
    },
    staleTime: 300_000,
  });

  if (loadingOrders || loadingProducts)
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
            <div className="h-4 w-1/3 rounded bg-muted" />
            <div className="mt-2 h-3 w-1/2 rounded bg-muted" />
          </div>
        ))}
      </div>
    );

  // Overall stats
  const totalOrders = allOrders.length;
  const totalRevenue = allOrders.reduce((s, o) => s + Number(o.total), 0);
  const uniqueCustomers = new Set(allOrders.map((o) => o.phone)).size;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Per community stats
  const communityMap = new Map<string, Order[]>();
  allOrders.forEach((o) => {
    const existing = communityMap.get(o.community_name) || [];
    existing.push(o);
    communityMap.set(o.community_name, existing);
  });

  const communityStats = Array.from(communityMap.entries())
    .map(([name, orders]) => ({
      name,
      orders: orders.length,
      revenue: orders.reduce((s, o) => s + Number(o.total), 0),
      customers: new Set(orders.map((o) => o.phone)).size,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // Per block stats (across all communities)
  const blockMap = new Map<string, Order[]>();
  allOrders.forEach((o) => {
    const key = `${o.community_name} / ${o.block_name}`;
    const existing = blockMap.get(key) || [];
    existing.push(o);
    blockMap.set(key, existing);
  });

  const blockStats = Array.from(blockMap.entries())
    .map(([name, orders]) => ({
      name,
      orders: orders.length,
      revenue: orders.reduce((s, o) => s + Number(o.total), 0),
      customers: new Set(orders.map((o) => o.phone)).size,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // Today's stats
  const today = new Date().toDateString();
  const todayOrders = allOrders.filter((o) => new Date(o.created_at).toDateString() === today);
  const todayRevenue = todayOrders.reduce((s, o) => s + Number(o.total), 0);

  return (
    <div className="space-y-6">
      {/* Overall Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 text-base text-muted-foreground">
            <BarChart3 className="h-5 w-5" /> Total Orders
          </div>
          <div className="mt-2 text-3xl font-bold">{totalOrders}</div>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 text-base text-muted-foreground">
            <IndianRupee className="h-5 w-5" /> Total Revenue
          </div>
          <div className="mt-2 text-3xl font-bold">INR {totalRevenue.toFixed(0)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 text-base text-muted-foreground">
            <Users className="h-5 w-5" /> Customers
          </div>
          <div className="mt-2 text-3xl font-bold">{uniqueCustomers}</div>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 text-base text-muted-foreground">
            <TrendingUp className="h-5 w-5" /> Avg Order
          </div>
          <div className="mt-2 text-3xl font-bold">INR {avgOrderValue.toFixed(0)}</div>
        </div>
      </div>

      {/* Today */}
      <div className="rounded-xl border bg-card p-6">
        <h3 className="mb-3 text-lg font-semibold">Today's Summary</h3>
        <div className="flex flex-wrap gap-4 text-base sm:gap-8">
          <span className="font-medium">{todayOrders.length} orders</span>
          <span className="font-bold text-primary">INR {todayRevenue.toFixed(0)} revenue</span>
        </div>
      </div>

      {/* Community Stats */}
      <div className="rounded-xl border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">By Community</h3>
        {communityStats.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="p-2">Community</th>
                  <th className="p-2 text-right">Orders</th>
                  <th className="p-2 text-right">Customers</th>
                  <th className="p-2 text-right">Revenue</th>
                  <th className="p-2 text-right">Avg Order</th>
                </tr>
              </thead>
              <tbody>
                {communityStats.map((c) => (
                  <tr key={c.name} className="border-t">
                    <td className="p-2 font-medium">{c.name}</td>
                    <td className="p-2 text-right">{c.orders}</td>
                    <td className="p-2 text-right">{c.customers}</td>
                    <td className="p-2 text-right font-medium">INR {c.revenue.toFixed(0)}</td>
                    <td className="p-2 text-right">INR {(c.revenue / c.orders).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Block Stats */}
      <div className="rounded-xl border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">By Block</h3>
        {blockStats.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="p-2">Community / Block</th>
                  <th className="p-2 text-right">Orders</th>
                  <th className="p-2 text-right">Customers</th>
                  <th className="p-2 text-right">Revenue</th>
                  <th className="p-2 text-right">Avg Order</th>
                </tr>
              </thead>
              <tbody>
                {blockStats.map((b) => (
                  <tr key={b.name} className="border-t">
                    <td className="p-2 font-medium">{b.name}</td>
                    <td className="p-2 text-right">{b.orders}</td>
                    <td className="p-2 text-right">{b.customers}</td>
                    <td className="p-2 text-right font-medium">INR {b.revenue.toFixed(0)}</td>
                    <td className="p-2 text-right">INR {(b.revenue / b.orders).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Product Stats */}
      <div className="rounded-xl border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">Products</h3>
        <div className="flex gap-4 text-base">
          <span>{products.length} total</span>
          <span>{products.filter((p) => p.active).length} active</span>
          <span>{products.filter((p) => !p.active).length} inactive</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Orders ---------------- */
type PrintMode = "a4" | "thermal";
type PrintScope =
  | { kind: "community"; communityName: string }
  | { kind: "block"; communityName: string; blockName: string }
  | { kind: "order"; orderNumber: string }
  | null;

function OrdersTab() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string>("");
  const [printMode, setPrintMode] = useState<PrintMode>("a4");
  const [printScope, setPrintScope] = useState<PrintScope>(null);
  const [page, setPage] = useState(0);
  const [newOrderAlert, setNewOrderAlert] = useState<Order | null>(null);
  const { data: settings = {} } = useQuery<Record<string, string>>({
    queryKey: ["admin", "orders-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*");
      if (error) return {};
      const map: Record<string, string> = {};
      (data || []).forEach((s) => {
        map[s.key] = s.value;
      });
      return map;
    },
    staleTime: 30_000,
  });

  const ordersOpen = settings.orders_open !== "false";
  const isMaintenance = settings.maintenance_mode === "true";

  const toggleOrdersOpen = async () => {
    const newValue = ordersOpen ? "false" : "true";
    await adminUpdateSettings({ data: { key: "orders_open", value: newValue } });
    queryClient.invalidateQueries({ queryKey: ["admin", "orders-settings"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
  };

  const toggleMaintenance = async () => {
    const newValue = isMaintenance ? "false" : "true";
    await adminUpdateSettings({ data: { key: "maintenance_mode", value: newValue } });
    queryClient.invalidateQueries({ queryKey: ["admin", "orders-settings"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
  };

  const { data: communities = [], isLoading: loadingCommunities } = useQuery<Community[]>({
    queryKey: ["admin", "communities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("communities").select("*").order("name");
      if (error) {
        console.error("Failed to load communities:", error);
        return [];
      }
      return (data as Community[]) || [];
    },
    staleTime: 60_000,
  });

  const { data: allOrders = [], isLoading: loadingOrders } = useQuery<Order[]>({
    queryKey: ["admin", "orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Failed to load orders:", error);
        return [];
      }
      return (data as Order[]) || [];
    },
    staleTime: 30_000,
  });

  const { data: items = [], isLoading: loadingItems } = useQuery<OrderItem[]>({
    queryKey: ["admin", "order_items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("order_items").select("*");
      if (error) {
        console.error("Failed to load order items:", error);
        return [];
      }
      return (data as OrderItem[]) || [];
    },
    staleTime: 30_000,
  });

  // Buzzer sound for new orders — try Web Audio API, fallback to HTMLAudioElement
  const audioCtxRef = useRef<AudioContext | null>(null);
  const buzzerBufferRef = useRef<AudioBuffer | null>(null);
  const fallbackAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const initAudio = async () => {
      try {
        const resp = await fetch("/buzzer.mp3");
        const buf = await resp.arrayBuffer();
        const ACtor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (ACtor) {
          const ctx = new ACtor();
          audioCtxRef.current = ctx;
          ctx
            .decodeAudioData(buf)
            .then((audioBuf) => {
              buzzerBufferRef.current = audioBuf;
            })
            .catch(() => {});
        }
        const fallback = new Audio();
        fallback.src = URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
        fallback.load();
        fallbackAudioRef.current = fallback;
      } catch {
        const fallback = new Audio("/buzzer.mp3");
        fallback.load();
        fallbackAudioRef.current = fallback;
      }
    };
    initAudio();
    // Keep AudioContext unlocked on any user interaction
    const unlock = () => {
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    };
    document.addEventListener("click", unlock);
    document.addEventListener("touchstart", unlock);
    return () => {
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
    };
  }, []);

  const playBuzzer = useCallback(() => {
    const ctx = audioCtxRef.current;
    const buf = buzzerBufferRef.current;
    if (ctx && buf && ctx.state !== "closed") {
      if (ctx.state === "suspended") {
        ctx.resume();
        return;
      }
      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.connect(ctx.destination);
      source.start(0);
      return;
    }
    const fb = fallbackAudioRef.current;
    if (fb) {
      fb.currentTime = 0;
      fb.play().catch(() => {});
    }
    if (navigator.vibrate) navigator.vibrate(200);
  }, []);

  // Real-time listener for new orders
  useEffect(() => {
    const channel = supabase
      .channel("orders-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
        const newOrder = payload.new as Order;
        playBuzzer();
        setNewOrderAlert(newOrder);
        setTimeout(() => setNewOrderAlert(null), 5000);
        queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "order_items"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, playBuzzer]);

  const isLoading = loadingCommunities || loadingOrders || loadingItems;

  const doPrint = useCallback((mode: PrintMode, scope: PrintScope) => {
    setPrintMode(mode);
    setPrintScope(scope);
    if (mode === "thermal") document.body.classList.add("printing-thermal");
    setTimeout(() => {
      window.scrollTo(0, 0);
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          document.body.classList.remove("printing-thermal");
          setPrintScope(null);
        }, 500);
      }, 200);
    }, 300);
  }, []);

  const doBtPrint = useCallback(
    async (order: Order) => {
      const orderItems = items.filter((i) => i.order_id === order.id);
      const receipt: ReceiptData = {
        orderNumber: order.order_number,
        customerName: order.customer_name,
        flatNo: order.flat_no,
        phone: order.phone,
        altPhone: order.alt_phone,
        communityName: order.community_name,
        blockName: order.block_name,
        packingNote: order.packing_note,
        items: orderItems.map((it) => ({
          name: it.product_name,
          unit: it.unit,
          price: it.price,
          quantity: it.quantity,
        })),
        total: order.total,
        date: new Date(order.created_at).toLocaleString(),
      };
      const ok = await btPrintReceipt(receipt);
      if (!ok) alert("Print failed. Check printer connection.");
    },
    [items],
  );

  if (isLoading)
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
            <div className="h-4 w-1/3 rounded bg-muted" />
            <div className="mt-2 h-3 w-1/4 rounded bg-muted" />
          </div>
        ))}
      </div>
    );

  const selectedCommunity = communities.find((c) => c.id === selected);
  const communityOrders = selectedCommunity
    ? allOrders.filter((o) => o.community_name === selectedCommunity.name)
    : [];
  const blocks = Array.from(new Set(communityOrders.map((o) => o.block_name))).sort();

  const totalPages = Math.ceil(allOrders.length / ORDERS_PER_PAGE);
  const paginatedOrders = allOrders.slice(page * ORDERS_PER_PAGE, (page + 1) * ORDERS_PER_PAGE);

  let printOrders: Order[] = [];
  let printTitle = "";
  if (printScope?.kind === "community") {
    printOrders = allOrders.filter((o) => o.community_name === printScope.communityName);
    printTitle = printScope.communityName;
  } else if (printScope?.kind === "block") {
    printOrders = allOrders.filter(
      (o) => o.community_name === printScope.communityName && o.block_name === printScope.blockName,
    );
    printTitle = `${printScope.communityName} - Block ${printScope.blockName}`;
  } else if (printScope?.kind === "order") {
    printOrders = allOrders.filter((o) => o.order_number === printScope.orderNumber);
    printTitle = "Single Order";
  }

  return (
    <div>
      {/* New Order Alert Banner */}
      {newOrderAlert && (
        <div className="no-print mb-4 animate-pulse rounded-lg border-2 border-green-500 bg-green-50 p-4 dark:bg-green-950">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-green-700 dark:text-green-300">
                NEW ORDER RECEIVED!
              </h3>
              <p className="text-sm text-green-600 dark:text-green-400">
                {newOrderAlert.customer_name} - Flat {newOrderAlert.flat_no},{" "}
                {newOrderAlert.community_name} / {newOrderAlert.block_name}
              </p>
              <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                INR {Number(newOrderAlert.total).toFixed(0)} | {newOrderAlert.phone}
              </p>
              {newOrderAlert.packing_note && (
                <p className="mt-1 text-xs text-yellow-700">Note: {newOrderAlert.packing_note}</p>
              )}
            </div>
            <button
              onClick={() => setNewOrderAlert(null)}
              className="rounded bg-green-200 px-3 py-1 text-sm font-medium text-green-800 hover:bg-green-300"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="no-print mb-5 grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        {communities.map((c) => {
          const count = allOrders.filter((o) => o.community_name === c.name).length;
          return (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={`rounded-xl border bg-card p-5 text-left transition hover:shadow-md ${
                selected === c.id ? "ring-2 ring-primary" : ""
              }`}
            >
              <div className="text-base text-muted-foreground">Community</div>
              <div className="text-xl font-bold">{c.name}</div>
              <div className="mt-2 text-base font-semibold text-primary">{count} orders</div>
            </button>
          );
        })}
      </div>

      {selectedCommunity && (
        <div className="no-print mb-6 rounded-lg border bg-card p-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">{selectedCommunity.name}</h2>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() =>
                  doPrint("a4", { kind: "community", communityName: selectedCommunity.name })
                }
                className="flex items-center justify-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
              >
                <Printer className="h-4 w-4" /> A4
              </button>
              <button
                onClick={() =>
                  doPrint("thermal", { kind: "community", communityName: selectedCommunity.name })
                }
                className="flex items-center justify-center gap-1 rounded-md bg-secondary px-3 py-2 text-sm font-medium"
              >
                <Receipt className="h-4 w-4" /> Thermal (80mm)
              </button>
            </div>
          </div>

          {blocks.length === 0 && (
            <p className="text-sm text-muted-foreground">No orders in this community yet.</p>
          )}

          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
            {blocks.map((blockName) => {
              const bOrders = communityOrders.filter((o) => o.block_name === blockName);
              return (
                <div
                  key={blockName}
                  className="flex items-center justify-between rounded-md border bg-background p-3"
                >
                  <div>
                    <div className="font-semibold">Block {blockName}</div>
                    <div className="text-xs text-muted-foreground">{bOrders.length} orders</div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() =>
                        doPrint("a4", {
                          kind: "block",
                          communityName: selectedCommunity.name,
                          blockName,
                        })
                      }
                      className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground"
                    >
                      A4
                    </button>
                    <button
                      onClick={() =>
                        doPrint("thermal", {
                          kind: "block",
                          communityName: selectedCommunity.name,
                          blockName,
                        })
                      }
                      className="rounded bg-secondary px-2 py-1 text-xs"
                    >
                      Thermal
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!selected && (
        <div className="no-print rounded-lg border bg-card p-6 text-center text-muted-foreground">
          Select a community above to view and print its orders (grouped by block).
        </div>
      )}

      {printScope && printMode === "a4" && (
        <PrintSheet title={printTitle} orders={printOrders} items={items} />
      )}
      {printScope && printMode === "thermal" && (
        <ThermalSheet
          title={printTitle}
          orders={printOrders}
          items={items}
          groupByBlock={printScope.kind === "community"}
        />
      )}

      {/* Toggle switches */}
      <div className="no-print mb-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-3">
          <div className="flex items-center gap-2">
            {ordersOpen ? (
              <ShoppingCart className="h-5 w-5 text-green-500" />
            ) : (
              <ShoppingCart className="h-5 w-5 text-red-500" />
            )}
            <span className="text-base font-semibold">Accept Orders</span>
          </div>
          <button
            onClick={toggleOrdersOpen}
            className={`relative h-8 w-14 rounded-full transition-colors ${
              ordersOpen ? "bg-green-500" : "bg-red-500"
            }`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                ordersOpen ? "left-1" : "left-7"
              }`}
            />
          </button>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-3">
          <div className="flex items-center gap-2">
            {!isMaintenance ? (
              <Power className="h-5 w-5 text-green-500" />
            ) : (
              <PowerOff className="h-5 w-5 text-red-500" />
            )}
            <span className="text-base font-semibold">Maintenance</span>
          </div>
          <button
            onClick={toggleMaintenance}
            className={`relative h-8 w-14 rounded-full transition-colors ${
              !isMaintenance ? "bg-green-500" : "bg-red-500"
            }`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                !isMaintenance ? "left-1" : "left-7"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="no-print mt-8">
        <div className="no-print mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">
            All recent orders ({allOrders.length} total)
          </h3>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded border px-2 py-1 text-xs disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="rounded border px-2 py-1 text-xs disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Mobile: card view */}
        <div className="space-y-4 md:hidden">
          {paginatedOrders.map((o) => (
            <div key={o.id} className="rounded-xl border bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono font-bold text-primary text-lg">{o.order_number}</span>
                  <span className="ml-3 text-sm text-muted-foreground">
                    {new Date(o.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isPrinterConnected() && (
                    <button
                      onClick={() => doBtPrint(o)}
                      className="flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-2 text-sm text-white"
                    >
                      <Bluetooth className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() =>
                      doPrint("thermal", { kind: "order", orderNumber: o.order_number })
                    }
                    className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-sm"
                  >
                    <Receipt className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 text-base font-medium">{o.customer_name || "-"}</div>
              <div className="text-sm text-muted-foreground">
                Flat {o.flat_no || "-"} | {o.phone}
              </div>
              <div className="text-sm text-muted-foreground">
                {o.community_name} / {o.block_name}
              </div>
              {o.alt_phone && (
                <div className="text-sm text-muted-foreground">Alt: {o.alt_phone}</div>
              )}
              {o.packing_note && (
                <div className="mt-2 rounded-lg bg-yellow-50 px-3 py-2 text-sm">
                  Note: {o.packing_note}
                </div>
              )}
              <div className="mt-3 flex justify-between border-t pt-3 font-bold text-base">
                <span>Total</span>
                <span className="text-primary text-lg">INR {Number(o.total).toFixed(0)}</span>
              </div>
            </div>
          ))}
          {allOrders.length === 0 && (
            <div className="rounded-lg border bg-card p-4 text-center text-muted-foreground">
              No orders yet
            </div>
          )}
        </div>

        {/* Desktop: table view */}
        <div className="no-print hidden overflow-x-auto rounded-xl border bg-card md:block">
          <table className="w-full text-base">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-3">Order ID</th>
                <th className="p-3">When</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Flat</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Alt Phone</th>
                <th className="p-3">Community</th>
                <th className="p-3">Block</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.map((o) => (
                <tr key={o.id} className="border-t">
                  <td className="p-3 font-mono font-bold">{o.order_number}</td>
                  <td className="p-3">{new Date(o.created_at).toLocaleString()}</td>
                  <td className="p-3 font-medium">{o.customer_name || "-"}</td>
                  <td className="p-3">{o.flat_no || "-"}</td>
                  <td className="p-3">{o.phone}</td>
                  <td className="p-3">{o.alt_phone || "-"}</td>
                  <td className="p-3">{o.community_name}</td>
                  <td className="p-3">{o.block_name}</td>
                  <td className="p-3 text-right font-semibold">INR {Number(o.total).toFixed(0)}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      {isPrinterConnected() && (
                        <button
                          onClick={() => doBtPrint(o)}
                          className="flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-2 text-sm text-white"
                        >
                          <Bluetooth className="h-4 w-4" /> BT
                        </button>
                      )}
                      <button
                        onClick={() =>
                          doPrint("thermal", { kind: "order", orderNumber: o.order_number })
                        }
                        className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-sm"
                      >
                        <Receipt className="h-4 w-4" /> Thermal
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {allOrders.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-5 text-center text-muted-foreground text-base">
                    No orders yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PrintSheet({
  title,
  orders,
  items,
}: {
  title: string;
  orders: Order[];
  items: OrderItem[];
}) {
  const blocks = Array.from(new Set(orders.map((o) => o.block_name))).sort();
  const grandTotal = orders.reduce((s, o) => s + Number(o.total), 0);

  return (
    <div className="print-page a4-only rounded-lg border bg-white p-6 text-black">
      <div className="mb-4 flex items-center gap-3 border-b-2 border-black pb-3">
        <img src="/MM.jpeg" alt="Logo" className="h-14 w-14 object-contain" />
        <div>
          <h1 className="text-2xl font-bold leading-tight">
            Manapalle
            <span className="block text-base font-medium opacity-80">Mutton & Chicken</span>
          </h1>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-gray-600">Printed: {new Date().toLocaleString()}</p>
        </div>
      </div>

      {blocks.length === 0 && <p>No orders.</p>}

      {blocks.map((blockName) => {
        const blockOrders = orders.filter((o) => o.block_name === blockName);
        const blockTotal = blockOrders.reduce((s, o) => s + Number(o.total), 0);
        return (
          <div key={blockName} className="mb-6">
            <h2 className="mb-2 border-b-2 border-black bg-gray-100 px-3 py-1 text-base font-bold">
              Block: {blockName} ({blockOrders.length} orders)
            </h2>
            {blockOrders.map((o) => {
              const oItems = items.filter((i) => i.order_id === o.id);
              return (
                <div key={o.id} className="mb-3 border border-gray-400 p-3 text-sm">
                  <div className="flex justify-between border-b border-gray-300 pb-1 font-semibold">
                    <span>
                      {o.order_number} &mdash; <b>{o.customer_name}</b>, Flat {o.flat_no || "-"}
                    </span>
                    <span className="text-gray-600">
                      {o.phone} {o.alt_phone ? `/ ${o.alt_phone}` : ""}
                    </span>
                  </div>
                  {o.packing_note && (
                    <div className="mt-1 rounded bg-yellow-50 px-2 py-1 text-xs font-semibold text-yellow-800 border border-yellow-300">
                      Note: {o.packing_note}
                    </div>
                  )}
                  <table className="mt-2 w-full border-collapse">
                    <thead>
                      <tr className="border-b border-gray-300 text-xs text-gray-600">
                        <th className="py-1 text-left">Item</th>
                        <th className="py-1 text-center">Qty</th>
                        <th className="py-1 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {oItems.map((it) => (
                        <tr key={it.id} className="border-b border-gray-100">
                          <td className="py-1">{it.product_name}</td>
                          <td className="py-1 text-center">
                            {it.quantity} {it.unit}
                          </td>
                          <td className="py-1 text-right">
                            INR {(Number(it.price) * Number(it.quantity)).toFixed(0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-1 flex justify-between border-t-2 border-black pt-1 font-bold">
                    <span>Order Total</span>
                    <span>INR {Number(o.total).toFixed(0)}</span>
                  </div>
                </div>
              );
            })}
            <div className="flex justify-between border-t-2 border-black bg-gray-100 px-3 py-1 text-sm font-bold">
              <span>Block {blockName} Subtotal</span>
              <span>INR {blockTotal.toFixed(0)}</span>
            </div>
          </div>
        );
      })}
      <div className="flex justify-between border-t-4 border-double border-black px-3 py-2 text-lg font-bold">
        <span>GRAND TOTAL ({orders.length} orders)</span>
        <span>INR {grandTotal.toFixed(0)}</span>
      </div>
    </div>
  );
}

function ThermalSheet({
  title,
  orders,
  items,
  groupByBlock,
}: {
  title: string;
  orders: Order[];
  items: OrderItem[];
  groupByBlock: boolean;
}) {
  const blocks = groupByBlock
    ? Array.from(new Set(orders.map((o) => o.block_name))).sort()
    : [null];

  return (
    <div className="thermal-only">
      {blocks.map((blockName) => {
        const bOrders = blockName ? orders.filter((o) => o.block_name === blockName) : orders;
        const bTotal = bOrders.reduce((s, o) => s + Number(o.total), 0);
        return (
          <div key={blockName ?? "all"} className="thermal-page">
            <div className="thermal-receipt">
              <div style={{ textAlign: "center" }}>
                <img src="/MM.jpeg" alt="Logo" style={{ height: 48, margin: "0 auto" }} />
              </div>
              <h1 style={{ textAlign: "center", fontSize: 16, letterSpacing: 1 }}>
                MANAPALLE MUTTON
              </h1>
              <div style={{ textAlign: "center", fontSize: 10, marginBottom: "2mm" }}>
                {new Date().toLocaleString()}
              </div>
              <div className="divider-solid" />
              <div style={{ textAlign: "center", fontWeight: 800, fontSize: 13 }}>{title}</div>
              {blockName && (
                <div style={{ textAlign: "center", fontWeight: 700 }}>Block: {blockName}</div>
              )}
              <div style={{ fontSize: 11 }}>Orders: {bOrders.length}</div>
              <div className="divider-solid" />
              {bOrders.map((o) => {
                const oItems = items.filter((i) => i.order_id === o.id);
                return (
                  <div key={o.id} style={{ marginBottom: "3mm" }}>
                    <div
                      className="row"
                      style={{ borderBottom: "1px solid #000", paddingBottom: "1mm" }}
                    >
                      <b style={{ fontSize: 13 }}>{o.customer_name}</b>
                      <b style={{ fontSize: 12 }}>{o.order_number}</b>
                    </div>
                    <div style={{ fontSize: 11 }}>
                      Flat: {o.flat_no || "-"} | {o.phone}
                    </div>
                    {o.alt_phone && <div style={{ fontSize: 11 }}>Alt: {o.alt_phone}</div>}
                    {o.packing_note && (
                      <div style={{ fontSize: 11, fontWeight: 800, marginTop: "1mm" }}>
                        Note: {o.packing_note}
                      </div>
                    )}
                    <table style={{ marginTop: "1mm" }}>
                      <tbody>
                        {oItems.map((it) => (
                          <tr key={it.id}>
                            <td style={{ fontSize: 11 }}>{it.product_name}</td>
                            <td style={{ textAlign: "center", fontSize: 11 }}>
                              {it.quantity}
                              {it.unit}
                            </td>
                            <td style={{ textAlign: "right", fontSize: 11 }}>
                              INR {(Number(it.price) * Number(it.quantity)).toFixed(0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div
                      className="row"
                      style={{
                        borderTop: "1px dashed #000",
                        marginTop: "1mm",
                        paddingTop: "1mm",
                        fontWeight: 800,
                      }}
                    >
                      <span>Total</span>
                      <span>INR {Number(o.total).toFixed(0)}</span>
                    </div>
                    <div className="divider" />
                  </div>
                );
              })}
              <div className="divider-solid" />
              <div className="row" style={{ fontWeight: 800, fontSize: 13 }}>
                <span>{blockName ? `Block ${blockName}` : "GRAND"} TOTAL</span>
                <span>INR {bTotal.toFixed(0)}</span>
              </div>
              <div
                style={{
                  textAlign: "center",
                  marginTop: "3mm",
                  fontSize: 10,
                  borderTop: "1px dashed #000",
                  paddingTop: "1mm",
                }}
              >
                Thank you! Visit again
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Products ---------------- */
function ProductsTab() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("kg");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["admin", "products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, unit, price, image_url, active, created_at, stock")
        .order("name");
      if (error) {
        console.error("Failed to load products:", error);
        return [];
      }
      return (data as Product[]) || [];
    },
    staleTime: 300_000,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      await adminInsertProduct({
        data: {
          name: name.trim(),
          unit,
          price: Number(price),
          stock: stock || null,
          image_url: imageUrl.trim() || null,
        },
      });
    },
    onSuccess: () => {
      setName("");
      setPrice("");
      setStock("");
      setImageUrl("");
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["products", "active"] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (p: Product) => {
      await adminUpdateProduct({ data: { id: p.id, updates: { active: !p.active } } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["products", "active"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (p: Product) => {
      await adminDeleteProduct({ data: { id: p.id } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["products", "active"] });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: {
        name?: string;
        unit?: string;
        price?: number;
        stock?: number | null;
        active?: boolean;
        image_url?: string | null;
      };
    }) => {
      await adminUpdateProduct({ data: { id, updates } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["products", "active"] });
    },
  });

  const updateName = (p: Product, newName: string) => {
    if (newName.trim() && newName.trim() !== p.name) {
      updateProductMutation.mutate({ id: p.id, updates: { name: newName.trim() } });
    }
  };

  const updateUnit = (p: Product, newUnit: string) => {
    if (newUnit !== p.unit) {
      updateProductMutation.mutate({ id: p.id, updates: { unit: newUnit } });
    }
  };

  const updateImageMutation = useMutation({
    mutationFn: async ({ id, image_url }: { id: string; image_url: string | null }) => {
      await adminUpdateProduct({ data: { id, updates: { image_url } } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["products", "active"] });
    },
  });

  const removeImageMutation = useMutation({
    mutationFn: async ({ productId, imageUrl }: { productId: string; imageUrl: string }) => {
      await adminRemoveProductImage({ data: { productId, imageUrl } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["products", "active"] });
    },
  });

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return;
    addMutation.mutate();
  };

  const toggle = (p: Product) => toggleMutation.mutate(p);
  const del = (p: Product) => {
    if (!confirm(`Delete ${p.name}?`)) return;
    deleteMutation.mutate(p);
  };
  const updatePrice = (p: Product, newPrice: string) => {
    const v = Number(newPrice);
    if (!Number.isNaN(v)) updateProductMutation.mutate({ id: p.id, updates: { price: v } });
  };

  const handleFileUpload = async (p: Product, file: File) => {
    try {
      setUploadingId(p.id);
      const ext = file.name.split(".").pop();
      const fileName = `${p.id}_${Date.now()}.${ext}`;

      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      const result = await adminUploadImage({
        data: { fileName, base64, contentType: file.type },
      });

      await updateImageMutation.mutateAsync({ id: p.id, image_url: result.publicUrl });
    } catch (err: unknown) {
      alert("Image upload failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setUploadingId(null);
    }
  };

  if (isLoading)
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
            <div className="flex gap-4">
              <div className="h-4 flex-1 rounded bg-muted" />
              <div className="h-4 w-16 rounded bg-muted" />
              <div className="h-4 w-20 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );

  return (
    <div>
      <form
        onSubmit={add}
        className="mb-5 grid gap-3 rounded-xl border bg-card p-4 sm:p-6 sm:grid-cols-2 md:grid-cols-6"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Product name"
          className="rounded-xl border bg-background px-4 py-4 text-base"
        />
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="rounded-xl border bg-background px-4 py-4 text-base"
        >
          <option value="kg">kg</option>
          <option value="500g">500g</option>
          <option value="dozen">dozen</option>
          <option value="piece">piece</option>
        </select>
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Price (INR)"
          type="number"
          className="rounded-xl border bg-background px-4 py-4 text-base"
        />
        <input
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          placeholder="Stock (empty = unlimited)"
          type="text"
          inputMode="decimal"
          className="rounded-xl border bg-background px-4 py-4 text-base"
        />
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="Image URL (optional)"
          type="url"
          className="rounded-xl border bg-background px-4 py-4 text-base"
        />
        <button
          disabled={addMutation.isPending}
          className="rounded-xl bg-primary py-4 text-base font-medium text-primary-foreground disabled:opacity-50"
        >
          {addMutation.isPending ? "Adding..." : "Add Product"}
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-base">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-3">Image</th>
              <th className="p-3">Name</th>
              <th className="p-3">Unit</th>
              <th className="p-3">Price</th>
              <th className="p-3">Stock</th>
              <th className="p-3">Active</th>
              <th className="p-3">Image Options</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="h-14 w-14 rounded-xl object-cover border shadow-sm"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl border bg-muted text-xs text-muted-foreground">
                      No Image
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <input
                    defaultValue={p.name}
                    onBlur={(e) => updateName(p, e.target.value)}
                    className="w-full min-w-[120px] rounded-xl border bg-background px-3 py-2 text-base"
                  />
                </td>
                <td className="p-3">
                  <select
                    defaultValue={p.unit}
                    onChange={(e) => updateUnit(p, e.target.value)}
                    className="rounded-xl border bg-background px-3 py-2 text-base"
                  >
                    <option value="kg">kg</option>
                    <option value="500g">500g</option>
                    <option value="dozen">dozen</option>
                    <option value="piece">piece</option>
                  </select>
                </td>
                <td className="p-3">
                  <input
                    defaultValue={p.price}
                    onBlur={(e) => updatePrice(p, e.target.value)}
                    type="number"
                    className="w-28 rounded-xl border bg-background px-3 py-2 text-base"
                  />
                </td>
                <td className="p-3">
                  <input
                    defaultValue={p.stock ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v === "" || v === p.stock?.toString()) return;
                      const num = Number(v);
                      if (v !== "" && (isNaN(num) || num < 0)) return;
                      updateProductMutation.mutate({
                        id: p.id,
                        updates: { stock: v === "" ? null : num },
                      });
                    }}
                    placeholder="Unlimited"
                    type="text"
                    inputMode="decimal"
                    className="w-28 rounded-xl border bg-background px-3 py-2 text-base"
                  />
                </td>
                <td className="p-3">
                  <button
                    onClick={() => toggle(p)}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                      p.active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {p.active ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id={`image-upload-${p.id}`}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(p, file);
                      }}
                    />
                    <label
                      htmlFor={`image-upload-${p.id}`}
                      className="cursor-pointer rounded-xl border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      {uploadingId === p.id ? "Uploading..." : "Upload File"}
                    </label>

                    {p.image_url && (
                      <button
                        onClick={() =>
                          removeImageMutation.mutate({ productId: p.id, imageUrl: p.image_url })
                        }
                        disabled={removeImageMutation.isPending}
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        {removeImageMutation.isPending ? "Removing..." : "Remove Image"}
                      </button>
                    )}
                  </div>
                </td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => del(p)}
                    className="text-destructive hover:underline text-sm font-medium px-2 py-2"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Communities & Blocks ---------------- */
function CommunitiesTab() {
  const queryClient = useQueryClient();
  const [newCommunity, setNewCommunity] = useState("");
  const [newBlock, setNewBlock] = useState<Record<string, string>>({});

  const { data: communities = [], isLoading: loadingCommunities } = useQuery<Community[]>({
    queryKey: ["admin", "communities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("communities").select("*").order("name");
      if (error) {
        console.error("Failed to load communities:", error);
        return [];
      }
      return (data as Community[]) || [];
    },
    staleTime: 300_000,
  });

  const { data: blocks = [], isLoading: loadingBlocks } = useQuery<Block[]>({
    queryKey: ["admin", "blocks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("blocks").select("*").order("name");
      if (error) {
        console.error("Failed to load blocks:", error);
        return [];
      }
      return (data as Block[]) || [];
    },
    staleTime: 300_000,
  });

  const addCommunityMutation = useMutation({
    mutationFn: async (name: string) => {
      await adminInsertCommunity({ data: { name } });
    },
    onSuccess: () => {
      setNewCommunity("");
      queryClient.invalidateQueries({ queryKey: ["admin", "communities"] });
    },
  });

  const deleteCommunityMutation = useMutation({
    mutationFn: async (id: string) => {
      await adminDeleteCommunity({ data: { id } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "communities"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "blocks"] });
    },
  });

  const addBlockMutation = useMutation({
    mutationFn: async ({ community_id, name }: { community_id: string; name: string }) => {
      await adminInsertBlock({ data: { community_id, name } });
    },
    onSuccess: () => {
      setNewBlock({});
      queryClient.invalidateQueries({ queryKey: ["admin", "blocks"] });
    },
  });

  const deleteBlockMutation = useMutation({
    mutationFn: async (id: string) => {
      await adminDeleteBlock({ data: { id } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "blocks"] });
    },
  });

  if (loadingCommunities || loadingBlocks)
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
            <div className="h-4 w-1/3 rounded bg-muted" />
            <div className="mt-2 flex gap-2">
              <div className="h-6 w-16 rounded-full bg-muted" />
              <div className="h-6 w-16 rounded-full bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );

  const addCommunity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommunity) return;
    addCommunityMutation.mutate(newCommunity);
  };
  const delCommunity = (c: Community) => {
    if (!confirm(`Delete ${c.name} and its blocks?`)) return;
    deleteCommunityMutation.mutate(c.id);
  };
  const addBlock = (community_id: string) => {
    const name = newBlock[community_id];
    if (!name) return;
    addBlockMutation.mutate({ community_id, name });
  };
  const delBlock = (b: Block) => deleteBlockMutation.mutate(b.id);

  return (
    <div>
      <form
        onSubmit={addCommunity}
        className="mb-5 flex flex-col gap-3 rounded-xl border bg-card p-5 sm:flex-row"
      >
        <input
          value={newCommunity}
          onChange={(e) => setNewCommunity(e.target.value)}
          placeholder="New community name"
          className="flex-1 rounded-xl border bg-background px-4 py-3 text-base"
        />
        <button
          disabled={addCommunityMutation.isPending}
          className="rounded-xl bg-primary px-6 py-3 text-base font-medium text-primary-foreground disabled:opacity-50"
        >
          {addCommunityMutation.isPending ? "Adding..." : "Add Community"}
        </button>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        {communities.map((c) => {
          const bs = blocks.filter((b) => b.community_id === c.id);
          return (
            <div key={c.id} className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{c.name}</h3>
                <button
                  onClick={() => delCommunity(c)}
                  className="text-sm text-destructive font-medium px-3 py-1.5"
                >
                  Delete
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {bs.map((b) => (
                  <span
                    key={b.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-sm"
                  >
                    {b.name}
                    <button onClick={() => delBlock(b)} className="text-destructive font-bold">
                      x
                    </button>
                  </span>
                ))}
                {bs.length === 0 && (
                  <span className="text-sm text-muted-foreground">No blocks yet</span>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <input
                  value={newBlock[c.id] || ""}
                  onChange={(e) => setNewBlock((s) => ({ ...s, [c.id]: e.target.value }))}
                  placeholder="Block name (e.g. A, Tower 1)"
                  className="flex-1 rounded-xl border bg-background px-4 py-3 text-base"
                />
                <button
                  onClick={() => addBlock(c.id)}
                  className="rounded-xl bg-secondary px-5 py-3 text-base font-medium"
                >
                  Add
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Settings ---------------- */
function SettingsTab() {
  const queryClient = useQueryClient();
  const [maintenanceMsg, setMaintenanceMsg] = useState("");
  const [saved, setSaved] = useState(false);
  const [popupSheep, setPopupSheep] = useState("");
  const [popupUsers, setPopupUsers] = useState("");
  const [popupMsg, setPopupMsg] = useState("");
  const [popupSaved, setPopupSaved] = useState(false);

  const { data: settings = {}, isLoading } = useQuery<Record<string, string>>({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*");
      if (error) {
        console.error("Failed to load settings:", error);
        return {};
      }
      const map: Record<string, string> = {};
      (data || []).forEach((s) => {
        map[s.key] = s.value;
      });
      return map;
    },
    staleTime: 60_000,
  });

  const isMaintenance = settings.maintenance_mode === "true";
  const ordersOpen = settings.orders_open !== "false";

  useEffect(() => {
    setMaintenanceMsg(settings.maintenance_message || "");
    setPopupSheep(settings.popup_sheep || "");
    setPopupUsers(settings.popup_users || "");
    setPopupMsg(settings.popup_message || "Grab it faster!");
  }, [
    settings.maintenance_message,
    settings.popup_sheep,
    settings.popup_users,
    settings.popup_message,
  ]);

  const toggleMaintenance = async () => {
    const newValue = isMaintenance ? "false" : "true";
    await adminUpdateSettings({ data: { key: "maintenance_mode", value: newValue } });
    queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
  };

  const toggleOrdersOpen = async () => {
    const newValue = ordersOpen ? "false" : "true";
    await adminUpdateSettings({ data: { key: "orders_open", value: newValue } });
    queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
  };

  const saveMessage = async () => {
    await adminUpdateSettings({ data: { key: "maintenance_message", value: maintenanceMsg } });
    queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const savePopup = async () => {
    await adminUpdateSettings({ data: { key: "popup_sheep", value: popupSheep } });
    await adminUpdateSettings({ data: { key: "popup_users", value: popupUsers } });
    await adminUpdateSettings({
      data: { key: "popup_message", value: popupMsg || "Grab it faster!" },
    });
    queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
    setPopupSaved(true);
    setTimeout(() => setPopupSaved(false), 2000);
  };

  if (isLoading)
    return (
      <div className="animate-pulse rounded-lg border bg-card p-4">
        <div className="h-4 w-1/3 rounded bg-muted" />
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Accept Orders */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-xl font-semibold">
              {ordersOpen ? (
                <ShoppingCart className="h-6 w-6 text-green-500" />
              ) : (
                <ShoppingCart className="h-6 w-6 text-red-500" />
              )}
              Accept Orders
            </h3>
            <p className="mt-2 text-base text-muted-foreground">
              {ordersOpen
                ? "Orders are OPEN. Users can place orders."
                : "Orders are CLOSED. Users cannot place orders."}
            </p>
          </div>
          <button
            onClick={toggleOrdersOpen}
            className={`relative h-10 w-16 rounded-full transition-colors ${
              ordersOpen ? "bg-green-500" : "bg-red-500"
            }`}
          >
            <span
              className={`absolute top-1.5 h-7 w-7 rounded-full bg-white shadow transition-transform ${
                ordersOpen ? "left-1.5" : "left-8"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Maintenance Mode */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-xl font-semibold">
              {!isMaintenance ? (
                <Power className="h-6 w-6 text-green-500" />
              ) : (
                <PowerOff className="h-6 w-6 text-red-500" />
              )}
              Maintenance Mode
            </h3>
            <p className="mt-2 text-base text-muted-foreground">
              {!isMaintenance
                ? "App is LIVE. Users can access the site."
                : "App is DOWN. Users see a maintenance screen."}
            </p>
          </div>
          <button
            onClick={toggleMaintenance}
            className={`relative h-10 w-16 rounded-full transition-colors ${
              !isMaintenance ? "bg-green-500" : "bg-red-500"
            }`}
          >
            <span
              className={`absolute top-1.5 h-7 w-7 rounded-full bg-white shadow transition-transform ${
                !isMaintenance ? "left-1.5" : "left-8"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Login Popup Message */}
      <div className="rounded-xl border bg-card p-6">
        <h3 className="mb-4 flex items-center gap-2 text-xl font-semibold">
          <Megaphone className="h-6 w-6 text-primary" />
          Login Popup
        </h3>
        <p className="mb-4 text-base text-muted-foreground">
          This message appears as a popup when customers log in.
        </p>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">No of Sheeps</label>
            <input
              value={popupSheep}
              onChange={(e) => setPopupSheep(e.target.value)}
              placeholder="e.g. 50 sheeps available"
              type="text"
              className="w-full rounded-xl border bg-background px-4 py-3 text-base"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Active Users</label>
            <input
              value={popupUsers}
              onChange={(e) => setPopupUsers(e.target.value)}
              placeholder="e.g. 12 active users"
              type="text"
              className="w-full rounded-xl border bg-background px-4 py-3 text-base"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Popup Message</label>
            <input
              value={popupMsg}
              onChange={(e) => setPopupMsg(e.target.value)}
              placeholder="Grab it faster!"
              type="text"
              className="w-full rounded-xl border bg-background px-4 py-3 text-base"
            />
          </div>
          <button
            onClick={savePopup}
            className="rounded-xl bg-primary px-6 py-3 text-base font-medium text-primary-foreground hover:opacity-90"
          >
            {popupSaved ? "Saved!" : "Save Popup"}
          </button>
        </div>
      </div>

      {/* Maintenance Mode */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-xl font-semibold">
              {isMaintenance ? (
                <PowerOff className="h-6 w-6 text-red-500" />
              ) : (
                <Power className="h-6 w-6 text-green-500" />
              )}
              Maintenance Mode
            </h3>
            <p className="mt-2 text-base text-muted-foreground">
              {isMaintenance
                ? "Website is OFFLINE. Users see maintenance message."
                : "Website is LIVE. All users can access."}
            </p>
          </div>
          <button
            onClick={toggleMaintenance}
            className={`relative h-10 w-16 rounded-full transition-colors ${
              isMaintenance ? "bg-red-500" : "bg-green-500"
            }`}
          >
            <span
              className={`absolute top-1.5 h-7 w-7 rounded-full bg-white shadow transition-transform ${
                isMaintenance ? "left-8" : "left-1.5"
              }`}
            />
          </button>
        </div>

        <div className="mt-6">
          <label className="block text-base font-medium">Maintenance Message</label>
          <textarea
            value={maintenanceMsg}
            onChange={(e) => setMaintenanceMsg(e.target.value)}
            className="mt-2 w-full rounded-xl border bg-background px-4 py-3 text-base"
            rows={3}
            placeholder="Message users will see when site is down..."
          />
          <button
            onClick={saveMessage}
            className="mt-3 rounded-xl bg-primary px-6 py-3 text-base font-medium text-primary-foreground hover:opacity-90"
          >
            {saved ? "Saved!" : "Save Message"}
          </button>
        </div>
      </div>

      {/* Quick Info */}
      <div className="rounded-xl border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">Quick Info</h3>
        <div className="space-y-3 text-base">
          <p>
            <b>Supabase URL:</b> {import.meta.env.VITE_SUPABASE_URL || "Not set"}
          </p>
          <p>
            <b>Project ID:</b> uivgrgcucfmgktbwjqhg
          </p>
        </div>
      </div>
    </div>
  );
}
