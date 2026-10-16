"use client";

import { useState, useTransition, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/Button";
import type { ActionResult } from "@/lib/admin/types";
import { ConfirmDialog, type ConfirmOptions } from "./ConfirmDialog";
import { toast } from "./Toaster";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "light";

/**
 * Runs a (pre-bound) server action, optionally behind a confirm dialog that can collect a reason.
 * Success/failure is announced with a toast; the action's revalidatePath refreshes the data.
 */
export function ActionButton({
  action, children, confirm, variant = "secondary", size = "sm", className = "", menuItem = false,
  successMessage, label,
}: {
  action: (reason?: string) => Promise<ActionResult>;
  children: ReactNode;
  confirm?: ConfirmOptions;
  variant?: Variant;
  size?: "sm" | "md";
  className?: string;
  /** Full-width left-aligned row for use inside RowMenu. */
  menuItem?: boolean;
  successMessage?: string;
  /** Accessible name when the visible content is just an icon. */
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(reason?: string) {
    setError(null);
    startTransition(async () => {
      let result: ActionResult;
      try {
        result = await action(reason);
      } catch {
        result = { ok: false, error: "Couldn't reach the server. Try again." };
      }
      if (result.ok) {
        setOpen(false);
        toast(result.message ?? successMessage ?? "Done");
      } else if (confirm) {
        setError(result.error);
      } else {
        toast(result.error, "error");
      }
    });
  }

  const cls = menuItem
    ? `flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors disabled:opacity-50 ${
        variant === "danger" ? "text-red-300 hover:bg-red-500/10" : "text-fg hover:bg-white/[0.08]"
      } ${className}`
    : buttonClass({ variant, size, className });

  return (
    <>
      <button
        type="button"
        className={cls}
        disabled={pending}
        aria-busy={pending}
        aria-label={label}
        title={label}
        role={menuItem ? "menuitem" : undefined}
        onClick={() => (confirm ? (setError(null), setOpen(true)) : run())}
      >
        {children}
      </button>
      {confirm && (
        <ConfirmDialog
          open={open}
          options={confirm}
          pending={pending}
          error={error}
          onConfirm={(reason) => run(reason)}
          onClose={() => { if (!pending) setOpen(false); }}
        />
      )}
    </>
  );
}
