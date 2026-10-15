"use client";

import { useActionState, useEffect, useId, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, buttonClass } from "@/components/ui/Button";
import type { ActionState } from "../actions";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "light";

function Submit({ children, pendingText, variant, size }: { children: ReactNode; pendingText: string; variant: Variant; size: "sm" | "md" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} aria-busy={pending}>
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
      <div className="space-y-1">
        <form action={formAction}>
          {hidden}
          <Submit pendingText={pendingText} variant={variant} size={size}>{children}</Submit>
        </form>
        <div className={resultClassName}><Result state={state} /></div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button type="button" className={buttonClass({ variant, size })} onClick={() => dialogRef.current?.showModal()}>
        {children}
      </button>
      <div className={resultClassName}><Result state={state} /></div>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-full max-w-md rounded-2xl border border-line bg-surface p-0 text-fg backdrop:bg-bg/80 backdrop:backdrop-blur-sm"
      >
        <form action={formAction} className="space-y-4 p-6">
          {hidden}
          <h2 id={titleId} className="font-display text-lg font-semibold">{confirm.title}</h2>
          <div className="text-sm text-muted">{confirm.body}</div>
          {extra}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="md" onClick={() => dialogRef.current?.close()}>Cancel</Button>
            <Submit pendingText={pendingText} variant={variant === "danger" ? "danger" : "primary"} size="md">
              {confirm.confirmLabel}
            </Submit>
          </div>
        </form>
      </dialog>
    </div>
  );
}
