/** Temporary body for screens that exist in the navigation but aren't built yet. */
export function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-4 rounded-[22px] border border-dashed border-white/12 bg-white/[0.025] p-6 text-sm text-muted backdrop-blur-xl">{children}</div>
  );
}
