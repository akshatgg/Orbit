"use server";

import { authed } from "@/lib/api/session";
import { apiErrorCode, isApiStatus } from "@/lib/api/errors";

export type ImageBucket = "event-covers" | "organiser-logos";

export type UploadSignature = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  allowedFormats: string;
  maxBytes: number;
};

export type SignResult = { ok: true; signature: UploadSignature } | { ok: false; error: string };

/**
 * A Cloudinary upload signature for the signed-in person, from the Orbit API
 * (`POST /uploads/sign`). The API secret never leaves the backend; the browser
 * uploads the file straight to Cloudinary with what this returns.
 */
export async function signImageUpload(kind: ImageBucket): Promise<SignResult> {
  if (kind !== "event-covers" && kind !== "organiser-logos") return { ok: false, error: "Couldn't start the upload — try again" };
  try {
    const signature = await authed.post<UploadSignature>("/uploads/sign", { body: { kind } });
    return { ok: true, signature };
  } catch (error) {
    if (isApiStatus(error, 401)) return { ok: false, error: "Sign in to upload images" };
    if (isApiStatus(error, 503)) {
      return { ok: false, error: "Image uploads aren't configured yet — you can save without an image and add one later" };
    }
    if (isApiStatus(error, 0)) return { ok: false, error: "Couldn't reach the server — check your connection and try again" };
    console.error("[uploads] sign failed", apiErrorCode(error) ?? error);
    return { ok: false, error: "Couldn't start the upload — try again" };
  }
}
