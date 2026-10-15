"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./Button";
import type { ComponentProps } from "react";

/** Submit button that disables itself and shows `pendingText` while its form is submitting. */
export function SubmitButton({ children, pendingText = "Saving…", ...props }: ComponentProps<typeof Button> & {
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}
