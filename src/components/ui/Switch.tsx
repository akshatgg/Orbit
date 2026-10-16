import type { ComponentProps } from "react";

/**
 * On/off switch used everywhere in the app. On = blue track with the knob on the right; off = grey
 * track with the knob on the left. The knob is always white and anchored inside the track.
 */
export function Switch({ checked, size = "md", className = "", ...props }: {
  checked: boolean;
  size?: "md" | "lg";
} & Omit<ComponentProps<"button">, "role" | "aria-checked" | "type">) {
  const lg = size === "lg";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`relative inline-flex shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none ${
        lg ? "h-7 w-12" : "h-6 w-11"
      } ${checked ? "bg-accent" : "bg-ink/20 light:bg-ink/15"} ${className}`}
      {...props}
    >
      <span
        aria-hidden
        className={`block rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.35)] transition-transform duration-200 ease-out motion-reduce:transition-none ${
          lg ? "h-6 w-6" : "h-5 w-5"
        } ${checked ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  );
}
