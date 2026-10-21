import "server-only";
import { getCloudinaryConfig, orbitImagePublicId, signParams } from "@/lib/cloudinary";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Deletes the Cloudinary images of events that were just permanently deleted — but only images in
 * ORBIT's own folders, and only when no other event (e.g. another date of the same series, which
 * shares one cover) or organiser still uses them. Call after the rows are gone. Never throws: a
 * Cloudinary hiccup must not undo or fail the delete itself. Returns how many images were deleted.
 */
export async function releaseImages(urls: (string | null | undefined)[]): Promise<number> {
  const config = getCloudinaryConfig();
  if (!config) return 0;
  const owned = new Map<string, string>(); // url → public id
  for (const url of urls) {
    const id = orbitImagePublicId(url, config.cloudName);
    if (url && id) owned.set(url, id);
  }
  if (owned.size === 0) return 0;

  try {
    const db = createAdminClient();
    const list = [...owned.keys()];
    const [events, organisers] = await Promise.all([
      db.from("events").select("cover_url").in("cover_url", list),
      db.from("organisers").select("logo_url").in("logo_url", list),
    ]);
    if (events.error || organisers.error) return 0; // can't tell what's still used: keep everything
    const stillUsed = new Set([
      ...(events.data ?? []).map((r) => r.cover_url as string),
      ...(organisers.data ?? []).map((r) => r.logo_url as string),
    ]);
    const unused = [...new Set([...owned].filter(([url]) => !stillUsed.has(url)).map(([, id]) => id))];

    let deleted = 0;
    for (const publicId of unused) {
      const timestamp = Math.floor(Date.now() / 1000);
      const body = new FormData();
      body.set("public_id", publicId);
      body.set("timestamp", String(timestamp));
      body.set("invalidate", "true");
      body.set("api_key", config.apiKey);
      body.set("signature", signParams({ public_id: publicId, timestamp, invalidate: "true" }, config.apiSecret));
      const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`, {
        method: "POST",
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      }).catch(() => null);
      const json = (await response?.json().catch(() => null)) as { result?: string } | null;
      if (json?.result === "ok") deleted++;
    }
    return deleted;
  } catch {
    return 0;
  }
}
