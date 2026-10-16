import { serializeJsonLd, type JsonLd as Data } from "@/lib/seo/jsonld";

/** Renders structured data as a JSON-LD script tag. */
export function JsonLd({ data }: { data: Data | Data[] | null }) {
  if (!data) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
