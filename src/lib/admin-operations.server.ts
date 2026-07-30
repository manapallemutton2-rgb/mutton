import { createServerFn } from "@tanstack/react-start";

async function getAdminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type ProductUpdateInput = {
  id: string;
  updates: Record<string, unknown>;
};

export const adminUpdateProduct = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as Record<string, unknown>;
    if (typeof d.id !== "string") throw new Error("Invalid product id");
    return {
      id: d.id,
      updates: d.updates as Record<string, unknown>,
    };
  })
  .handler(async ({ data }) => {
    const admin = await getAdminClient();
    const { error } = await admin
      .from("products")
      .update(data.updates as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const adminDeleteProduct = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as Record<string, unknown>;
    if (typeof d.id !== "string") throw new Error("Invalid product id");
    return { id: d.id };
  })
  .handler(async ({ data }) => {
    const admin = await getAdminClient();
    const { error } = await admin.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const adminInsertProduct = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as Record<string, unknown>;
    const stock = d.stock !== undefined && d.stock !== "" ? Number(d.stock) : null;
    return {
      name: String(d.name || ""),
      unit: String(d.unit || "kg"),
      price: Number(d.price),
      image_url: d.image_url ? String(d.image_url) : null,
      stock: stock,
      active: true,
    };
  })
  .handler(async ({ data }) => {
    const admin = await getAdminClient();
    const { error } = await admin.from("products").insert(data);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const adminUpdateSettings = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as Record<string, unknown>;
    if (typeof d.key !== "string") throw new Error("Invalid settings key");
    return {
      key: d.key,
      value: String(d.value || ""),
    };
  })
  .handler(async ({ data }) => {
    const admin = await getAdminClient();
    const { error } = await admin.from("settings").upsert({ key: data.key, value: data.value });
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const adminInsertCommunity = createServerFn({ method: "POST" })
  .validator((data: unknown) => ({ name: String((data as Record<string, unknown>).name || "") }))
  .handler(async ({ data }) => {
    const admin = await getAdminClient();
    const { error } = await admin.from("communities").insert({ name: data.name });
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const adminDeleteCommunity = createServerFn({ method: "POST" })
  .validator((data: unknown) => ({ id: String((data as Record<string, unknown>).id || "") }))
  .handler(async ({ data }) => {
    const admin = await getAdminClient();
    const { error } = await admin.from("communities").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const adminInsertBlock = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as Record<string, unknown>;
    return { community_id: String(d.community_id), name: String(d.name) };
  })
  .handler(async ({ data }) => {
    const admin = await getAdminClient();
    const { error } = await admin.from("blocks").insert(data);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const adminDeleteBlock = createServerFn({ method: "POST" })
  .validator((data: unknown) => ({ id: String((data as Record<string, unknown>).id || "") }))
  .handler(async ({ data }) => {
    const admin = await getAdminClient();
    const { error } = await admin.from("blocks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const adminDeleteOrder = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as Record<string, unknown>;
    if (typeof d.id !== "string") throw new Error("Invalid order id");
    return { id: d.id };
  })
  .handler(async ({ data }) => {
    const admin = await getAdminClient();
    const { error } = await admin.from("orders").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const adminDeleteAllOrders = createServerFn({ method: "POST" })
  .validator(() => ({}))
  .handler(async () => {
    const admin = await getAdminClient();
    const { error } = await admin.from("orders").delete().neq("id", "");
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const adminRemoveProductImage = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as Record<string, unknown>;
    if (typeof d.productId !== "string") throw new Error("Invalid product id");
    return {
      productId: d.productId,
      imageUrl: typeof d.imageUrl === "string" ? d.imageUrl : null,
    };
  })
  .handler(async ({ data }) => {
    const admin = await getAdminClient();

    // Delete the file from storage if imageUrl is provided
    if (data.imageUrl) {
      const storageUrl = data.imageUrl;
      const bucket = "product-images";
      const filePath = storageUrl.split(`/${bucket}/`)[1];
      if (filePath) {
        await admin.storage.from(bucket).remove([filePath]);
      }
    }

    // Set image_url to null in the database
    const { error } = await admin
      .from("products")
      .update({ image_url: null })
      .eq("id", data.productId);
    if (error) throw new Error(error.message);
    return { success: true };
  });
