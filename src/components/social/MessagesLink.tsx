"use client";

import Link from "next/link";
import { useBadges } from "./badges";
import { ChatIcon, CountDot } from "./nav-icons";

/** Messages icon with the unread count (shared poll, see ./badges). */
export function MessagesLink({ className = "", active = false }: { className?: string; active?: boolean }) {
  const { messages, signedOut } = useBadges();
  if (signedOut) return null;
  return (
    <Link
      href="/messages"
      aria-label={messages > 0 ? `Messages, ${messages} unread` : "Messages"}
      aria-current={active ? "page" : undefined}
      title="Messages"
      className={`relative flex items-center justify-center rounded-full transition duration-200 ease-out hover:text-fg active:scale-95 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${active ? "text-fg" : "text-muted"} ${className}`}
    >
      <ChatIcon />
      <CountDot count={messages} label="unread" />
    </Link>
  );
}
