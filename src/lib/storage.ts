"use client";

import { createClient } from "./supabase/client";

export type ImageBucket = "event-covers" | "organiser-logos";

const MAX_MB: Record<ImageBucket, number> = { "event-covers": 5, "organiser-logos": 2 };
const TYPES = ["image/jpeg", "image/png", "image/webp"];

type Signature = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  allowedFormats: string;
};

/**
 * Uploads an image and returns its public URL. Goes to Cloudinary with a server-signed upload;
 * if Cloudinary isn't configured (sign endpoint answers 503) it falls back to Supabase Storage.
 * Call from Client Components (forms with <input type="file">).
 */
export async function uploadImage(bucket: ImageBucket, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file");
  if (!TYPES.includes(file.type)) throw new Error("Use a JPG, PNG or WebP image");
  const max = MAX_MB[bucket];
  if (file.size > max * 1024 * 1024) throw new Error(`Image must be under ${max} MB`);

  let res: Response;
  try {
    res = await fetch("/api/uploads/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: bucket }),
    });
  } catch {
    throw new Error("Couldn't reach the server — check your connection and try again");
  }
  if (res.status === 503) return uploadToSupabase(bucket, file);
  if (res.status === 401) throw new Error("Sign in to upload images");
  if (!res.ok) throw new Error("Couldn't start the upload — try again");
  const sig = (await res.json()) as Signature;

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

/** Fallback for environments without Cloudinary credentials. */
async function uploadToSupabase(bucket: ImageBucket, file: File): Promise<string> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in to upload images");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${auth.user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
