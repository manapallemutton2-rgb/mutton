export type WhatsAppOrderItem = {
  product_name: string;
  unit: string;
  price: number;
  quantity: number;
};

export type WhatsAppOrder = {
  order_number: string;
  customer_name: string;
  flat_no: string;
  phone: string;
  community_name: string;
  block_name: string;
  total: number;
  packing_note?: string | null;
};

/** Shop number – override with VITE_SHOP_WHATSAPP_NUMBER (digits only, with country code). */
export const SHOP_WHATSAPP_NUMBER =
  (import.meta as unknown as { env?: Record<string, string> })?.env
    ?.VITE_SHOP_WHATSAPP_NUMBER || "919030901233";

export const SHOP_DISPLAY_NUMBER = "9030 90 1233";

/** Normalize Indian customer phone to 91XXXXXXXXXX for WhatsApp API. */
export function normalizeToWhatsAppId(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return "91" + digits.slice(1);
  if (digits.length === 10) return "91" + digits;
  return digits;
}

/** Thank-you message with full order details. */
export function buildOrderThankYouMessage(
  order: WhatsAppOrder,
  items: WhatsAppOrderItem[],
): string {
  const lines = items.map((i) => {
    const amt = Math.round(Number(i.price) * Number(i.quantity));
    return `• ${i.product_name} (${i.unit} x${i.quantity}) - Rs.${amt}`;
  });

  const parts = [
    `Hello ${order.customer_name || "Customer"}! 🙏`,
    `Thank you for ordering from *MANAPALLE PRODUCTS*!`,
    ``,
    `🧾 Order ID: ${order.order_number}`,
    `📍 ${order.flat_no}, ${order.community_name} / ${order.block_name}`,
    ...(order.packing_note ? [`📝 Note: ${order.packing_note}`] : []),
    ``,
    `Your order:`,
    ...lines,
    ``,
    `*Total: Rs.${Math.round(Number(order.total))}* (Free delivery)`,
    ``,
    `We will deliver soon. Need help? Call ${SHOP_DISPLAY_NUMBER}.`,
    `Thank you! Visit again! 🙏`,
  ];
  return parts.join("\n");
}

/** wa.me click-to-chat link. Use shop number so the customer can confirm with one tap (works today, no API needed). */
export function buildShopWaLink(message: string, shopNumber = SHOP_WHATSAPP_NUMBER): string {
  return `https://wa.me/${shopNumber}?text=${encodeURIComponent(message)}`;
}

/** Direct chat link with the customer (useful for admin resend). */
export function buildCustomerWaLink(customerPhone: string, message: string): string {
  return `https://wa.me/${normalizeToWhatsAppId(customerPhone)}?text=${encodeURIComponent(message)}`;
}
