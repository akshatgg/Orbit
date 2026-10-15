"use client";

import { createClient } from "./supabase/client";

export type ImageBucket = "event-covers" | "organiser-logos";

/**
 * Uploads an image to Supabase Storage under <bucket>/<user id>/… and returns its public URL.
 * Call from Client Components (forms with <input type="file">).
 */
export async function uploadImage(bucket: ImageBucket, file: File): Promise<string> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in to upload images");
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file");
  const max = bucket === "event-covers" ? 5 : 2;
  if (file.size > max * 1024 * 1024) throw new Error(`Image must be under ${max} MB`);

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${auth.user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
