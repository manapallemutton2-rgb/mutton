const KEY_PHONE = "mm_session_phone";
const KEY_NAME = "mm_session_name";
const KEY_ROLE = "mm_session_role";

export type UserRole = "user" | "admin";

export function getPhone(): string | null {
  if (typeof window === "undefined") return null;
  const val = localStorage.getItem(KEY_PHONE);
  return val ? val.trim() : null;
}

export function getName(): string | null {
  if (typeof window === "undefined") return null;
  const val = localStorage.getItem(KEY_NAME);
  return val ? val.trim() : null;
}

export function getRole(): UserRole | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY_ROLE) as UserRole | null;
}

export function setSession(name: string, phone: string, role: UserRole) {
  const cleanPhone = phone.trim();
  const cleanName = name.trim();
  localStorage.setItem(KEY_PHONE, cleanPhone);
  localStorage.setItem(KEY_NAME, cleanName);
  localStorage.setItem(KEY_ROLE, role);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("session-updated"));
    window.dispatchEvent(new Event("cart-updated"));
  }
}

export function clearSession() {
  localStorage.removeItem(KEY_PHONE);
  localStorage.removeItem(KEY_NAME);
  localStorage.removeItem(KEY_ROLE);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("session-updated"));
    window.dispatchEvent(new Event("cart-updated"));
  }
}
