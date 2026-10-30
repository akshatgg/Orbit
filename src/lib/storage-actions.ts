"use server";

import { authed } from "@/lib/api/session";
import { apiErrorCode, isApiStatus } from "@/lib/api/errors";

export type ImageBucket = "event-covers" | "organiser-logos";
/** Files in a chat: `chat` an image, `chat_doc` a PDF (Cloudinary keeps those as `raw`). */
export type ChatUploadKind = "chat" | "chat_doc";

export type UploadSignature = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  allowedFormats: string;
  maxBytes: number;
  /** Where to post the file: `.../v1_1/<cloudName>/<resourceType>/upload`. */
  resourceType?: "image" | "raw";
};

export type SignResult = { ok: true; signature: UploadSignature } | { ok: false; error: string };

/**
 * A Cloudinary upload signature for the signed-in person, from the Orbit API
 * (`POST /uploads/sign`). The API secret never leaves the backend; the browser
 * uploads the file straight to Cloudinary with what this returns.
 */
export async function signImageUpload(kind: ImageBucket | ChatUploadKind): Promise<SignResult> {
  if (kind !== "event-covers" && kind !== "organiser-logos" && kind !== "chat" && kind !== "chat_doc") return { ok: false, error: "Couldn't start the upload — try again" };
  try {
    const signature = await authed.post<UploadSignature>("/uploads/sign", { body: { kind } });
    return { ok: true, signature };
  } catch (error) {
    if (isApiStatus(error, 401)) return { ok: false, error: "Sign in to upload images" };
    if (isApiStatus(error, 503)) {
      return {
        ok: false,
        error: kind === "chat" || kind === "chat_doc"
          ? "File uploads aren't configured yet — send your message without one"
          : "Image uploads aren't configured yet — you can save without an image and add one later",
      };
    }
    if (isApiStatus(error, 0)) return { ok: false, error: "Couldn't reach the server — check your connection and try again" };
    console.error("[uploads] sign failed", apiErrorCode(error) ?? error);
    return { ok: false, error: "Couldn't start the upload — try again" };
  }
}
