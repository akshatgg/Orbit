"use client";

import { signImageUpload, type ImageBucket } from "./storage-actions";

export type { ImageBucket };

const MAX_MB: Record<ImageBucket, number> = { "event-covers": 5, "organiser-logos": 2 };
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Uploads an image and returns its public URL. The Orbit API signs the upload
 * (`POST /uploads/sign`, through a server action) and the browser sends the file
 * straight to Cloudinary into `orbit/<kind>/<user id>/`.
 * Call from Client Components (forms with <input type="file">).
 */
export async function uploadImage(bucket: ImageBucket, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file");
  if (!TYPES.includes(file.type)) throw new Error("Use a JPG, PNG or WebP image");
  const max = MAX_MB[bucket];
  if (file.size > max * 1024 * 1024) throw new Error(`Image must be under ${max} MB`);

  let signed: Awaited<ReturnType<typeof signImageUpload>>;
  try {
    signed = await signImageUpload(bucket);
  } catch {
    throw new Error("Couldn't reach the server — check your connection and try again");
  }
  if (!signed.ok) throw new Error(signed.error);
  const sig = signed.signature;
  if (sig.maxBytes && file.size > sig.maxBytes) {
    throw new Error(`Image must be under ${Math.floor(sig.maxBytes / (1024 * 1024))} MB`);
  }

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("signature", sig.signature);
  form.append("folder", sig.folder);
  form.append("allowed_formats", sig.allowedFormats);

  let up: Response;
  try {
    up = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, { method: "POST", body: form });
  } catch {
    throw new Error("Upload failed — check your connection and try again");
  }
  const data = (await up.json().catch(() => null)) as { secure_url?: string; error?: { message?: string } } | null;
  if (!up.ok || !data?.secure_url) throw new Error(data?.error?.message ?? "Upload failed — try another image");
  return data.secure_url;
}
