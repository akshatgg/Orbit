import { createHash } from "node:crypto";

export const UPLOAD_KINDS = ["event-covers", "organiser-logos"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

export const ALLOWED_FORMATS = "jpg,png,webp";
export const MAX_BYTES: Record<UploadKind, number> = {
  "event-covers": 5 * 1024 * 1024,
  "organiser-logos": 2 * 1024 * 1024,
};

/**
 * Cloudinary signed-upload signature: SHA-1 of the params (sorted by name, "k=v" joined with "&",
 * empty values dropped, file/api_key/resource_type/cloud_name excluded) followed directly by the API secret.
 */
export function signParams(params: Record<string, string | number | undefined>, apiSecret: string): string {
  const toSign = Object.entries(params)
    .filter(([k, v]) => v !== undefined && v !== "" && !["file", "api_key", "resource_type", "cloud_name"].includes(k))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return createHash("sha1").update(toSign + apiSecret).digest("hex");
}

export type CloudinaryConfig = { cloudName: string; apiKey: string; apiSecret: string };

/** Server-side config from env, or null when Cloudinary isn't set up. */
export function getCloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  return cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null;
}

/**
 * Adds f_auto/q_auto/fill-crop/width/dpr_auto transformations to a Cloudinary delivery URL.
 * Any other URL (Supabase Storage, external) is returned unchanged.
 */
export function cloudinaryUrl(
  url: string,
  { width, height, crop = "fill" }: { width: number; height?: number; crop?: string },
): string {
  if (!/^https:\/\/res\.cloudinary\.com\//.test(url)) return url;
  const marker = "/image/upload/";
  const i = url.indexOf(marker);
  if (i === -1) return url;
  const t = ["f_auto", "q_auto", `c_${crop}`, `w_${Math.round(width)}`, ...(height ? [`h_${Math.round(height)}`] : []), "dpr_auto"].join(",");
  return `${url.slice(0, i + marker.length)}${t}/${url.slice(i + marker.length)}`;
}

/**
 * The public id of an image ORBIT stored in its own Cloudinary account ("orbit/event-covers/…"),
 * or null for anything else (another account, another folder, Supabase Storage, Meetup/Luma
 * images). Only these ids are ever deleted.
 */
export function orbitImagePublicId(url: string | null | undefined, cloudName: string): string | null {
  if (!url) return null;
  let path: string;
  try {
    const u = new URL(url);
    if (u.hostname !== "res.cloudinary.com") return null;
    path = decodeURIComponent(u.pathname);
  } catch {
    return null;
  }
  const prefix = `/${cloudName}/image/upload/`;
  if (!path.startsWith(prefix)) return null;
  // Drop transformation segments ("f_auto,q_auto,…") and the version ("v1792…").
  const parts = path.slice(prefix.length).split("/");
  while (parts.length > 1 && (/^v\d+$/.test(parts[0]) || /^[a-z]{1,3}_[^/]*$/.test(parts[0]) || parts[0].includes(","))) parts.shift();
  const id = parts.join("/").replace(/\.[a-z0-9]+$/i, "");
  return id.startsWith("orbit/") && !id.includes("..") ? id : null;
}
