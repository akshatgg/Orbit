// Types shared by admin server actions and client components.

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export type AuditEntry = {
  id: string;
  actor: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};
