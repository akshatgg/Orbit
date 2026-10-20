// Reads a Luma city page (lu.ma/london) and finds the city's public iCal feed.

import { isValidTimezone } from "./timezone";

export type LumaDiscoverPlace = {
  apiId: string;
  slug: string | null;
  name: string | null;
  timezone: string;
  feedUrl: string;
};

type Place = {
  api_id?: unknown;
  slug?: unknown;
  name?: unknown;
  timezone?: unknown;
};

function place(value: unknown): Place | null {
  return value && typeof value === "object" ? (value as Place) : null;
}

/**
 * Produces the `discplace-…` feed for a city page. Supports the current shape
 * (`initialData.data.place`) and the older `initialData.places` / `featured_place` shape.
 */
export function parseLumaDiscoverPage(html: string, slug: string | null): LumaDiscoverPlace | null {
  const raw = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!raw) return null;

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }

  const pageProps = (data as { props?: { pageProps?: { initialData?: unknown } } })?.props?.pageProps;
  const initial = pageProps?.initialData as
    | {
        data?: { place?: unknown };
        featured_place?: { place?: unknown };
        places?: { place?: unknown }[];
      }
    | undefined;
  if (!initial) return null;

  const candidates: Place[] = [];
  const add = (value: unknown) => {
    const item = place(value);
    if (item) candidates.push(item);
  };
  add(initial.data?.place);
  add(initial.featured_place?.place);
  for (const item of initial.places ?? []) add(item?.place);

  const chosen = slug ? candidates.find((item) => item.slug === slug) : candidates[0];
  if (!chosen) return null;

  const apiId = typeof chosen.api_id === "string" ? chosen.api_id : null;
  if (!apiId?.startsWith("discplace-")) return null;

  const timezone =
    typeof chosen.timezone === "string" && isValidTimezone(chosen.timezone) ? chosen.timezone : "Europe/London";

  return {
    apiId,
    slug: typeof chosen.slug === "string" ? chosen.slug : slug,
    name: typeof chosen.name === "string" ? chosen.name : null,
    timezone,
    feedUrl: `https://api.lu.ma/ics/get?entity=discover&id=${apiId}`,
  };
}
