import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle,
  Receipt,
  ArrowLeft,
  Bluetooth,
  MapPin,
  Home,
  FileText,
  Truck,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { CartItem, cartTotal, clearCart, getCart } from "@/lib/cart";
import { getPhone, getName } from "@/lib/session";
import { isPrinterConnected, printReceipt as btPrintReceipt } from "@/lib/bt-printer";

type Community = { id: string; name: string };
type Block = { id: string; community_id: string; name: string };

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
  head: () => ({ meta: [{ title: "Checkout - Manapalle Mutton" }] }),
});

function CheckoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<CartItem[]>([]);
  const [communityId, setCommunityId] = useState("");
  const [blockId, setBlockId] = useState("");
  const [flatNo, setFlatNo] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const [packingNote, setPackingNote] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [doneOrder, setDoneOrder] = useState<{
    id: string;
    order_number: string;
    customer_name: string;
    flat_no: string;
    phone: string;
    alt_phone: string | null;
    packing_note: string | null;
    community_name: string;
    block_name: string;
    total: number;
    created_at: string;
  } | null>(null);
  const [doneItems, setDoneItems] = useState<
    { product_name: string; unit: string; price: number; quantity: number }[]
  >([]);

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

  const { data: communities = [] } = useQuery<Community[]>({
    queryKey: ["communities"],
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

  const { data: blocks = [] } = useQuery<Block[]>({
    queryKey: ["blocks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("blocks").select("*").order("name");
      if (error) {
        console.error("Failed to load blocks:", error);
        return [];
      }
      return (data as Block[]) || [];
    },
    staleTime: 60_000,
  });

  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      const phone = getPhone();
      if (!phone) throw new Error("Not logged in");
      const customerName = getName() || "";
      const community = communities.find((c) => c.id === communityId);
      const block = blocks.find((b) => b.id === blockId);
      if (!community || !block) throw new Error("Invalid community or block selection");

      const { data: order, error: oErr } = await supabase
        .from("orders")
        .insert({
          phone,
          customer_name: customerName,
          flat_no: flatNo,
          alt_phone: altPhone || null,
          packing_note: packingNote || null,
          community_id: communityId,
          block_id: blockId,
          community_name: community.name,
          block_name: block.name,
          total: cartTotal(items),
          status: "pending",
        })
        .select()
        .single();
      if (oErr || !order) throw new Error(oErr?.message || "Failed to place order");
      const orderItems = items.map((i) => ({
        order_id: order.id,
        product_id: i.product_id,
        product_name: i.name,
        unit: i.unit,
        price: i.price,
        quantity: i.quantity,
      }));
      const { error: iErr } = await supabase.from("order_items").insert(orderItems);
      if (iErr) throw new Error(iErr.message);
      return order.order_number as string;
    },
    onSuccess: (orderNumber) => {
      clearCart();
      setDone(orderNumber);
      const phone = getPhone();
      const customerName = getName() || "";
      const community = communities.find((c) => c.id === communityId);
      const block = blocks.find((b) => b.id === blockId);
      setDoneOrder({
        id: orderNumber,
        order_number: orderNumber,
        customer_name: customerName,
        flat_no: flatNo,
        phone: phone || "",
        alt_phone: altPhone || null,
        packing_note: packingNote || null,
        community_name: community?.name || "",
        block_name: block?.name || "",
        total: cartTotal(items),
        created_at: new Date().toISOString(),
      });
      setDoneItems(
        items.map((i) => ({
          product_name: i.name,
          unit: i.unit,
          price: i.price,
          quantity: i.quantity,
        })),
      );
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const blocksForCommunity = blocks.filter((b) => b.community_id === communityId);
  const total = cartTotal(items);

  const placeOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!communityId || !blockId) {
      setError("Please select your community and block");
      return;
    }
    if (!flatNo.trim()) {
      setError("Please enter your flat or house number");
      return;
    }
    if (altPhone && !/^\d{10}$/.test(altPhone)) {
      setError("Alternative mobile number must be 10 digits");
      return;
    }
    if (items.length === 0) {
      setError("Your cart is empty");
      return;
    }
    placeOrderMutation.mutate();
  };

  const printReceipt = () => {
    document.body.classList.add("printing-thermal");
    setTimeout(() => {
      window.scrollTo(0, 0);
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          document.body.classList.remove("printing-thermal");
        }, 500);
      }, 200);
    }, 300);
  };

  const btPrint = async () => {
    if (!doneOrder) return;
    const ok = await btPrintReceipt({
      orderNumber: doneOrder.order_number,
      customerName: doneOrder.customer_name,
      flatNo: doneOrder.flat_no,
      phone: doneOrder.phone,
      altPhone: doneOrder.alt_phone,
      communityName: doneOrder.community_name,
      blockName: doneOrder.block_name,
      packingNote: doneOrder.packing_note,
      items: doneItems.map((i) => ({
        name: i.product_name,
        unit: i.unit,
        price: i.price,
        quantity: i.quantity,
      })),
      total: doneOrder.total,
      date: new Date(doneOrder.created_at).toLocaleString(),
    });
    if (!ok) alert("Print failed. Please check the printer connection.");
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader title="Checkout" />
        <main className="mx-auto max-w-lg px-4 py-12 text-center sm:py-16">
          <div>
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 sm:mb-8 sm:h-24 sm:w-24">
              <CheckCircle className="h-10 w-10 text-green-600 sm:h-12 sm:w-12" />
            </div>
            <h1 className="text-3xl font-bold sm:text-4xl">Order Placed!</h1>
            <p className="mt-3 text-lg text-muted-foreground sm:text-xl">
              Order ID: <span className="font-mono font-bold text-primary">{done}</span>
            </p>
            <p className="mt-2 text-base text-muted-foreground sm:mt-3 sm:text-lg">
              We'll deliver to your community & block soon.
            </p>
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:gap-4">
            {doneOrder && (
              <>
                {isPrinterConnected() && (
                  <button
                    onClick={btPrint}
                    className="flex items-center justify-center gap-3 rounded-xl bg-green-700 px-6 py-3.5 text-base font-semibold text-white transition hover:bg-green-800 active:scale-[0.98] sm:px-8 sm:py-4 sm:text-lg"
                  >
                    <Bluetooth className="h-5 w-5 sm:h-6 sm:w-6" /> Print via Bluetooth
                  </button>
                )}
                <button
                  onClick={printReceipt}
                  className="flex items-center justify-center gap-3 rounded-xl border bg-card px-6 py-3.5 text-base font-semibold transition hover:shadow-md sm:px-8 sm:py-4 sm:text-lg"
                >
                  <Receipt className="h-5 w-5 sm:h-6 sm:w-6" /> Print Receipt
                </button>
              </>
            )}
            <button
              onClick={() => navigate({ to: "/shop" })}
              className="rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground transition hover:opacity-90 sm:px-8 sm:py-4 sm:text-lg"
            >
              Continue Shopping
            </button>
          </div>
        </main>
        {doneOrder && (
          <div className="thermal-only">
            <div className="thermal-page">
              <div className="thermal-receipt">
                <div style={{ textAlign: "center" }}>
                  <img src="/MM.jpeg" alt="Logo" style={{ height: 48, margin: "0 auto" }} />
                </div>
                <h1 style={{ textAlign: "center", fontSize: 16, letterSpacing: 1 }}>
                  MANAPALLE MUTTON
                </h1>
                <div style={{ textAlign: "center", fontSize: 10, marginBottom: "2mm" }}>
                  {new Date(doneOrder.created_at).toLocaleString()}
                </div>
                <div className="divider-solid" />
                <div
                  className="row"
                  style={{ borderBottom: "1px solid #000", paddingBottom: "1mm" }}
                >
                  <b style={{ fontSize: 13 }}>{doneOrder.customer_name}</b>
                  <b style={{ fontSize: 12 }}>{doneOrder.order_number}</b>
                </div>
                <div style={{ fontSize: 11 }}>
                  Flat: {doneOrder.flat_no || "-"} | {doneOrder.phone}
                </div>
                {doneOrder.alt_phone && (
                  <div style={{ fontSize: 11 }}>Alt: {doneOrder.alt_phone}</div>
                )}
                <div style={{ fontSize: 11 }}>
                  {doneOrder.community_name} / {doneOrder.block_name}
                </div>
                {doneOrder.packing_note && (
                  <div style={{ fontSize: 11, fontWeight: 800, marginTop: "1mm" }}>
                    Note: {doneOrder.packing_note}
                  </div>
                )}
                <div className="divider" />
                <table style={{ marginTop: "1mm" }}>
                  <tbody>
                    {doneItems.map((it, idx) => (
                      <tr key={idx}>
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
                <div className="divider" />
                <div className="row" style={{ fontWeight: 800, fontSize: 13 }}>
                  <span>TOTAL</span>
                  <span>INR {Number(doneOrder.total).toFixed(0)}</span>
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
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Checkout" />
      <main className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
        <Link
          to="/cart"
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground sm:mb-6 sm:text-base"
        >
          <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" /> Back to Cart
        </Link>
        <h1 className="mb-5 text-2xl font-bold sm:mb-6 sm:text-3xl">Checkout</h1>
        <form onSubmit={placeOrder} className="flex flex-col gap-6 lg:flex-row">
          {/* Delivery Form */}
          <div className="min-w-0 flex-1 rounded-2xl border bg-card p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3 sm:mb-6">
              <Truck className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
              <h2 className="text-lg font-semibold sm:text-xl">Delivery Details</h2>
            </div>
            <div className="space-y-4 sm:space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium sm:mb-2 sm:text-base">
                  Your Community
                </label>
                <div className="flex items-center overflow-hidden rounded-xl border bg-background transition focus-within:ring-2 focus-within:ring-primary">
                  <span className="pl-4 sm:pl-5">
                    <MapPin className="h-4 w-4 text-muted-foreground sm:h-5 sm:w-5" />
                  </span>
                  <select
                    value={communityId}
                    onChange={(e) => {
                      setCommunityId(e.target.value);
                      setBlockId("");
                    }}
                    className="w-full bg-transparent px-3 py-3.5 text-sm outline-none sm:px-4 sm:py-4 sm:text-base"
                    required
                  >
                    <option value="">Select your community</option>
                    {communities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium sm:mb-2 sm:text-base">
                  Your Block
                </label>
                <div className="flex items-center overflow-hidden rounded-xl border bg-background transition focus-within:ring-2 focus-within:ring-primary">
                  <span className="pl-4 sm:pl-5">
                    <MapPin className="h-4 w-4 text-muted-foreground sm:h-5 sm:w-5" />
                  </span>
                  <select
                    value={blockId}
                    onChange={(e) => setBlockId(e.target.value)}
                    className="w-full bg-transparent px-3 py-3.5 text-sm outline-none sm:px-4 sm:py-4 sm:text-base"
                    required
                    disabled={!communityId}
                  >
                    <option value="">
                      {communityId ? "Select your block" : "Choose community first"}
                    </option>
                    {blocksForCommunity.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium sm:mb-2 sm:text-base">
                  Flat / House Number
                </label>
                <div className="flex items-center overflow-hidden rounded-xl border bg-background transition focus-within:ring-2 focus-within:ring-primary">
                  <span className="pl-4 sm:pl-5">
                    <Home className="h-4 w-4 text-muted-foreground sm:h-5 sm:w-5" />
                  </span>
                  <input
                    type="text"
                    value={flatNo}
                    onChange={(e) => setFlatNo(e.target.value)}
                    className="w-full bg-transparent px-3 py-3.5 text-sm outline-none sm:px-4 sm:py-4 sm:text-base"
                    placeholder="e.g. 101, A-12"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium sm:mb-2 sm:text-base">
                  Alt Mobile <span className="text-muted-foreground">(optional)</span>
                </label>
                <div className="flex items-center overflow-hidden rounded-xl border bg-background transition focus-within:ring-2 focus-within:ring-primary">
                  <span className="border-r bg-muted px-3 py-3.5 text-sm text-muted-foreground sm:px-4 sm:py-4 sm:text-base">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={altPhone}
                    onChange={(e) => setAltPhone(e.target.value.replace(/\D/g, ""))}
                    className="w-full bg-transparent px-3 py-3.5 text-sm outline-none sm:px-4 sm:py-4 sm:text-base"
                    placeholder="10-digit mobile (optional)"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium sm:mb-2 sm:text-base">
                  Packing Note <span className="text-muted-foreground">(optional)</span>
                </label>
                <div className="flex items-start overflow-hidden rounded-xl border bg-background transition focus-within:ring-2 focus-within:ring-primary">
                  <span className="pt-3.5 pl-4 sm:pt-4 sm:pl-5">
                    <FileText className="h-4 w-4 text-muted-foreground sm:h-5 sm:w-5" />
                  </span>
                  <textarea
                    value={packingNote}
                    onChange={(e) => setPackingNote(e.target.value)}
                    className="w-full bg-transparent px-3 py-3.5 text-sm outline-none sm:px-4 sm:py-4 sm:text-base"
                    placeholder="Low fat, small pieces, etc."
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="w-full shrink-0 lg:w-[360px]">
            <div className="rounded-2xl border bg-card p-5 lg:sticky lg:top-24 sm:p-6">
              <h2 className="mb-4 text-lg font-semibold sm:mb-5 sm:text-xl">Order Summary</h2>
              <div className="max-h-60 space-y-3 overflow-y-auto sm:max-h-72 sm:space-y-4">
                {items.map((i) => (
                  <div key={i.product_id} className="flex justify-between text-sm sm:text-base">
                    <span className="text-muted-foreground">
                      {i.name} x {i.quantity} {i.unit}
                    </span>
                    <span className="font-medium">INR {(i.price * i.quantity).toFixed(0)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t pt-4 sm:mt-5 sm:pt-5">
                <div className="flex justify-between text-sm sm:text-base">
                  <span className="text-muted-foreground">Delivery</span>
                  <span className="font-medium text-green-700">Free</span>
                </div>
                <div className="mt-2 flex justify-between text-lg font-bold sm:mt-3 sm:text-xl">
                  <span>Total</span>
                  <span className="text-primary">INR {total.toFixed(0)}</span>
                </div>
              </div>
              {error && (
                <div className="mt-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive sm:mt-4 sm:px-5 sm:py-4 sm:text-base">
                  {error}
                </div>
              )}
              <button
                disabled={placeOrderMutation.isPending}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-foreground transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50 sm:mt-6 sm:py-4 sm:text-lg"
              >
                {placeOrderMutation.isPending ? "Placing Order..." : "Place Order"}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
