import { Tabs } from "@/components/ui/Tabs";

/** Switch between the ranked feed, the weekly shortlist and the calendar. */
export function FeedTabs() {
  return (
    <Tabs
      items={[
        { href: "/", label: "For You" },
        { href: "/week", label: "This Week" },
        { href: "/calendar", label: "Calendar" },
      ]}
    />
  );
}
