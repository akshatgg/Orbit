export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="px-4 pb-4 pt-[max(env(safe-area-inset-top),1.5rem)]">
      <h1 className="font-display text-2xl font-semibold tracking-wide">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
    </header>
  );
}
