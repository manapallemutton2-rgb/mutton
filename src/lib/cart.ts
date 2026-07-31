export type CartItem = {
  product_id: string;
  name: string;
  unit: string;
  price: number;
  quantity: number;
};
import { getPhone } from "@/lib/session";

const BASE_KEY = "mm_cart";

const UNIT_TO_KG: Record<string, number> = {
  "500g": 0.5,
  "750g": 0.75,
  "1kg": 1,
};

export function unitToKg(unit: string, quantity: number): number {
  if (unit === "piece" || unit === "dozen" || unit === "tray") return quantity;
  const kg = UNIT_TO_KG[unit];
  return kg != null ? kg * quantity : quantity;
}

export function getCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  // Clean up legacy shared cart key if present
  if (localStorage.getItem(BASE_KEY)) {
    localStorage.removeItem(BASE_KEY);
  }
  const phone = getPhone();
  if (!phone) return [];
  const key = `${BASE_KEY}_${phone.trim()}`;
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  const phone = getPhone();
  if (!phone) return;
  const key = `${BASE_KEY}_${phone.trim()}`;
  localStorage.setItem(key, JSON.stringify(items));
  window.dispatchEvent(new Event("cart-updated"));
}

function cartKey(item: { product_id: string; unit: string }) {
  return item.product_id + "|" + item.unit;
}

export function addToCart(item: Omit<CartItem, "quantity">, qty = 1) {
  const phone = getPhone();
  if (!phone) return;
  const cart = getCart();
  const existing = cart.find((c) => c.product_id === item.product_id && c.unit === item.unit);
  if (existing) {
    existing.quantity += qty;
  } else {
    cart.push({ ...item, quantity: qty });
  }
  saveCart(cart);
}

export function updateQty(product_id: string, unit: string, quantity: number) {
  const phone = getPhone();
  if (!phone) return;
  const cart = getCart()
    .map((c) => (cartKey(c) === cartKey({ product_id, unit }) ? { ...c, quantity } : c))
    .filter((c) => c.quantity > 0);
  saveCart(cart);
}

export function removeFromCart(product_id: string, unit: string) {
  const phone = getPhone();
  if (!phone) return;
  saveCart(getCart().filter((c) => cartKey(c) !== cartKey({ product_id, unit })));
}

export function clearCart() {
  saveCart([]);
}

export function cartTotal(items: CartItem[]) {
  return items.reduce((s, i) => s + i.price * i.quantity, 0);
}
