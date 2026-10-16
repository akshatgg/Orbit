import { getMyOrganisers, getProfile } from "@/lib/auth";
import { showsStudioTab } from "@/lib/profile/flow";
import { BottomNav } from "./BottomNav";

/**
 * The tab bar with the right tabs for this person. Reads the session, so render it inside the
 * layout's <Suspense> (the static shell shows the 4-tab BottomNavView until this streams in).
 */
export async function MainNav() {
  const [profile, orgs] = await Promise.all([getProfile(), getMyOrganisers()]);
  return <BottomNav showStudio={showsStudioTab(profile?.goals, orgs.length)} />;
}
