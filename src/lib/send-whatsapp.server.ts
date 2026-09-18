import { createServerFn } from "@tanstack/react-start";

type OrderItemInput = {
  product_name: string;
  unit: string;
  price: number;
  quantity: number;
};

type SendInput = {
  phone: string;
  customer_name: string;
  order_number: string;
  flat_no: string;
  community_name: string;
  block_name: string;
  total: number;
  packing_note?: string | null;
  items: OrderItemInput[];
};

function normalizeTo91(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return "91" + digits.slice(1);
  if (digits.length === 10) return "91" + digits;
  return digits;
}

function buildMessage(order: SendInput): string {
  const lines = order.items.map((i) => {
    const amt = Math.round(Number(i.price) * Number(i.quantity));
    return `• ${i.product_name} (${i.unit} x${i.quantity}) - Rs.${amt}`;
  });
  return [
    `Hello ${order.customer_name || "Customer"}!`,
    `Thank you for ordering from MANAPALLE PRODUCTS!`,
    ``,
    `Order ID: ${order.order_number}`,
    `${order.flat_no}, ${order.community_name} / ${order.block_name}`,
    ...(order.packing_note ? [`Note: ${order.packing_note}`] : []),
    ``,
    `Your order:`,
    ...lines,
    ``,
    `Total: Rs.${Math.round(Number(order.total))} (Free delivery)`,
    ``,
    `We will deliver soon. Need help? Call 9030 90 1233.`,
    `Thank you! Visit again!`,
  ].join("\n");
}

/**
 * Auto-send thank-you + order details to the CUSTOMER's WhatsApp via AiSensy.
 *
 * Server env (in .env.local, never exposed to browser):
 *   AISENSY_API_KEY=...        (Manage > API Key in AiSensy dashboard)
 *   AISENSY_CAMPAIGN_NAME=...  (exact name of your LIVE API campaign, e.g. order_confirmation)
 *
 * AiSensy endpoint: POST https://backend.aisensy.com/campaign/t1/api/v2
 * Your template's {{params}} are filled from templateParams below.
 * If env is missing it returns not-configured and the client shows the
 * one-tap "Get bill on WhatsApp" button instead — ordering never breaks.
 */
export const sendOrderWhatsApp = createServerFn({ method: "POST" })
  .validator((data: unknown) => data as SendInput)
  .handler(async ({ data }) => {
    const message = buildMessage(data);
    const destination = normalizeTo91(data.phone);
    const shopNumber = process.env.SHOP_WHATSAPP_NUMBER || "919030901233";
    const waLink = `https://wa.me/${shopNumber}?text=${encodeURIComponent(message)}`;

    const apiKey = process.env.AISENSY_API_KEY;
    const campaignName = process.env.AISENSY_CAMPAIGN_NAME;

    if (!apiKey || !campaignName) {
      return { sent: false, reason: "not-configured" as const, waLink, message };
    }

    // Short item summary for the template (template params have length limits)
    const itemsSummary = data.items
      .map((i) => `${i.product_name} ${i.unit} x${i.quantity}`)
      .join(", ")
      .slice(0, 250);
    const totalStr = `Rs.${Math.round(Number(data.total))}`;

    try {
      const res = await fetch("https://backend.aisensy.com/campaign/t1/api/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          campaignName,
          destination,
          userName: data.customer_name || "Customer",
          templateParams: [data.customer_name || "Customer", data.order_number, itemsSummary, totalStr],
          source: process.env.AISENSY_SOURCE || "website-order",
          attributes: {
            order_number: data.order_number,
            total: totalStr,
            flat_no: data.flat_no,
            community: data.community_name,
            block: data.block_name,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("[AiSensy] send failed:", JSON.stringify(json));
        const detail =
          (json as { message?: string; error?: string })?.message ||
          (json as { error?: string })?.error ||
          `HTTP ${res.status}`;
        return { sent: false, reason: "api-error" as const, detail, waLink, message };
      }
      const ok = (json as { success?: boolean })?.success !== false;
      if (!ok) {
        console.error("[AiSensy] rejected:", JSON.stringify(json));
        return {
          sent: false,
          reason: "api-error" as const,
          detail: JSON.stringify(json).slice(0, 300),
          waLink,
          message,
        };
      }
      return { sent: true as const, reason: "sent" as const, waLink, message };
    } catch (e) {
      console.error("[AiSensy] send exception:", e);
      return {
        sent: false,
        reason: "exception" as const,
        detail: e instanceof Error ? e.message : "Unknown",
        waLink,
        message,
      };
    }
  });
