"use client";

import type { AttachmentInput } from "@/types/social";
import { signImageUpload, type ImageBucket, type UploadSignature } from "./storage-actions";

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

  const data = await postToCloudinary(sig, file, "Upload failed — try another image");
  return data.secure_url;
}

type CloudinaryFile = { secure_url: string; public_id: string; bytes?: number; width?: number; height?: number };

/** Sends the file straight to Cloudinary with the API's signature. Throws a sentence to show. */
async function postToCloudinary(sig: UploadSignature, file: File, fallback: string): Promise<CloudinaryFile> {
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("signature", sig.signature);
  form.append("folder", sig.folder);
  form.append("allowed_formats", sig.allowedFormats);

  let up: Response;
  try {
    up = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/${sig.resourceType ?? "image"}/upload`, { method: "POST", body: form });
  } catch {
    throw new Error("Upload failed — check your connection and try again");
  }
  const data = (await up.json().catch(() => null)) as (Partial<CloudinaryFile> & { error?: { message?: string } }) | null;
  if (!up.ok || !data?.secure_url || !data.public_id) throw new Error(data?.error?.message ?? fallback);
  return data as CloudinaryFile;
}

/**
 * Uploads a chat attachment (an image up to 5 MB or a PDF up to 10 MB, into `orbit/chat/<user id>/`)
 * and returns what `sendMessage` takes. Throws a sentence to show next to the file.
 */
export async function uploadChatAttachment(kind: AttachmentInput["kind"], file: File): Promise<AttachmentInput> {
  const doc = kind === "doc";
  if (doc ? file.type !== "application/pdf" || !/\.pdf$/i.test(file.name) : !TYPES.includes(file.type)) {
    throw new Error(doc ? "Use a PDF file" : "Use a JPG, PNG or WebP image");
  }
  const max = doc ? 10 : 5;
  if (file.size > max * 1024 * 1024) throw new Error(`${doc ? "PDFs" : "Images"} must be under ${max} MB`);

  let signed: Awaited<ReturnType<typeof signImageUpload>>;
  try {
    signed = await signImageUpload(doc ? "chat_doc" : "chat");
  } catch {
    throw new Error("Couldn't reach the server — check your connection and try again");
  }
  if (!signed.ok) throw new Error(signed.error);

  const data = await postToCloudinary(signed.signature, file, "Upload failed — try another file");
  return {
    kind,
    url: data.secure_url,
    public_id: data.public_id,
    // The API takes 255 characters, and a PDF's name has to keep ending in .pdf.
    name: file.name.length > 255 ? `${file.name.slice(0, 251)}${file.name.slice(-4)}` : file.name,
    mime: file.type,
    bytes: data.bytes ?? file.size,
    width: data.width ?? null,
    height: data.height ?? null,
  };
}
