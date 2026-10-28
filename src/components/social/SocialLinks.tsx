import Link from "next/link";
import { SocialIcon, type SocialIconName } from "./icons";

const ITEMS: { href: string; label: string; hint: string; icon: SocialIconName }[] = [
  { href: "/circles", label: "Circles", hint: "Plan events with friends", icon: "circles" },
  { href: "/communities", label: "Communities", hint: "Groups by interest", icon: "community" },
  { href: "/messages", label: "Messages", hint: "Circle chats and DMs", icon: "chat" },
];

/** Profile entry points to the social screens (phones have no tab for them). */
export function SocialLinks() {
  return (
    <ul className="mx-4 grid grid-cols-3 gap-2.5">
      {ITEMS.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            className="glass flex h-full flex-col gap-2.5 rounded-[20px] p-3.5 transition duration-200 hover:bg-ink/[0.08] active:scale-[0.98] motion-reduce:transition-none"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-accent/10 text-accent">
              <SocialIcon name={item.icon} className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold tracking-tight">{item.label}</span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-muted">{item.hint}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
