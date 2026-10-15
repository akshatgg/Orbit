"use client";

import { removeAdmin, setStudentVerified } from "@/app/admin/users/actions";
import { ActionButton } from "./ActionButton";

export function VerifyStudentButton({ userId, verified, name }: { userId: string; verified: boolean; name: string }) {
  return (
    <ActionButton
      action={setStudentVerified.bind(null, userId, !verified)}
      variant={verified ? "ghost" : "secondary"}
      label={`${verified ? "Remove verified student badge from" : "Verify"} ${name}`}
    >
      {verified ? "Unverify" : "Verify"}
    </ActionButton>
  );
}

export function RemoveAdminButton({ email }: { email: string }) {
  return (
    <ActionButton
      action={() => removeAdmin(email)}
      variant="danger"
      confirm={{
        title: `Remove ${email} as admin?`,
        body: "They'll lose access to the admin dashboard straight away. They keep their normal account.",
        confirmLabel: "Remove admin",
        danger: true,
      }}
    >
      Remove admin
    </ActionButton>
  );
}
