"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { OrbitEmblem } from "@/components/brand/OrbitEmblem";
import { SocialIcon } from "@/components/social/icons";
import { Button } from "@/components/ui/Button";
import { plural } from "@/lib/social/format";
import { joinGroup } from "@/lib/social/actions";
import type { ChannelCard, GroupCard } from "@/types/social";

const CHANNELS_SHOWN = 6;

/** Join ORBIT's community or skip it: nothing happens unless they choose Join. */
export function JoinOrbitChoice({ community, channels, upcoming, joined, skipped }: {
  community: GroupCard;
  channels: ChannelCard[];
  /** Upcoming events across its channels. */
  upcoming: number;
  /** Where to go after joining, and after skipping. */
  joined: string;
  skipped: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function join() {
    setError(null);
    startTransition(async () => {
      const result = await joinGroup(community.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace(joined);
    });
  }

  return (
    <div className="flex min-h-dvh flex-col md:min-h-0 md:w-full md:rounded-[32px] md:border md:border-ink/10 md:bg-surface md:shadow-[var(--card-shadow)]">
      <main className="flex-1 px-5 pb-8 pt-[max(env(safe-area-inset-top),2.5rem)] md:px-10 md:pt-10">
        <div className="-mb-1 flex items-center gap-3">
          <OrbitEmblem size={64} />
          <p className="font-display text-xs font-semibold tracking-[0.4em] text-muted">ORBIT</p>
        </div>
        <p className="font-display text-xs font-medium text-muted">One more thing</p>
        <h1 className="mt-2.5 text-[1.7rem] font-semibold leading-tight tracking-tight">Join the {community.name} community?</h1>
        <p className="mt-2 text-sm text-muted">
          {community.description ?? "Everything happening on ORBIT, in one place."} New events land in its channels every day, with a daily summary in Announcements.
        </p>

        <section aria-label={`${community.name} channels`} className="glass mt-7 overflow-hidden rounded-[22px]">
          <div className="flex items-baseline justify-between gap-3 px-4 pb-2.5 pt-3.5">
            <p className="text-sm font-semibold tracking-tight">{plural(upcoming, "upcoming event")}</p>
            <p className="text-xs text-muted">{plural(community.member_count, "member")} · {plural(channels.length, "channel")}</p>
          </div>
          <ul className="divide-y divide-line border-t border-line">
            {channels.slice(0, CHANNELS_SHOWN).map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-muted">
                  <SocialIcon name="chat" className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                {c.upcoming_event_count > 0 && <span className="shrink-0 text-xs text-muted">{plural(c.upcoming_event_count, "event")}</span>}
              </li>
            ))}
          </ul>
          {channels.length > CHANNELS_SHOWN && (
            <p className="border-t border-line px-4 py-2.5 text-xs text-muted">and {plural(channels.length - CHANNELS_SHOWN, "more channel")}</p>
          )}
        </section>
        <p className="mt-3 text-xs text-subtle">You choose which channels to follow. You can leave any time.</p>
      </main>

      <footer className="sticky bottom-0 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-6 md:static md:px-6 md:pb-6">
        {error && <p role="alert" className="mb-3 text-center text-sm text-red-300">{error}</p>}
        <div className="glass-strong flex gap-2 rounded-full p-1.5">
          <Button type="button" variant="secondary" size="lg" disabled={pending} onClick={() => router.replace(skipped)}>
            Skip
          </Button>
          <Button type="button" size="lg" full disabled={pending} aria-busy={pending} onClick={join}>
            {pending ? "Joining…" : `Join ${community.name}`}
          </Button>
        </div>
      </footer>
    </div>
  );
}
