/**
 * Adds f_auto/q_auto/fill-crop/width/dpr_auto transformations to a Cloudinary delivery URL.
 * Any other URL (an imported event's own image, an older upload) is returned unchanged.
 * Uploads are signed by the Orbit API (`POST /uploads/sign`, see `src/lib/storage.ts`).
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
