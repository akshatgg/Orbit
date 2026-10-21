"use client";

import type { ThemePreference } from "./theme";
import { useTheme } from "./useTheme";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** Appearance: Auto (light by day, dark at night) / Light / Dark segmented control (Profile). */
export function AppearanceControl() {
  const { preference, setPreference } = useTheme();
  return (
    <div role="radiogroup" aria-label="Appearance" className="grid grid-cols-3 gap-1 rounded-full bg-ink/[0.06] p-1">
      {OPTIONS.map((o) => {
        const on = preference === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setPreference(o.value)}
            className={`rounded-full px-3 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              on ? "bg-[var(--seg-on)] text-fg shadow-[var(--seg-shadow)]" : "text-muted hover:text-fg"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
