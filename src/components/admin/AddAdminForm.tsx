"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { addAdmin } from "@/app/admin/users/actions";

/** Super admin only (the page only renders it for them; the action re-checks). */
export function AddAdminForm() {
  const [state, action] = useActionState(addAdmin, null);
  return (
    <form action={action} className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <label htmlFor="admin-email" className="sr-only">Email of the person to make admin</label>
        <Input id="admin-email" name="email" type="email" required placeholder="name@example.com" className="min-w-64 flex-1" />
        <SubmitButton pendingText="Adding…">Add admin</SubmitButton>
      </div>
      <p className="text-xs text-muted">They need to have signed in to ORBIT once.</p>
      {state?.error && <p role="alert" className="text-sm text-red-300">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-emerald-300">{state.message}</p>}
    </form>
  );
}
