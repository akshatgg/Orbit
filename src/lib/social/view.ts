// Grid or list: how the communities directory and a community's events are laid out. The choice is
// kept per screen in a cookie, so the server renders the right one on the first paint.

export type ListView = "grid" | "list";

export const VIEW_COOKIES = {
  communities: "orbit_view_communities",
  communityEvents: "orbit_view_community_events",
} as const;

export type ViewScope = keyof typeof VIEW_COOKIES;

export function parseView(value: string | null | undefined): ListView {
  return value === "list" ? "list" : "grid";
}
