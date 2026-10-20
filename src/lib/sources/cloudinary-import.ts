import "server-only";
import { getCloudinaryConfig, signParams } from "@/lib/cloudinary";

/**
 * Has Cloudinary fetch a remote image and store ORBIT's own copy; returns its secure URL.
 * ORBIT's server never downloads the image itself.
 */
export async function importRemoteImage(imageUrl: string, folder: string): Promise<string> {
  const config = getCloudinaryConfig();
  if (!config) throw new Error("Image import needs Cloudinary (CLOUDINARY_* env vars are missing).");
  let url: URL;
  try {
    url = new URL(imageUrl);
  } catch {
    throw new Error("That image link isn't a valid URL.");
  }
  if (url.protocol !== "https:") throw new Error("Image links must start with https://");

  const timestamp = Math.floor(Date.now() / 1000);
  const body = new FormData();
  body.set("file", url.toString());
  body.set("api_key", config.apiKey);
  body.set("timestamp", String(timestamp));
  body.set("folder", folder);
  body.set("signature", signParams({ folder, timestamp }, config.apiSecret));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, {
    method: "POST",
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await response.json().catch(() => null)) as { secure_url?: string; error?: { message?: string } } | null;
  if (!response.ok || !json?.secure_url) {
    throw new Error(`Cloudinary couldn't import the image: ${json?.error?.message ?? `HTTP ${response.status}`}`);
  }
  return json.secure_url;
}
