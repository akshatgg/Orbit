import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Organiser studio. It lives inside the (main) layout so the top bar and tab bar stay mounted when
 * you switch to and from Studio (the active-tab highlight slides instead of the shell reloading).
 * Pages check membership themselves.
 */
export default function OrganiserLayout({ children }: LayoutProps<"/organiser">) {
  return children;
}
