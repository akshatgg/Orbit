"use client";

import Form from "next/form";
import type { ReactNode } from "react";

/** GET filter form (client-side navigation) that re-submits whenever a select/checkbox changes. */
export function AutoSubmitForm({ action, children, className = "" }: { action: string; children: ReactNode; className?: string }) {
  return (
    <Form
      action={action}
      className={className}
      onChange={(e) => {
        const el = e.target as HTMLElement;
        if (el instanceof HTMLSelectElement || (el instanceof HTMLInputElement && el.type === "checkbox")) {
          e.currentTarget.requestSubmit();
        }
      }}
    >
      {children}
    </Form>
  );
}
