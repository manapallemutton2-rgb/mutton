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
    const updates = { ...(d.updates as Record<string, unknown>) };
    // Sanitize + validate partial updates so bad input fails fast with a clear message.
    if (updates.name !== undefined) {
      const name = String(updates.name || "").trim();
      if (!name) throw new Error("Product name is required");
      updates.name = name;
    }
    if (updates.price !== undefined) {
      const price = Number(updates.price);
      if (!Number.isFinite(price) || price <= 0)
        throw new Error("Price must be a number greater than 0");
      updates.price = price;
    }
    if (updates.stock !== undefined) {
      if (updates.stock === "" || updates.stock === null) {
        updates.stock = null;
      } else {
        const stock = Number(updates.stock);
        if (!Number.isFinite(stock) || stock < 0)
          throw new Error("Stock must be 0 or more (empty = unlimited)");
        updates.stock = stock;
      }
    }
    if (updates.priority !== undefined) {
      if (updates.priority === "" || updates.priority === null) {
        updates.priority = null;
      } else {
        const priority = Number(updates.priority);
        if (!Number.isInteger(priority) || priority < 1)
          throw new Error("Priority must be a positive whole number (1 = first)");
        updates.priority = priority;
      }
    }
    if (updates.category !== undefined) {
      const category = String(updates.category || "")
        .trim()
        .toLowerCase();
      if (!category) throw new Error("Category is required");
      updates.category = category;
    }
    if (updates.subcategory !== undefined) {
      updates.subcategory = updates.subcategory ? String(updates.subcategory) : null;
    }
    return {
      id: d.id,
      updates,
    };
  })
  .handler(async ({ data }) => {
    const admin = await getAdminClient();

    // NOTE: duplicate priorities are allowed (sorted stably by priority, then name).
    // Previously this threw and blocked saving — that was the #1 "cannot add/edit product" complaint.

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
    const name = String(d.name || "").trim();
    if (!name) throw new Error("Product name is required");
    const category = String(d.category || "")
      .trim()
      .toLowerCase();
    if (!category) throw new Error("Category is required — please select a category");
    const price = Number(d.price);
    if (!Number.isFinite(price) || price <= 0)
      throw new Error("Price must be a number greater than 0");
    const allowedUnits = ["kg", "dozen", "piece", "tray"];
    const unit = String(d.unit || "kg");
    if (!allowedUnits.includes(unit))
      throw new Error(`Invalid unit. Allowed: ${allowedUnits.join(", ")}`);
    let stock: number | null = null;
    if (d.stock !== undefined && d.stock !== "" && d.stock !== null) {
      stock = Number(d.stock);
      if (!Number.isFinite(stock) || stock < 0)
        throw new Error("Stock must be 0 or more (empty = unlimited)");
    }
    let priority: number | null = null;
    if (d.priority !== undefined && d.priority !== "" && d.priority !== null) {
      priority = Number(d.priority);
      if (!Number.isInteger(priority) || priority < 1)
        throw new Error("Priority must be a positive whole number (1 = first)");
    }
    return {
      name,
      unit,
      price,
      image_url: d.image_url ? String(d.image_url) : null,
      stock,
      active: true,
      category,
      subcategory: d.subcategory ? String(d.subcategory) : null,
      priority,
    };
  })
  .handler(async ({ data }) => {
    const admin = await getAdminClient();

    // Auto-resolve priority collisions instead of throwing: previously any reused
    // priority blocked the insert with "already used". Now bump to max+1 in category.
    let insertData = { ...data };
    if (insertData.priority != null) {
      const { data: existing } = await admin
        .from("products")
        .select("id")
        .eq("category", insertData.category)
        .eq("priority", insertData.priority)
        .limit(1);
      if (existing && existing.length > 0) {
        const { data: siblings } = await admin
          .from("products")
          .select("priority")
          .eq("category", insertData.category);
        const max = Math.max(
          0,
          ...((siblings as { priority: number | null }[] | null) || []).map((s) => s.priority ?? 0),
        );
        insertData = { ...insertData, priority: max + 1 };
      }
    }

    const { error } = await admin.from("products").insert(insertData);
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

// Category operations
export const adminInsertCategory = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as Record<string, unknown>;
    const name = String(d.name || "").trim();
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    const priority = d.priority === undefined || d.priority === "" ? null : Number(d.priority);
    if (
      priority !== undefined &&
      priority !== null &&
      (!Number.isInteger(priority) || priority < 1)
    ) {
      throw new Error("Priority must be a positive whole number");
    }
    return { name, slug, priority, image_url: d.image_url ? String(d.image_url) : null };
  })
  .handler(async ({ data }) => {
    const admin = await getAdminClient();
    const { error } = await admin.from("categories").insert({
      name: data.name,
      slug: data.slug,
      priority: data.priority,
      image_url: data.image_url,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const adminUpdateCategory = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as Record<string, unknown>;
    if (typeof d.id !== "string") throw new Error("Invalid category id");
    const priority =
      d.priority === undefined ? undefined : d.priority === "" ? null : Number(d.priority);
    if (
      priority !== undefined &&
      priority !== null &&
      (!Number.isInteger(priority) || priority < 1)
    ) {
      throw new Error("Priority must be a positive whole number");
    }
    return {
      id: d.id,
      priority,
      image_url: d.image_url === undefined ? undefined : d.image_url ? String(d.image_url) : null,
    };
  })
  .handler(async ({ data }) => {
    const admin = await getAdminClient();
    const updates = {
      ...(data.priority !== undefined && { priority: data.priority }),
      ...(data.image_url !== undefined && { image_url: data.image_url }),
    };
    const { error } = await admin.from("categories").update(updates).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const adminInsertSubcategory = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as Record<string, unknown>;
    const name = String(d.name || "").trim();
    const category_slug = String(d.category_slug || "").trim();
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    const priority = d.priority === undefined || d.priority === "" ? null : Number(d.priority);
    if (!name || !category_slug) throw new Error("Category and subcategory name are required");
    if (priority !== null && (!Number.isInteger(priority) || priority < 1)) {
      throw new Error("Priority must be a positive whole number");
    }
    return { name, category_slug, slug, priority };
  })
  .handler(async ({ data }) => {
    const admin = await getAdminClient();

    // Allow duplicate priorities (sorted stably) — previously blocked inserts.

    const { error } = await admin.from("subcategories").insert(data);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const adminUpdateSubcategory = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as Record<string, unknown>;
    const id = String(d.id || "").trim();
    if (!id) throw new Error("Subcategory ID is required");
    const updates: Record<string, unknown> = {};
    if (d.priority !== undefined) {
      const v = d.priority === "" || d.priority === null ? null : Number(d.priority);
      if (v !== null && (!Number.isInteger(v) || v < 1)) {
        throw new Error("Priority must be a positive whole number");
      }
      updates.priority = v;
    }
    return { id, updates };
  })
  .handler(async ({ data }) => {
    const admin = await getAdminClient();

    // Allow duplicate priorities — previously blocked saves.

    const { error } = await admin
      .from("subcategories")
      .update(data.updates as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const adminDeleteSubcategory = createServerFn({ method: "POST" })
  .validator((data: unknown) => ({ id: String((data as Record<string, unknown>).id || "") }))
  .handler(async ({ data }) => {
    const admin = await getAdminClient();
    const { error } = await admin.from("subcategories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const adminDeleteCategory = createServerFn({ method: "POST" })
  .validator((data: unknown) => ({ id: String((data as Record<string, unknown>).id || "") }))
  .handler(async ({ data }) => {
    const admin = await getAdminClient();
    const { error } = await admin.from("categories").delete().eq("id", data.id);
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

    // Delete order items first so this works even if the hosted DB's
    // foreign key from order_items -> orders lacks ON DELETE CASCADE.
    const { error: itemsError } = await admin.from("order_items").delete().not("id", "is", null);
    if (itemsError) throw new Error(itemsError.message);

    // Delete all orders. Use `not("id", "is", null)` (id IS NOT NULL) rather
    // than `neq("id", "")` â€” comparing a uuid column to an empty string makes
    // Postgres raise "invalid input syntax for type uuid", so nothing gets deleted.
    const { error } = await admin.from("orders").delete().not("id", "is", null);
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
