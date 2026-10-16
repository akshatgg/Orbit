import { OrbitLoader } from "@/components/brand/OrbitLoader";

/** Sits inside the tab layout, so the bottom bar stays put and the loader is centred in the space above it. */
export default function Loading() {
  return <OrbitLoader size="md" className="min-h-[calc(100dvh-8rem)]" label="Loading" />;
}
