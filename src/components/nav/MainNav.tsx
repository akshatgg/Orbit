import { Avatar } from "@/components/ui/Avatar";
import { getMyOrganisers, getProfile } from "@/lib/auth";
import { listUpcomingPlaces } from "@/lib/discovery/queries";
import { showsStudioTab } from "@/lib/profile/flow";
import { BottomNav } from "./BottomNav";
import { DesktopHeader } from "./DesktopHeader";

/**
 * Navigation with the right links for this person: the tab bar on phones, the top bar from tablets
 * up. Reads the session, so render it inside the layout's <Suspense> (NavFallback shows meanwhile).
 */
export async function MainNav() {
  const [profile, orgs, places] = await Promise.all([getProfile(), getMyOrganisers(), listUpcomingPlaces()]);
  const showStudio = showsStudioTab(profile?.goals, orgs.length);
  // Create event: straight to the editor once an organisation is approved, else where to get there.
  const createHref = orgs.some((o) => o.status === "approved")
    ? "/organiser/events/new"
    : orgs.length > 0 ? "/organiser" : "/organiser/apply";
  return (
    <>
      <BottomNav showStudio={showStudio} />
      <DesktopHeader
        places={places}
        showStudio={showStudio}
        createHref={createHref}
        avatar={<Avatar src={profile?.avatar_url} name={profile?.full_name ?? profile?.email} size={34} />}
      />
    </>
  );
}
