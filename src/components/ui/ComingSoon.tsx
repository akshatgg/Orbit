/** Temporary body for screens that are scaffolded but not built yet. */
export function ComingSoon({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-4 rounded-2xl border border-dashed border-line p-6 text-sm text-muted">
      {children}
    </div>
  );
}
