import { decideOrganiser, setOrganiserVerified } from "@/app/admin/organisers/actions";
import type { Organiser } from "@/types/database";
import { ActionButton } from "./ActionButton";
import { IconBadge, IconBan, IconCheck, IconUndo, IconX } from "./icons";
import { MenuSeparator, RowMenu } from "./RowMenu";

type Org = Pick<Organiser, "id" | "name" | "status" | "is_verified">;

/** Inline Approve / Reject for pending applications. */
export function ApproveRejectButtons({ org }: { org: Org }) {
  return (
    <div className="flex items-center gap-1.5">
      <ActionButton
        action={decideOrganiser.bind(null, org.id, "approve")}
        variant="primary"
        successMessage={`${org.name} approved`}
      >
        <IconCheck size={14} /> Approve
      </ActionButton>
      <ActionButton
        action={decideOrganiser.bind(null, org.id, "reject")}
        variant="ghost"
        confirm={{
          title: `Reject ${org.name}?`,
          body: "They'll see your note on their organiser page and can apply again.",
          confirmLabel: "Reject application",
          danger: true,
          reason: { label: "Note to the organiser", placeholder: "e.g. Please use your society's official email", required: true },
        }}
      >
        <IconX size={14} /> Reject
      </ActionButton>
    </div>
  );
}

/** Everything else, tucked into a row menu. */
export function OrganiserMenu({ org }: { org: Org }) {
  return (
    <RowMenu label={`Actions for ${org.name}`}>
      {org.status === "pending" && (
        <>
          <ActionButton menuItem action={decideOrganiser.bind(null, org.id, "approve")}>
            <IconCheck size={15} /> Approve
          </ActionButton>
          <ActionButton
            menuItem
            variant="danger"
            action={decideOrganiser.bind(null, org.id, "reject")}
            confirm={{
              title: `Reject ${org.name}?`,
              body: "They'll see your note and can apply again.",
              confirmLabel: "Reject application",
              danger: true,
              reason: { label: "Note to the organiser", required: true },
            }}
          >
            <IconX size={15} /> Reject…
          </ActionButton>
        </>
      )}
      {org.status === "rejected" && (
        <ActionButton menuItem action={decideOrganiser.bind(null, org.id, "approve")}>
          <IconCheck size={15} /> Approve after all
        </ActionButton>
      )}
      {org.status === "suspended" && (
        <ActionButton menuItem action={decideOrganiser.bind(null, org.id, "reinstate")}>
          <IconUndo size={15} /> Reinstate
        </ActionButton>
      )}
      <ActionButton menuItem action={setOrganiserVerified.bind(null, org.id, !org.is_verified)}>
        <IconBadge size={15} /> {org.is_verified ? "Remove verified badge" : "Give verified badge"}
      </ActionButton>
      {org.status === "approved" && (
        <>
          <MenuSeparator />
          <ActionButton
            menuItem
            variant="danger"
            action={decideOrganiser.bind(null, org.id, "suspend")}
            confirm={{
              title: `Suspend ${org.name}?`,
              body: "Their events disappear from ORBIT and they can't publish new ones until reinstated.",
              confirmLabel: "Suspend organiser",
              danger: true,
              reason: { label: "Reason (shown to the organiser)", placeholder: "Optional" },
            }}
          >
            <IconBan size={15} /> Suspend…
          </ActionButton>
        </>
      )}
    </RowMenu>
  );
}
