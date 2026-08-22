import { createServerFn } from "@tanstack/react-start";

async function getAdminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type OrderItemInput = {
  product_id: string;
  product_name: string;
  unit: string;
  price: number;
  quantity: number;
};

type OrderInput = {
  phone: string;
  customer_name: string;
  flat_no: string;
  alt_phone: string | null;
  packing_note: string | null;
  community_id: string;
  block_id: string;
  community_name: string;
  block_name: string;
  total: number;
};

export const placeOrderWithStockCheck = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as { order: OrderInput; items: OrderItemInput[] };
    if (!d.order || !d.items || d.items.length === 0) {
      throw new Error("Invalid order data");
    }
    return d;
  })
  .handler(async ({ data }) => {
    const admin = await getAdminClient();
    const { order, items } = data;

    // 1. Create the order
    const { data: createdOrder, error: oErr } = await admin
      .from("orders")
      .insert({
        phone: order.phone,
        customer_name: order.customer_name,
        flat_no: order.flat_no,
        alt_phone: order.alt_phone,
        packing_note: order.packing_note,
        community_id: order.community_id,
        block_id: order.block_id,
        community_name: order.community_name,
        block_name: order.block_name,
        total: order.total,
        status: "pending",
      })
      .select()
      .single();

    if (oErr || !createdOrder) {
      throw new Error(oErr?.message || "Failed to create order");
    }

    // 2. Insert order items
    const orderItems = items.map((i) => ({
      order_id: createdOrder.id,
      product_id: i.product_id,
      product_name: i.product_name,
      unit: i.unit,
      price: i.price,
      quantity: i.quantity,
    }));

    const { error: iErr } = await admin.from("order_items").insert(orderItems);
    if (iErr) {
      // Rollback: delete order (cascade deletes order_items)
      await admin.from("orders").delete().eq("id", createdOrder.id);
      throw new Error(iErr.message);
    }

    // 3. Atomically deduct stock for each item (only if stock IS NOT NULL)
    // Convert order quantity to product's stock unit before deducting
    const UNIT_TO_KG: Record<string, number> = {
      "500g": 0.5,
      "750g": 0.75,
      "1kg": 1,
      kg: 1,
    };

    const deducted: { product_id: string; quantity: number }[] = [];

    const callRpc = (fn: string, params: Record<string, unknown>) =>
      (
        admin as unknown as {
          rpc: (
            fn: string,
            params: Record<string, unknown>,
          ) => Promise<{ data: unknown; error: unknown }>;
        }
      ).rpc(fn, params);

    for (const item of items) {
      // Fetch the product's unit to know how to convert quantity
      const { data: product } = await admin
        .from("products")
        .select("unit")
        .eq("id", item.product_id)
        .single();

      const productUnit = product?.unit || "kg";
      const isPiece = productUnit === "piece" || productUnit === "dozen" || productUnit === "tray";
      const convertedQty = isPiece
        ? item.quantity
        : item.quantity * (UNIT_TO_KG[item.unit] ?? 1);

      const { data: updated, error: sErr } = await callRpc("deduct_product_stock", {
        p_product_id: item.product_id,
        p_quantity: convertedQty,
      });

      if (sErr) {
        for (const d of deducted) {
          await callRpc("restore_product_stock", {
            p_product_id: d.product_id,
            p_quantity: d.quantity,
          });
        }
        await admin.from("orders").delete().eq("id", createdOrder.id);
        throw new Error(`Stock error: ${(sErr as { message?: string })?.message || "Unknown"}`);
      }

      const result = Array.isArray(updated)
        ? (updated as Record<string, unknown>[])[0]
        : (updated as Record<string, unknown>);
      if (!result || !result.success) {
        for (const d of deducted) {
          await callRpc("restore_product_stock", {
            p_product_id: d.product_id,
            p_quantity: d.quantity,
          });
        }
        await admin.from("orders").delete().eq("id", createdOrder.id);
        const productName = (result?.product_name as string) || item.product_name;
        throw new Error(
          `Insufficient stock for "${productName}". Only ${(result?.available ?? 0) as number} available.`,
        );
      }

      deducted.push({ product_id: item.product_id, quantity: convertedQty });
    }

    return { success: true, orderNumber: createdOrder.order_number };
  });
