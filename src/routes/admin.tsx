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
  Trash2,
  Download,
  Package,
  ArrowUpDown,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { getPhone, getRole } from "@/lib/session";
import { isPrinterConnected, printReceipt as btPrintReceipt, printMultipleReceipts as btPrintMultiple, ReceiptData } from "@/lib/bt-printer";
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
  adminDeleteOrder,
  adminDeleteAllOrders,
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

type Tab = "stats" | "orders" | "items" | "products" | "communities" | "settings";

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
        <div className="no-print mb-5 flex gap-1 overflow-x-auto border-b sm:gap-2">
          {(["stats", "orders", "items", "products", "communities", "settings"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap px-3 py-2.5 text-sm font-medium capitalize transition sm:px-5 sm:py-3 sm:text-base ${
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
        {tab === "items" && <ItemSalesTab />}
        {tab === "products" && <ProductsTab />}
        {tab === "communities" && <CommunitiesTab />}
        {tab === "settings" && <SettingsTab />}
      </main>
    </div>
  );
}

function unitToKg(unit: string, quantity: number): number {
  if (unit === "1kg") return quantity;
  if (unit === "500g") return quantity * 0.5;
  if (unit === "750g") return quantity * 0.75;
  if (unit === "kg") return quantity;
  if (unit === "piece" || unit === "dozen" || unit === "tray") return 0;
  return quantity;
}

function unitLabel(unit: string): string {
  if (unit === "piece") return "pcs";
  if (unit === "dozen") return "dozen";
  if (unit === "tray") return "tray";
  return "kg";
}

function unitCount(unit: string, quantity: number): number {
  if (unit === "piece") return quantity;
  if (unit === "dozen") return quantity * 12;
  if (unit === "tray") return quantity * 30;
  return 0;
}

const CHART_COLORS = ["#e11d48", "#2563eb", "#16a34a", "#f59e0b", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899"];

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

  if (loadingOrders || loadingItems || loadingProducts)
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
  const totalRevenue = Math.round(allOrders.reduce((s, o) => s + Number(o.total), 0));
  const uniqueCustomers = new Set(allOrders.map((o) => o.phone)).size;
  const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

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
      revenue: Math.round(orders.reduce((s, o) => s + Number(o.total), 0)),
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
      revenue: Math.round(orders.reduce((s, o) => s + Number(o.total), 0)),
      customers: new Set(orders.map((o) => o.phone)).size,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // Today's stats
  const today = new Date().toDateString();
  const todayOrders = allOrders.filter((o) => new Date(o.created_at).toDateString() === today);
  const todayRevenue = Math.round(todayOrders.reduce((s, o) => s + Number(o.total), 0));

  // --- Chart Data ---

  // Daily revenue for last 14 days - split by Mutton / Chicken / Other (Line Chart)
  const dailyRevenueMap = new Map<string, { mutton: number; chicken: number; other: number; mOrders: number; cOrders: number; oOrders: number }>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    dailyRevenueMap.set(key, { mutton: 0, chicken: 0, other: 0, mOrders: 0, cOrders: 0, oOrders: 0 });
  }
  allOrders.forEach((o) => {
    const d = new Date(o.created_at);
    const key = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    const entry = dailyRevenueMap.get(key);
    if (!entry) return;
    const oItems = items.filter((i) => i.order_id === o.id);
    let mTotal = 0, cTotal = 0, oTotal = 0;
    oItems.forEach((it) => {
      const amt = Number(it.price) * Number(it.quantity);
      if (it.product_name.toLowerCase().startsWith("mutton")) mTotal += amt;
      else if (it.product_name.toLowerCase().startsWith("chicken")) cTotal += amt;
      else oTotal += amt;
    });
    if (mTotal > 0) { entry.mutton += mTotal; entry.mOrders += 1; }
    if (cTotal > 0) { entry.chicken += cTotal; entry.cOrders += 1; }
    if (oTotal > 0) { entry.other += oTotal; entry.oOrders += 1; }
  });
  const dailyRevenueData = Array.from(dailyRevenueMap.entries()).map(([date, v]) => ({
    date,
    mutton: Math.round(v.mutton),
    chicken: Math.round(v.chicken),
    other: Math.round(v.other),
  }));

  // Top selling products split by Mutton / Chicken (Bar Chart)
  const muttonProductMap = new Map<string, { name: string; qty: number; revenue: number }>();
  const chickenProductMap = new Map<string, { name: string; qty: number; revenue: number }>();
  items.forEach((it) => {
    const isMutton = it.product_name.toLowerCase().startsWith("mutton");
    const isChicken = it.product_name.toLowerCase().startsWith("chicken");
    if (!isMutton && !isChicken) return;
    const map = isMutton ? muttonProductMap : chickenProductMap;
    const existing = map.get(it.product_name);
    if (existing) {
      existing.qty += it.quantity;
      existing.revenue += it.price * it.quantity;
    } else {
      map.set(it.product_name, { name: it.product_name, qty: it.quantity, revenue: it.price * it.quantity });
    }
  });
  const topMuttonProducts = Array.from(muttonProductMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)
    .map((p) => ({ ...p, revenue: Math.round(p.revenue) }));
  const topChickenProducts = Array.from(chickenProductMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)
    .map((p) => ({ ...p, revenue: Math.round(p.revenue) }));

  // Mutton / Chicken revenue by community
  const muttonByCommunity = new Map<string, number>();
  const chickenByCommunity = new Map<string, number>();
  allOrders.forEach((o) => {
    const oItems = items.filter((i) => i.order_id === o.id);
    oItems.forEach((it) => {
      const amt = Number(it.price) * Number(it.quantity);
      if (it.product_name.toLowerCase().startsWith("mutton")) {
        muttonByCommunity.set(o.community_name, (muttonByCommunity.get(o.community_name) || 0) + amt);
      } else if (it.product_name.toLowerCase().startsWith("chicken")) {
        chickenByCommunity.set(o.community_name, (chickenByCommunity.get(o.community_name) || 0) + amt);
      }
    });
  });
  const allCommunityNames = Array.from(new Set([...muttonByCommunity.keys(), ...chickenByCommunity.keys()]));
  const muttonChickenByCommunity = allCommunityNames.map((name) => ({
    name,
    mutton: Math.round(muttonByCommunity.get(name) || 0),
    chicken: Math.round(chickenByCommunity.get(name) || 0),
  }));

  // Orders by community (Pie Chart)
  const communityPieData = communityStats.map((c) => ({
    name: c.name,
    value: c.revenue,
  }));

  // Mutton / Chicken sold (handle pieces separately)
  const muttonKg = items
    .filter((i) => i.product_name.toLowerCase().startsWith("mutton"))
    .reduce((s, i) => s + unitToKg(i.unit, i.quantity), 0);
  const muttonPcs = items
    .filter((i) => i.product_name.toLowerCase().startsWith("mutton"))
    .reduce((s, i) => s + unitCount(i.unit, i.quantity), 0);
  const chickenKg = items
    .filter((i) => i.product_name.toLowerCase().startsWith("chicken"))
    .reduce((s, i) => s + unitToKg(i.unit, i.quantity), 0);
  const chickenPcs = items
    .filter((i) => i.product_name.toLowerCase().startsWith("chicken"))
    .reduce((s, i) => s + unitCount(i.unit, i.quantity), 0);

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
          <div className="mt-2 text-3xl font-bold">INR {totalRevenue}</div>
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
          <div className="mt-2 text-3xl font-bold">INR {avgOrderValue}</div>
        </div>
      </div>

      {/* Mutton / Chicken sold */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 text-base text-muted-foreground">
            Mutton Sold
          </div>
          <div className="mt-2 text-3xl font-bold text-primary">
            {muttonKg > 0 && (
              <>{muttonKg % 1 === 0 ? muttonKg.toFixed(0) : muttonKg.toFixed(2)} <span className="text-lg font-normal text-muted-foreground">kg</span></>
            )}
            {muttonKg > 0 && muttonPcs > 0 && <span className="mx-2 text-muted-foreground">/</span>}
            {muttonPcs > 0 && (
              <>{muttonPcs} <span className="text-lg font-normal text-muted-foreground">pcs</span></>
            )}
            {muttonKg === 0 && muttonPcs === 0 && <span className="text-lg text-muted-foreground">0</span>}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 text-base text-muted-foreground">
            Chicken Sold
          </div>
          <div className="mt-2 text-3xl font-bold text-primary">
            {chickenKg > 0 && (
              <>{chickenKg % 1 === 0 ? chickenKg.toFixed(0) : chickenKg.toFixed(2)} <span className="text-lg font-normal text-muted-foreground">kg</span></>
            )}
            {chickenKg > 0 && chickenPcs > 0 && <span className="mx-2 text-muted-foreground">/</span>}
            {chickenPcs > 0 && (
              <>{chickenPcs} <span className="text-lg font-normal text-muted-foreground">pcs</span></>
            )}
            {chickenKg === 0 && chickenPcs === 0 && <span className="text-lg text-muted-foreground">0</span>}
          </div>
        </div>
      </div>

      {/* Today */}
      <div className="rounded-xl border bg-card p-4 sm:p-6">
        <h3 className="mb-3 text-base font-semibold sm:text-lg">Today's Summary</h3>
        <div className="flex flex-wrap gap-4 text-base sm:gap-8">
          <span className="font-medium">{todayOrders.length} orders</span>
          <span className="font-bold text-primary">INR {todayRevenue} revenue</span>
        </div>
      </div>

      {/* Line Chart - Daily Revenue by Mutton / Chicken */}
      {dailyRevenueData.length > 0 && (
        <div className="rounded-xl border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">Daily Revenue - Mutton vs Chicken (Last 14 Days)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyRevenueData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb" }}
                />
                <Legend />
                <Line type="monotone" dataKey="mutton" stroke="#e11d48" strokeWidth={2} dot={false} name="Mutton" />
                <Line type="monotone" dataKey="chicken" stroke="#f59e0b" strokeWidth={2} dot={false} name="Chicken" />
                <Line type="monotone" dataKey="other" stroke="#6b7280" strokeWidth={2} dot={false} name="Other" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Bar Charts - Top Products Mutton & Chicken Side by Side */}
      <div className="grid gap-4 lg:grid-cols-2">
        {topMuttonProducts.length > 0 && (
          <div className="rounded-xl border bg-card p-6">
            <h3 className="mb-4 text-lg font-semibold text-red-600">Top Mutton Products</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topMuttonProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb" }} />
                  <Bar dataKey="revenue" fill="#e11d48" radius={[0, 6, 6, 0]} name="Revenue (INR)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {topChickenProducts.length > 0 && (
          <div className="rounded-xl border bg-card p-6">
            <h3 className="mb-4 text-lg font-semibold text-amber-600">Top Chicken Products</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topChickenProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb" }} />
                  <Bar dataKey="revenue" fill="#f59e0b" radius={[0, 6, 6, 0]} name="Revenue (INR)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Bar Chart - Mutton vs Chicken by Community */}
      {muttonChickenByCommunity.length > 0 && (
        <div className="rounded-xl border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">Mutton vs Chicken by Community</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={muttonChickenByCommunity}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb" }} />
                <Legend />
                <Bar dataKey="mutton" fill="#e11d48" radius={[6, 6, 0, 0]} name="Mutton" />
                <Bar dataKey="chicken" fill="#f59e0b" radius={[6, 6, 0, 0]} name="Chicken" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Pie Chart - Revenue by Community */}
      {communityPieData.length > 0 && (
        <div className="rounded-xl border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">Revenue by Community</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={communityPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={110}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {communityPieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Bar Chart - Revenue by Community */}
      {communityStats.length > 0 && (
        <div className="rounded-xl border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">Community Comparison</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={communityStats}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb" }}
                />
                <Legend />
                <Bar dataKey="revenue" fill="#e11d48" radius={[6, 6, 0, 0]} name="Revenue" />
                <Bar dataKey="orders" fill="#2563eb" radius={[6, 6, 0, 0]} name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Community Stats Table */}
      <div className="rounded-xl border bg-card p-4 sm:p-6">
        <h3 className="mb-4 text-base font-semibold sm:text-lg">By Community</h3>
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
                    <td className="p-2 text-right font-medium">INR {c.revenue}</td>
                    <td className="p-2 text-right">INR {Math.round(c.revenue / c.orders)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Block Stats */}
      <div className="rounded-xl border bg-card p-4 sm:p-6">
        <h3 className="mb-4 text-base font-semibold sm:text-lg">By Block</h3>
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
                    <td className="p-2 text-right font-medium">INR {b.revenue}</td>
                    <td className="p-2 text-right">INR {Math.round(b.revenue / b.orders)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Product Stats */}
      <div className="rounded-xl border bg-card p-4 sm:p-6">
        <h3 className="mb-4 text-base font-semibold sm:text-lg">Products</h3>
        <div className="flex gap-4 text-base">
          <span>{products.length} total</span>
          <span>{products.filter((p) => p.active).length} active</span>
          <span>{products.filter((p) => !p.active).length} inactive</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Item Sales ---------------- */
type DateFilter = "all" | "today" | "7days" | "30days";
type CategoryFilter = "all" | "mutton" | "chicken" | "other";

type ItemStat = { name: string; unit: string; qty: number; kgSold: number; pcsSold: number; revenue: number; orderCount: number; currentStock: number | null };

function categorizeProduct(name: string): "mutton" | "chicken" | "other" {
  const n = name.toLowerCase();
  if (n.startsWith("mutton")) return "mutton";
  if (n.startsWith("chicken")) return "chicken";
  return "other";
}

function ItemSalesTab() {
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [sortBy, setSortBy] = useState<"revenue" | "quantity">("revenue");

  const { data: orders = [], isLoading: loadingOrders } = useQuery<Order[]>({
    queryKey: ["admin", "orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, created_at")
        .order("created_at", { ascending: false });
      if (error) return [];
      return (data as Order[]) || [];
    },
    staleTime: 60_000,
  });

  const { data: items = [], isLoading: loadingItems } = useQuery<OrderItem[]>({
    queryKey: ["admin", "order_items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("order_items").select("*");
      if (error) return [];
      return (data as OrderItem[]) || [];
    },
    staleTime: 60_000,
  });

  const { data: products = [], isLoading: loadingProducts } = useQuery<Product[]>({
    queryKey: ["admin", "products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, unit, price, active, image_url, stock")
        .order("name");
      if (error) return [];
      return (data as Product[]) || [];
    },
    staleTime: 300_000,
  });

  if (loadingOrders || loadingItems || loadingProducts)
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

  // Filter orders by date
  const now = new Date();
  const filteredOrderIds = new Set(
    orders
      .filter((o) => {
        if (dateFilter === "all") return true;
        const d = new Date(o.created_at);
        if (dateFilter === "today") return d.toDateString() === now.toDateString();
        if (dateFilter === "7days") {
          const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
          return diff <= 7;
        }
        if (dateFilter === "30days") {
          const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
          return diff <= 30;
        }
        return true;
      })
      .map((o) => o.id)
  );

  const filteredItems = items.filter((i) => filteredOrderIds.has(i.order_id));

  // Get current stock from products
  const productStockMap = new Map<string, number | null>();
  products.forEach((p) => productStockMap.set(p.name, p.stock ?? null));

  // Aggregate by product
  const productMap = new Map<string, ItemStat>();
  filteredItems.forEach((it) => {
    const existing = productMap.get(it.product_name);
    const amt = Number(it.price) * Number(it.quantity);
    const kg = unitToKg(it.unit, it.quantity);
    const pcs = unitCount(it.unit, it.quantity);
    if (existing) {
      existing.qty += it.quantity;
      existing.kgSold += kg;
      existing.pcsSold += pcs;
      existing.revenue += amt;
      existing.orderCount += 1;
    } else {
      productMap.set(it.product_name, {
        name: it.product_name,
        unit: it.unit,
        qty: it.quantity,
        kgSold: kg,
        pcsSold: pcs,
        revenue: amt,
        orderCount: 1,
        currentStock: productStockMap.get(it.product_name) ?? null,
      });
    }
  });

  let allProductStats = Array.from(productMap.values());
  allProductStats.sort((a, b) => (sortBy === "revenue" ? b.revenue - a.revenue : b.kgSold - a.kgSold));

  // Split by category
  const muttonStats = allProductStats.filter((p) => categorizeProduct(p.name) === "mutton");
  const chickenStats = allProductStats.filter((p) => categorizeProduct(p.name) === "chicken");
  const otherStats = allProductStats.filter((p) => categorizeProduct(p.name) === "other");

  const visibleStats = category === "all" ? allProductStats
    : category === "mutton" ? muttonStats
    : category === "chicken" ? chickenStats
    : otherStats;

  const totalRevenue = visibleStats.reduce((s, p) => s + p.revenue, 0);
  const totalKg = visibleStats.reduce((s, p) => s + p.kgSold, 0);
  const totalPcs = visibleStats.reduce((s, p) => s + p.pcsSold, 0);

  const muttonRevenue = muttonStats.reduce((s, p) => s + p.revenue, 0);
  const chickenRevenue = chickenStats.reduce((s, p) => s + p.revenue, 0);
  const otherRevenue = otherStats.reduce((s, p) => s + p.revenue, 0);

  const muttonKg = muttonStats.reduce((s, p) => s + p.kgSold, 0);
  const chickenKg = chickenStats.reduce((s, p) => s + p.kgSold, 0);
  const otherKg = otherStats.reduce((s, p) => s + p.kgSold, 0);

  const muttonPcs = muttonStats.reduce((s, p) => s + p.pcsSold, 0);
  const chickenPcs = chickenStats.reduce((s, p) => s + p.pcsSold, 0);
  const otherPcs = otherStats.reduce((s, p) => s + p.pcsSold, 0);

  // Top 10 for chart
  const chartData = visibleStats.slice(0, 10).map((p) => ({
    name: p.name.length > 18 ? p.name.slice(0, 18) + "..." : p.name,
    revenue: Math.round(p.revenue),
    kgSold: Number(p.kgSold.toFixed(1)),
  }));

  function renderTable(stats: ItemStat[], title: string, color: string) {
    const tRevenue = stats.reduce((s, p) => s + p.revenue, 0);
    const tKg = stats.reduce((s, p) => s + p.kgSold, 0);
    const tPcs = stats.reduce((s, p) => s + p.pcsSold, 0);
    return (
      <div className="rounded-xl border bg-card p-6">
        <h3 className={`mb-4 text-lg font-semibold ${color}`}>{title}</h3>
        {stats.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sales data.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="p-2">#</th>
                  <th className="p-2">Product</th>
                  <th className="p-2">Unit</th>
                  <th className="p-2 text-right">Kg Sold</th>
                  <th className="p-2 text-right">Pcs</th>
                  <th className="p-2 text-right">Orders</th>
                  <th className="p-2 text-right">Revenue</th>
                  <th className="p-2 text-right">Avg Price</th>
                  <th className="p-2 text-right">Stock Left</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((ps, idx) => (
                  <tr key={ps.name} className="border-t">
                    <td className="p-2 text-muted-foreground">{idx + 1}</td>
                    <td className="p-2 font-medium">{ps.name}</td>
                    <td className="p-2 capitalize">{ps.unit}</td>
                    <td className="p-2 text-right font-medium">{ps.kgSold % 1 === 0 ? ps.kgSold.toFixed(0) : ps.kgSold.toFixed(1)}</td>
                    <td className="p-2 text-right">{ps.pcsSold || "-"}</td>
                    <td className="p-2 text-right">{ps.orderCount}</td>
                    <td className="p-2 text-right font-bold text-primary">INR {Math.round(ps.revenue)}</td>
                    <td className="p-2 text-right">INR {ps.kgSold > 0 ? Math.round(ps.revenue / ps.kgSold) : Math.round(ps.revenue / Math.max(ps.pcsSold, 1))}/kg</td>
                    <td className="p-2 text-right">
                      {ps.currentStock != null ? (
                        <span className={ps.currentStock <= 0 ? "font-bold text-red-500" : "text-green-600"}>
                          {ps.currentStock}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted font-bold">
                  <td className="p-2" colSpan={3}>Total</td>
                  <td className="p-2 text-right">{tKg % 1 === 0 ? tKg.toFixed(0) : tKg.toFixed(1)}</td>
                  <td className="p-2 text-right">{tPcs || "-"}</td>
                  <td className="p-2 text-right">{stats.reduce((s, p) => s + p.orderCount, 0)}</td>
                  <td className="p-2 text-right text-primary">INR {Math.round(tRevenue)}</td>
                  <td className="p-2 text-right">-</td>
                  <td className="p-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl border bg-card p-1">
          {(["all", "today", "7days", "30days"] as DateFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setDateFilter(f)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                dateFilter === f
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "All Time" : f === "today" ? "Today" : f === "7days" ? "Last 7 Days" : "Last 30 Days"}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-xl border bg-card p-1">
          {([
            { value: "all" as CategoryFilter, label: "All" },
            { value: "mutton" as CategoryFilter, label: "Mutton" },
            { value: "chicken" as CategoryFilter, label: "Chicken" },
            { value: "other" as CategoryFilter, label: "Other" },
          ]).map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                category === c.value
                  ? c.value === "mutton" ? "bg-red-600 text-white"
                    : c.value === "chicken" ? "bg-amber-500 text-white"
                    : "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-xl border bg-card p-1">
          <button
            onClick={() => setSortBy("revenue")}
            className={`flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              sortBy === "revenue"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <IndianRupee className="h-3.5 w-3.5" /> Revenue
          </button>
          <button
            onClick={() => setSortBy("quantity")}
            className={`flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              sortBy === "quantity"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Package className="h-3.5 w-3.5" /> Kg Sold
          </button>
        </div>
      </div>

      {/* Category Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div
          className={`rounded-xl border-2 p-6 cursor-pointer transition ${category === "mutton" ? "border-red-500 bg-red-50" : "border-border bg-card hover:border-red-300"}`}
          onClick={() => setCategory(category === "mutton" ? "all" : "mutton")}
        >
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold text-red-600">Mutton</span>
            <span className="text-xs text-muted-foreground">{muttonStats.length} products</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-red-600">INR {Math.round(muttonRevenue)}</div>
          <div className="text-sm text-muted-foreground">
            {muttonKg > 0 && <>{muttonKg % 1 === 0 ? muttonKg.toFixed(0) : muttonKg.toFixed(1)} kg</>}
            {muttonKg > 0 && muttonPcs > 0 && <span className="mx-1">/</span>}
            {muttonPcs > 0 && <>{muttonPcs} pcs</>}
            {muttonKg === 0 && muttonPcs === 0 && "0 sold"}
          </div>
        </div>
        <div
          className={`rounded-xl border-2 p-6 cursor-pointer transition ${category === "chicken" ? "border-amber-500 bg-amber-50" : "border-border bg-card hover:border-amber-300"}`}
          onClick={() => setCategory(category === "chicken" ? "all" : "chicken")}
        >
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold text-amber-600">Chicken</span>
            <span className="text-xs text-muted-foreground">{chickenStats.length} products</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600">INR {Math.round(chickenRevenue)}</div>
          <div className="text-sm text-muted-foreground">
            {chickenKg > 0 && <>{chickenKg % 1 === 0 ? chickenKg.toFixed(0) : chickenKg.toFixed(1)} kg</>}
            {chickenKg > 0 && chickenPcs > 0 && <span className="mx-1">/</span>}
            {chickenPcs > 0 && <>{chickenPcs} pcs</>}
            {chickenKg === 0 && chickenPcs === 0 && "0 sold"}
          </div>
        </div>
        <div
          className={`rounded-xl border-2 p-6 cursor-pointer transition ${category === "other" ? "border-blue-500 bg-blue-50" : "border-border bg-card hover:border-blue-300"}`}
          onClick={() => setCategory(category === "other" ? "all" : "other")}
        >
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold text-blue-600">Other</span>
            <span className="text-xs text-muted-foreground">{otherStats.length} products</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-600">INR {Math.round(otherRevenue)}</div>
          <div className="text-sm text-muted-foreground">
            {otherKg > 0 && <>{otherKg % 1 === 0 ? otherKg.toFixed(0) : otherKg.toFixed(1)} kg</>}
            {otherKg > 0 && otherPcs > 0 && <span className="mx-1">/</span>}
            {otherPcs > 0 && <>{otherPcs} pcs</>}
            {otherKg === 0 && otherPcs === 0 && "0 sold"}
          </div>
        </div>
      </div>

      {/* Overall Summary */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 text-base text-muted-foreground">
            <Package className="h-5 w-5" /> Kg Sold
          </div>
          <div className="mt-2 text-3xl font-bold">{totalKg % 1 === 0 ? totalKg.toFixed(0) : totalKg.toFixed(1)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 text-base text-muted-foreground">
            <Package className="h-5 w-5" /> Pcs Sold
          </div>
          <div className="mt-2 text-3xl font-bold">{totalPcs}</div>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 text-base text-muted-foreground">
            <IndianRupee className="h-5 w-5" /> Total Revenue
          </div>
          <div className="mt-2 text-3xl font-bold">INR {Math.round(totalRevenue)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 text-base text-muted-foreground">
            <BarChart3 className="h-5 w-5" /> Unique Products
          </div>
          <div className="mt-2 text-3xl font-bold">{visibleStats.length}</div>
        </div>
      </div>

      {/* Bar Chart */}
      {chartData.length > 0 && (
        <div className="rounded-xl border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">
            {category === "all" ? "All" : category.charAt(0).toUpperCase() + category.slice(1)} — Top Products by {sortBy === "revenue" ? "Revenue" : "Quantity"}
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={150} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb" }} />
                <Bar
                  dataKey={sortBy === "revenue" ? "revenue" : "kgSold"}
                  fill={category === "mutton" ? "#e11d48" : category === "chicken" ? "#f59e0b" : "#2563eb"}
                  radius={[0, 6, 6, 0]}
                  name={sortBy === "revenue" ? "Revenue (INR)" : "Kg Sold"}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tables — show split or combined */}
      {category === "all" ? (
        <>
          {muttonStats.length > 0 && renderTable(muttonStats, "Mutton Items", "text-red-600")}
          {chickenStats.length > 0 && renderTable(chickenStats, "Chicken Items", "text-amber-600")}
          {otherStats.length > 0 && renderTable(otherStats, "Other Items", "text-blue-600")}
        </>
      ) : (
        renderTable(visibleStats, `${category.charAt(0).toUpperCase() + category.slice(1)} Items`, "")
      )}
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
        }, 1000);
      }, 500);
    }, 500);
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

  const doBtPrintBatch = useCallback(
    async (orders: Order[]) => {
      const receipts: ReceiptData[] = orders.map((o) => {
        const oItems = items.filter((i) => i.order_id === o.id);
        return {
          orderNumber: o.order_number,
          customerName: o.customer_name,
          flatNo: o.flat_no,
          phone: o.phone,
          altPhone: o.alt_phone,
          communityName: o.community_name,
          blockName: o.block_name,
          packingNote: o.packing_note,
          items: oItems.map((it) => ({
            name: it.product_name,
            unit: it.unit,
            price: it.price,
            quantity: it.quantity,
          })),
          total: o.total,
          date: new Date(o.created_at).toLocaleString(),
        };
      });
      const ok = await btPrintMultiple(receipts);
      if (!ok) alert("Batch print failed. Check printer connection.");
    },
    [items],
  );

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await adminDeleteOrder({ data: { id: orderId } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "order_items"] });
    },
  });

  const deleteAllOrdersMutation = useMutation({
    mutationFn: async () => {
      await adminDeleteAllOrders({ data: {} });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "order_items"] });
    },
  });

  const handleDeleteOrder = (orderId: string, orderNumber: string) => {
    if (!confirm(`Delete order ${orderNumber}? This cannot be undone.`)) return;
    deleteOrderMutation.mutate(orderId);
  };

  const handleDeleteAllOrders = () => {
    if (!confirm(`Delete ALL ${allOrders.length} orders? This cannot be undone.`)) return;
    deleteAllOrdersMutation.mutate();
  };

  const downloadOrdersCSV = () => {
    const rows: string[] = [];
    rows.push("Order ID,Date,Customer Name,Flat,Phone,Alt Phone,Community,Block,Packing Note,Items,Total");
    for (const o of allOrders) {
      const oItems = items.filter((i) => i.order_id === o.id);
      const itemsStr = oItems
        .map((it) => `${it.product_name} ${it.unit} x${it.quantity} INR${Math.round(Number(it.price) * Number(it.quantity))}`)
        .join(" | ");
      const date = new Date(o.created_at).toLocaleString();
      const escape = (s: string) => `"${(s || "").replace(/"/g, '""')}"`;
      rows.push(
        [
          o.order_number,
          escape(date),
          escape(o.customer_name),
          escape(o.flat_no),
          o.phone,
          o.alt_phone || "",
          escape(o.community_name),
          escape(o.block_name),
          escape(o.packing_note || ""),
          escape(itemsStr),
          Math.round(Number(o.total)),
        ].join(","),
      );
    }
    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
                INR {Math.round(Number(newOrderAlert.total))} | {newOrderAlert.phone}
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

      <div className="no-print mb-5 grid gap-3 grid-cols-1 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
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
                {isPrinterConnected() && (
                  <button
                    onClick={() => doBtPrintBatch(communityOrders)}
                    className="flex items-center justify-center gap-1 rounded-md bg-green-700 px-3 py-2 text-sm font-medium text-white"
                  >
                    <Bluetooth className="h-4 w-4" /> BT Batch
                  </button>
                )}
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
                    {isPrinterConnected() && (
                      <button
                        onClick={() => doBtPrintBatch(bOrders)}
                        className="rounded bg-green-700 px-2 py-1 text-xs text-white"
                      >
                        BT
                      </button>
                    )}
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
          {allOrders.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={downloadOrdersCSV}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Download className="h-4 w-4" /> Download CSV
              </button>
              <button
                onClick={handleDeleteAllOrders}
                disabled={deleteAllOrdersMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deleteAllOrdersMutation.isPending ? "Deleting..." : "Delete All"}
              </button>
            </div>
          )}
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
                  <button
                    onClick={() => handleDeleteOrder(o.id, o.order_number)}
                    disabled={deleteOrderMutation.isPending}
                    className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
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
                <span className="text-primary text-lg">INR {Math.round(Number(o.total))}</span>
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
                  <td className="p-3 text-right font-semibold">INR {Math.round(Number(o.total))}</td>
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
                      <button
                        onClick={() => handleDeleteOrder(o.id, o.order_number)}
                        disabled={deleteOrderMutation.isPending}
                        className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" /> Delete
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
  const grandTotal = Math.round(orders.reduce((s, o) => s + Number(o.total), 0));

  return (
    <div className="print-page a4-only bg-white p-6 text-black" style={{ border: "none", borderRadius: 0 }}>
      <div className="mb-4 flex items-center gap-4 border-b-2 border-black pb-3">
        <img src="/MM.jpeg" alt="Logo" className="h-14 w-14 object-contain" />
        <div>
          <h1 className="text-2xl font-bold leading-tight">
            Manapalle
            <span className="block text-sm font-medium">Mutton & Chicken</span>
          </h1>
          <p className="mt-1 text-xs text-gray-500">Fresh from the Village, Straight to Your Home — 9030901233</p>
          <p className="mt-1 text-sm font-bold">{title}</p>
          <p className="text-[10px] text-gray-600">Printed: {new Date().toLocaleString()}</p>
        </div>
      </div>

      {blocks.length === 0 && <p>No orders.</p>}

      {blocks.map((blockName) => {
        const blockOrders = orders.filter((o) => o.block_name === blockName);
        const blockTotal = Math.round(blockOrders.reduce((s, o) => s + Number(o.total), 0));
        return (
          <div key={blockName} className="mb-5 avoid-break">
            <h2 className="mb-1.5 border-b-2 border-black px-2 py-0.5 text-sm font-bold bg-gray-100">
              Block {blockName} &mdash; {blockOrders.length} order{blockOrders.length !== 1 ? "s" : ""}
            </h2>
              {blockOrders.map((o) => {
              const oItems = items.filter((i) => i.order_id === o.id);
              const showAlt = o.alt_phone && o.alt_phone !== o.phone;
              return (
                <div key={o.id} className="mb-3 avoid-break border border-gray-400 p-2 text-xs" style={{ borderRadius: 0 }}>
                  <div className="flex items-baseline justify-between gap-2 border-b border-gray-300 pb-1 font-semibold">
                    <span className="truncate">
                      {o.order_number} &mdash; {o.customer_name}, {o.flat_no || "-"}
                    </span>
                    <span className="whitespace-nowrap text-[10px] text-gray-600">
                      {o.phone}{showAlt ? ` / ${o.alt_phone}` : ""}
                    </span>
                  </div>
                  {o.packing_note && (
                    <div className="mt-1 px-1.5 py-0.5 text-[10px] font-semibold border border-gray-400 inline-block">
                      Note: {o.packing_note}
                    </div>
                  )}
                  <table className="mt-1.5 w-full border-collapse">
                    <thead>
                      <tr className="border-b border-gray-400 text-[10px] text-gray-600">
                        <th className="py-0.5 text-left w-[60%]">Item</th>
                        <th className="py-0.5 text-center w-[20%]">Qty</th>
                        <th className="py-0.5 text-right w-[20%]">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {oItems.map((it) => {
                        const lineAmt = Math.round(Number(it.price) * Number(it.quantity));
                        const qtyDisplay = it.unit + " x" + it.quantity;
                        return (
                          <tr key={it.id} className="border-b border-gray-200">
                            <td className="py-0.5">{it.product_name}</td>
                            <td className="py-0.5 text-center">{qtyDisplay}</td>
                            <td className="py-0.5 text-right">INR {lineAmt}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="mt-0.5 flex justify-between border-t-2 border-black pt-0.5 font-bold text-xs">
                    <span>Total</span>
                    <span>INR {Math.round(Number(o.total))}</span>
                  </div>
                </div>
              );
            })}
            <div className="flex justify-between border-t-2 border-black px-2 py-0.5 text-xs font-bold">
              <span>Block {blockName} Subtotal</span>
              <span>INR {blockTotal}</span>
            </div>
          </div>
        );
      })}
      <div className="flex justify-between border-t-4 border-double border-black px-2 py-1 text-sm font-bold">
        <span>GRAND TOTAL &mdash; {orders.length} order{orders.length !== 1 ? "s" : ""}</span>
        <span>INR {grandTotal}</span>
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
        const bTotal = Math.round(bOrders.reduce((s, o) => s + Number(o.total), 0));
        return (
          <div key={blockName ?? "all"}>
            {/* Each order gets its own full receipt */}
            {bOrders.map((o, idx) => {
              const oItems = items.filter((i) => i.order_id === o.id);
              const showAlt = o.alt_phone && o.alt_phone !== o.phone;
              return (
                <div key={o.id} className={"thermal-order" + (idx < bOrders.length - 1 ? " thermal-page" : "")}>
                  <div className="thermal-receipt">
                    <div style={{ textAlign: "center" }}>
                      <img src="/MM.jpeg" alt="Logo" style={{ height: 48, margin: "0 auto" }} />
                    </div>
                    <h1 style={{ textAlign: "center", fontSize: 16, letterSpacing: 1 }}>
                      MANAPALLE MUTTON
                    </h1>
                    <div style={{ textAlign: "center", fontSize: 10, marginBottom: "2mm" }}>
                      {new Date(o.created_at).toLocaleString()}
                    </div>
                    <div style={{ textAlign: "center", fontSize: 10, marginBottom: "2mm" }}>
                      Call: 9030 90 1233
                    </div>
                    <div className="divider-solid" />
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
                    {showAlt && <div style={{ fontSize: 11 }}>Alt: {o.alt_phone}</div>}
                    <div style={{ fontSize: 11, marginBottom: "1mm" }}>
                      {o.community_name} / Block {o.block_name}
                    </div>
                    {o.packing_note && (
                      <div style={{ fontSize: 11, fontWeight: 800, marginTop: "1mm", marginBottom: "1mm" }}>
                        Note: {o.packing_note}
                      </div>
                    )}
                    <table style={{ marginTop: "1mm" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px dashed #000" }}>
                          <th style={{ fontSize: 11, textAlign: "left", paddingBottom: "0.5mm" }}>Item</th>
                          <th style={{ fontSize: 11, textAlign: "center", paddingBottom: "0.5mm" }}>Qty</th>
                          <th style={{ fontSize: 11, textAlign: "right", paddingBottom: "0.5mm" }}>Amt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {oItems.map((it) => {
                          const lineAmt = Math.round(Number(it.price) * Number(it.quantity));
                          const qtyDisplay = it.unit + " x" + it.quantity;
                          return (
                            <tr key={it.id}>
                              <td style={{ fontSize: 11, paddingTop: "0.5mm" }}>{it.product_name}</td>
                              <td style={{ textAlign: "center", fontSize: 11, paddingTop: "0.5mm" }}>
                                {qtyDisplay}
                              </td>
                              <td style={{ textAlign: "right", fontSize: 11, paddingTop: "0.5mm" }}>
                                INR {lineAmt}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div
                      className="row"
                      style={{
                        borderTop: "2px solid #000",
                        marginTop: "1mm",
                        paddingTop: "1mm",
                        fontWeight: 800,
                        fontSize: 13,
                      }}
                    >
                      <span>TOTAL</span>
                      <span>INR {Math.round(Number(o.total))}</span>
                    </div>
                    <div
                      style={{
                        textAlign: "center",
                        marginTop: "2mm",
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
            {/* Block summary page */}
            {blocks.length > 1 && bOrders.length > 1 && (
              <div className="thermal-page">
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
                  <div style={{ textAlign: "center", fontSize: 10, marginBottom: "2mm" }}>
                    Call: 9030 90 1233
                  </div>
                  <div className="divider-solid" />
                  <div style={{ textAlign: "center", fontWeight: 800, fontSize: 13 }}>
                    {title} — {blockName ? `Block ${blockName}` : ""}
                  </div>
                  <div style={{ fontSize: 11 }}>Orders: {bOrders.length}</div>
                  <div className="divider-solid" />
                  {bOrders.map((o) => (
                    <div key={o.id} className="row" style={{ fontSize: 11, marginBottom: "0.5mm" }}>
                      <span>{o.customer_name} — {o.order_number}</span>
                      <span>INR {Math.round(Number(o.total))}</span>
                    </div>
                  ))}
                  <div className="divider-solid" />
                  <div className="row" style={{ fontWeight: 800, fontSize: 13 }}>
                    <span>{blockName ? `Block ${blockName}` : "GRAND"} TOTAL</span>
                    <span>INR {bTotal}</span>
                  </div>
                </div>
              </div>
            )}
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

  useEffect(() => {
    const channel = supabase
      .channel("admin-products-stock")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

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
        className="mb-5 grid gap-3 rounded-xl border bg-card p-4 sm:p-6 sm:grid-cols-2 lg:grid-cols-6"
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
              <option value="750g">750g</option>
              <option value="dozen">dozen</option>
              <option value="piece">piece</option>
              <option value="tray">Tray (30)</option>
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

      {/* Desktop Table */}
      <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
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
                    <img src={p.image_url} alt={p.name} className="h-14 w-14 rounded-xl object-cover border shadow-sm" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl border bg-muted text-xs text-muted-foreground">No Image</div>
                  )}
                </td>
                <td className="p-3">
                  <input defaultValue={p.name} onBlur={(e) => updateName(p, e.target.value)} className="w-full min-w-[120px] rounded-xl border bg-background px-3 py-2 text-base" />
                </td>
                <td className="p-3">
                  <select defaultValue={p.unit} onChange={(e) => updateUnit(p, e.target.value)} className="rounded-xl border bg-background px-3 py-2 text-base">
                    <option value="kg">kg</option><option value="500g">500g</option><option value="750g">750g</option><option value="dozen">dozen</option><option value="piece">piece</option><option value="tray">Tray (30)</option>
                  </select>
                </td>
                <td className="p-3">
                  <input defaultValue={p.price} onBlur={(e) => updatePrice(p, e.target.value)} type="number" className="w-28 rounded-xl border bg-background px-3 py-2 text-base" />
                </td>
                <td className="p-3">
                  <input defaultValue={p.stock ?? ""} onBlur={(e) => { const v = e.target.value.trim(); if (v === "" || v === p.stock?.toString()) return; const num = Number(v); if (v !== "" && (isNaN(num) || num < 0)) return; updateProductMutation.mutate({ id: p.id, updates: { stock: v === "" ? null : num } }); }} placeholder="Unlimited" type="text" inputMode="decimal" className="w-28 rounded-xl border bg-background px-3 py-2 text-base" />
                </td>
                <td className="p-3">
                  <button onClick={() => toggle(p)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${p.active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>
                    {p.active ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="file" accept="image/*" className="hidden" id={`image-upload-${p.id}`} onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(p, file); }} />
                    <label htmlFor={`image-upload-${p.id}`} className="cursor-pointer rounded-xl border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">
                      {uploadingId === p.id ? "Uploading..." : "Upload File"}
                    </label>
                    {p.image_url && (
                      <button onClick={() => removeImageMutation.mutate({ productId: p.id, imageUrl: p.image_url! })} disabled={removeImageMutation.isPending} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100 disabled:opacity-50">
                        {removeImageMutation.isPending ? "Removing..." : "Remove Image"}
                      </button>
                    )}
                  </div>
                </td>
                <td className="p-3 text-right">
                  <button onClick={() => del(p)} className="text-destructive hover:underline text-sm font-medium px-2 py-2">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="space-y-3 md:hidden">
        {products.map((p) => (
          <div key={p.id} className="rounded-xl border bg-card p-4">
            <div className="flex gap-3">
              {p.image_url ? (
                <img src={p.image_url} alt={p.name} className="h-16 w-16 shrink-0 rounded-xl object-cover border shadow-sm" />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border bg-muted text-xs text-muted-foreground">No Image</div>
              )}
              <div className="min-w-0 flex-1">
                <input defaultValue={p.name} onBlur={(e) => updateName(p, e.target.value)} className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm font-medium" />
                <div className="mt-2 flex flex-wrap gap-2">
                  <select defaultValue={p.unit} onChange={(e) => updateUnit(p, e.target.value)} className="rounded-lg border bg-background px-2 py-1 text-xs">
                    <option value="kg">kg</option><option value="500g">500g</option><option value="750g">750g</option><option value="dozen">dozen</option><option value="piece">piece</option><option value="tray">Tray (30)</option>
                  </select>
                  <input defaultValue={p.price} onBlur={(e) => updatePrice(p, e.target.value)} type="number" className="w-20 rounded-lg border bg-background px-2 py-1 text-xs" placeholder="Price" />
                  <input defaultValue={p.stock ?? ""} onBlur={(e) => { const v = e.target.value.trim(); if (v === "" || v === p.stock?.toString()) return; const num = Number(v); if (v !== "" && (isNaN(num) || num < 0)) return; updateProductMutation.mutate({ id: p.id, updates: { stock: v === "" ? null : num } }); }} placeholder="Stock" type="text" inputMode="decimal" className="w-20 rounded-lg border bg-background px-2 py-1 text-xs" />
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
              <button onClick={() => toggle(p)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${p.active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>
                {p.active ? "Active" : "Inactive"}
              </button>
              <input type="file" accept="image/*" className="hidden" id={`image-upload-m-${p.id}`} onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(p, file); }} />
              <label htmlFor={`image-upload-m-${p.id}`} className="cursor-pointer rounded-lg border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted">
                {uploadingId === p.id ? "Uploading..." : "Image"}
              </label>
              {p.image_url && (
                <button onClick={() => removeImageMutation.mutate({ productId: p.id, imageUrl: p.image_url! })} disabled={removeImageMutation.isPending} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 disabled:opacity-50">
                  Remove
                </button>
              )}
              <button onClick={() => del(p)} className="ml-auto text-destructive text-xs font-medium px-2 py-1.5">Delete</button>
            </div>
          </div>
        ))}
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
      <div className="rounded-xl border bg-card p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <h3 className="flex items-center gap-2 text-lg font-semibold sm:text-xl">
              {ordersOpen ? (
                <ShoppingCart className="h-5 w-5 text-green-500 sm:h-6 sm:w-6" />
              ) : (
                <ShoppingCart className="h-5 w-5 text-red-500 sm:h-6 sm:w-6" />
              )}
              Accept Orders
            </h3>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              {ordersOpen
                ? "Orders are OPEN. Users can place orders."
                : "Orders are CLOSED. Users cannot place orders."}
            </p>
          </div>
          <button
            onClick={toggleOrdersOpen}
            className={`relative h-10 w-16 shrink-0 rounded-full transition-colors ${
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

      {/* Login Popup Message */}
      <div className="rounded-xl border bg-card p-4 sm:p-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold sm:text-xl">
          <Megaphone className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
          Login Popup
        </h3>
        <p className="mb-4 text-sm text-muted-foreground sm:text-base">
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
      <div className="rounded-xl border bg-card p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <h3 className="flex items-center gap-2 text-lg font-semibold sm:text-xl">
              {isMaintenance ? (
                <PowerOff className="h-5 w-5 text-red-500 sm:h-6 sm:w-6" />
              ) : (
                <Power className="h-5 w-5 text-green-500 sm:h-6 sm:w-6" />
              )}
              Maintenance Mode
            </h3>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              {isMaintenance
                ? "Website is OFFLINE. Users see maintenance message."
                : "Website is LIVE. All users can access."}
            </p>
          </div>
          <button
            onClick={toggleMaintenance}
            className={`relative h-10 w-16 shrink-0 rounded-full transition-colors ${
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
      <div className="rounded-xl border bg-card p-4 sm:p-6">
        <h3 className="mb-4 text-base font-semibold sm:text-lg">Quick Info</h3>
        <div className="space-y-2 text-sm sm:space-y-3 sm:text-base">
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
