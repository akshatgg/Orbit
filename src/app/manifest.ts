import type { MetadataRoute } from "next";

const THEME = "#06060a";

/** Next's Manifest type predates a few newer members; extend it rather than loosen it. */
type OrbitManifest = Omit<MetadataRoute.Manifest, "share_target"> & {
  dir?: "ltr" | "rtl" | "auto";
  launch_handler?: { client_mode: string[] };
  edge_side_panel?: { preferred_width: number };
  share_target?: {
    action: string;
    method?: "GET" | "POST";
    enctype?: string;
    params: { title?: string; text?: string; url?: string };
  };
};

const shortcutIcon = [{ src: "/icons/icon-96.png", sizes: "96x96", type: "image/png" }];

export default function manifest(): OrbitManifest {
  return {
    name: "ORBIT — Explore Opportunities",
    short_name: "ORBIT",
    description:
      "Career, networking and social events picked for you — all in one place.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: THEME,
    theme_color: THEME,
    lang: "en-GB",
    dir: "ltr",
    categories: ["social", "lifestyle", "business", "education"],
    prefer_related_applications: false,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "For You", short_name: "For You", description: "Events picked for you", url: "/", icons: shortcutIcon },
      { name: "Explore", short_name: "Explore", description: "Search every event", url: "/search", icons: shortcutIcon },
      { name: "My Tickets", short_name: "Tickets", description: "Your passes and bookings", url: "/tickets", icons: shortcutIcon },
      { name: "Studio", short_name: "Studio", description: "Manage your events as an organiser", url: "/organiser", icons: shortcutIcon },
    ],
    screenshots: [
      { src: "/screenshots/for-you.jpg", sizes: "780x1688", type: "image/jpeg", form_factor: "narrow", label: "For You feed with events picked for you" },
      { src: "/screenshots/event.jpg", sizes: "780x1688", type: "image/jpeg", form_factor: "narrow", label: "Event details and booking" },
      { src: "/screenshots/ticket.jpg", sizes: "780x1688", type: "image/jpeg", form_factor: "narrow", label: "Your ticket pass with QR code" },
      { src: "/screenshots/for-you-light.jpg", sizes: "780x1688", type: "image/jpeg", form_factor: "narrow", label: "Light mode, with events grouped by day" },
      { src: "/screenshots/for-you-wide.jpg", sizes: "1280x800", type: "image/jpeg", form_factor: "wide", label: "ORBIT on desktop: the For You feed" },
      { src: "/screenshots/event-wide.jpg", sizes: "1280x800", type: "image/jpeg", form_factor: "wide", label: "Event page on desktop in light mode" },
    ],
    share_target: {
      action: "/search",
      method: "GET",
      params: { title: "q", text: "q", url: "q" },
    },
    launch_handler: { client_mode: ["navigate-existing", "auto"] },
    edge_side_panel: { preferred_width: 420 },
  };
}
