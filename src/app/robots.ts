import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/events/", "/o/", "/login"],
      disallow: [
        "/admin", "/organiser", "/api", "/tickets", "/profile", "/onboarding", "/checkout",
        "/join", "/auth", "/calendar", "/week", "/welcome",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
