export type CartItem = {
  product_id: string;
  name: string;
  unit: string;
  price: number;
  quantity: number;
};
import { getPhone } from "@/lib/session";

const BASE_KEY = "mm_cart";

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

export function addToCart(item: Omit<CartItem, "quantity">, qty = 1) {
  const phone = getPhone();
  if (!phone) return;
  const cart = getCart();
  const existing = cart.find((c) => c.product_id === item.product_id);
  if (existing) {
    existing.quantity += qty;
  } else {
    cart.push({ ...item, quantity: qty });
  }
  saveCart(cart);
}

export function updateQty(product_id: string, quantity: number) {
  const phone = getPhone();
  if (!phone) return;
  const cart = getCart()
    .map((c) => (c.product_id === product_id ? { ...c, quantity } : c))
    .filter((c) => c.quantity > 0);
  saveCart(cart);
}

export function removeFromCart(product_id: string) {
  const phone = getPhone();
  if (!phone) return;
  saveCart(getCart().filter((c) => c.product_id !== product_id));
}

export function clearCart() {
  saveCart([]);
}

export function cartTotal(items: CartItem[]) {
  return items.reduce((s, i) => s + i.price * i.quantity, 0);
}
