"use client";

import { useActionState, useEffect, useId, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, buttonClass } from "@/components/ui/Button";
import type { ActionState } from "../actions";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "light";

function Submit({ children, pendingText, variant, size, full }: { children: ReactNode; pendingText: string; variant: Variant; size: "sm" | "md"; full: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} full={full} disabled={pending} aria-busy={pending}>
      {pending ? pendingText : children}
    </Button>
  );
}

function Result({ state }: { state: ActionState }) {
  if (!state) return null;
  return state.error ? (
    <p role="alert" className="text-xs text-red-300">{state.error}</p>
  ) : state.message ? (
    <p role="status" className="text-xs text-emerald-300">{state.message}</p>
  ) : null;
}

/**
 * A server action behind one button. With `confirm`, the button opens a dialog first
 * (used for destructive actions); `extra` renders inside the dialog's form.
 */
export function ActionButton({
  action, fields, children, pendingText = "Working…", variant = "secondary", size = "sm", confirm, extra, resultClassName = "",
  full = false, className = "",
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  children: ReactNode;
  pendingText?: string;
  variant?: Variant;
  size?: "sm" | "md";
  confirm?: { title: string; body: ReactNode; confirmLabel: string };
  extra?: ReactNode;
  resultClassName?: string;
  /** Stretch the trigger to the width of its container (used by the mobile source cards). */
  full?: boolean;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (state) dialogRef.current?.close();
  }, [state]);

  const hidden = Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />);

  if (!confirm) {
    return (
      <div className={`space-y-1 ${className}`}>
        <form action={formAction}>
          {hidden}
          <Submit pendingText={pendingText} variant={variant} size={size} full={full}>{children}</Submit>
        </form>
        <div className={resultClassName}><Result state={state} /></div>
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <button type="button" className={buttonClass({ variant, size, full })} onClick={() => dialogRef.current?.showModal()}>
        {children}
      </button>
      <div className={resultClassName}><Result state={state} /></div>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="glass-strong m-auto w-[min(28rem,calc(100vw-2rem))] rounded-[22px] p-0 text-fg backdrop:bg-black/50 backdrop:backdrop-blur-md"
      >
        <form action={formAction} className="space-y-4 p-6">
          {hidden}
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">{confirm.title}</h2>
          <div className="text-sm text-muted">{confirm.body}</div>
          {extra}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="md" onClick={() => dialogRef.current?.close()}>Cancel</Button>
            <Submit pendingText={pendingText} variant={variant === "danger" ? "danger" : "primary"} size="md" full={false}>
              {confirm.confirmLabel}
            </Submit>
          </div>
        </form>
      </dialog>
    </div>
  );
}
