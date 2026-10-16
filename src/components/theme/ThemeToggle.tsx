"use client";

import { useTheme } from "./useTheme";

/**
 * Sun / moon button that flips between light and dark. Both icons are rendered and CSS shows the
 * right one, so the server HTML is correct before any script runs (no hydration mismatch).
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between light and dark theme"
      title="Switch theme"
      className={`flex h-10 w-10 items-center justify-center rounded-full text-muted transition duration-200 ease-out hover:text-fg active:scale-95 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
    >
      <svg viewBox="0 0 24 24" className="hidden h-[18px] w-[18px] dark:block" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v1.5M12 19.5V21M4.2 4.2l1.1 1.1M18.7 18.7l1.1 1.1M3 12h1.5M19.5 12H21M4.2 19.8l1.1-1.1M18.7 5.3l1.1-1.1" />
      </svg>
      <svg viewBox="0 0 24 24" className="hidden h-[18px] w-[18px] light:block" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
      </svg>
    </button>
  );
}
