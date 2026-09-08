import { createServerFn } from "@tanstack/react-start";
import { timingSafeEqual } from "crypto";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export const validateAdminLogin = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (typeof data !== "object" || !data) throw new Error("Invalid request");
    const d = data as Record<string, unknown>;
    if (typeof d.adminId !== "string" || typeof d.password !== "string") {
      throw new Error("Invalid credentials format");
    }
    return { adminId: d.adminId, password: d.password };
  })
  .handler(async ({ data }) => {
    const adminId = process.env.ADMIN_ID;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminId || !adminPassword) {
      console.error("ADMIN_ID and ADMIN_PASSWORD environment variables must be set");
      return { valid: false, error: "Server configuration error" };
    }

    const valid = safeCompare(data.adminId, adminId) && safeCompare(data.password, adminPassword);
    return {
      valid,
      error: valid ? undefined : "Invalid admin credentials",
    };
  });

export const checkAdminSession = createServerFn({ method: "GET" }).handler(async () => {
  return {
    configured: !!process.env.ADMIN_PASSWORD,
  };
});
