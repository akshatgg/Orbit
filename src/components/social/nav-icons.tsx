// The two nav icons and their count, kept apart from ./icons so every page's nav stays tiny.

export function BellIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9a6 6 0 0 1 12 0c0 4.5 1.5 6.5 2.2 7.3a.5.5 0 0 1-.4.7H4.2a.5.5 0 0 1-.4-.7C4.5 15.5 6 13.5 6 9zm3.5 11a2.6 2.6 0 0 0 5 0" />
    </svg>
  );
}

export function ChatIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 17h-8.5L6 20.5V17H5a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 5 5z" />
    </svg>
  );
}

/** Small count on an icon: hidden at zero, "9+" past nine. */
export function CountDot({ count, label }: { count: number; label: string }) {
  if (count <= 0) return null;
  return (
    <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10.5px] font-semibold leading-none text-white ring-2 ring-bg tabular-nums">
      {count > 9 ? "9+" : count}
      <span className="sr-only"> {label}</span>
    </span>
  );
}
