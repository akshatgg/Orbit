/** Temporary body for screens that exist in the navigation but aren't built yet. */
export function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-4 rounded-2xl border border-dashed border-line p-6 text-sm text-muted">{children}</div>
  );
}
