import { createServerFn } from "@tanstack/react-start";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

const MAX_BASE64_LENGTH = 10 * 1024 * 1024 * (4 / 3); // ~10MB decoded

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 200);
}

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
    if (!ALLOWED_MIME_TYPES.includes(d.contentType)) {
      throw new Error(
        `Invalid file type: ${d.contentType}. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
      );
    }
    if (d.base64.length > MAX_BASE64_LENGTH) {
      throw new Error("File too large. Maximum size is 10MB.");
    }
    return {
      fileName: sanitizeFileName(d.fileName),
      base64: d.base64,
      contentType: d.contentType,
    };
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
