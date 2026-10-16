import { defaultOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/seo/og";

export const alt = "ORBIT — Career events, networking & socials";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return defaultOgImage();
}
