import { createServerFn } from "@tanstack/react-start";

export const adminUploadImage = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as Record<string, unknown>;
    if (
      typeof d.fileName !== "string" ||
      typeof d.base64 !== "string" ||
      typeof d.contentType !== "string"
    ) {
      throw new Error("Invalid upload data");
    }
    return { fileName: d.fileName, base64: d.base64, contentType: d.contentType };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const binaryStr = atob(data.base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const { data: uploadData, error } = await supabaseAdmin.storage
      .from("product-images")
      .upload(data.fileName, bytes, {
        contentType: data.contentType,
        upsert: true,
      });

    if (error) throw new Error(error.message);

    const publicUrl = supabaseAdmin.storage.from("product-images").getPublicUrl(uploadData.path)
      .data.publicUrl;

    return { publicUrl };
  });
