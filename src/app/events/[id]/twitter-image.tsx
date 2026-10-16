import { getEventForOg } from "@/lib/seo/public-data";
import { defaultOgImage, eventOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/seo/og";

export const alt = "ORBIT event";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEventForOg(id);
  return event ? eventOgImage(event) : defaultOgImage();
}
