import { createServerFn } from "@tanstack/react-start";

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
    const adminId = process.env.ADMIN_ID || "manapalle";
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      console.error("ADMIN_PASSWORD environment variable is not set");
      return { valid: false, error: "Server configuration error" };
    }

    const valid = data.adminId === adminId && data.password === adminPassword;
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
