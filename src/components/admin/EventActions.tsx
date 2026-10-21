import { cancelEvent, deleteEvent, markReviewed, removeEvent, restoreEvent, setFeatured } from "@/app/admin/events/actions";
import type { OrbitEvent } from "@/types/database";
import { ActionButton } from "./ActionButton";
import { IconBan, IconCheck, IconExternal, IconEye, IconEyeOff, IconPencil, IconStar, IconTrash, IconUndo } from "./icons";
import { MenuLink, MenuSeparator, RowMenu } from "./RowMenu";

type Ev = Pick<OrbitEvent, "id" | "title" | "status" | "is_featured" | "needs_review" | "organiser_id" | "registration_mode" | "source_url">;

/** Row menu for an event in the admin table. */
export function EventMenu({ event }: { event: Ev }) {
  const live = event.status === "published";
  const adminEditable = event.registration_mode !== "tickets";
  return (
    <RowMenu label={`Actions for ${event.title}`}>
      <MenuLink href={`/events/${event.id}`} external><IconEye size={15} /> View public page</MenuLink>
      {adminEditable && <MenuLink href={`/admin/events/${event.id}/edit`}><IconPencil size={15} /> Edit</MenuLink>}
      {event.organiser_id && (
        <MenuLink href={`/organiser/events/${event.id}/edit`}><IconPencil size={15} /> Organiser edit page</MenuLink>
      )}
      {event.source_url && <MenuLink href={event.source_url} external><IconExternal size={15} /> Source listing</MenuLink>}
      <MenuSeparator />
      {event.needs_review && (
        <ActionButton menuItem action={markReviewed.bind(null, event.id)}><IconCheck size={15} /> Mark reviewed</ActionButton>
      )}
      {event.status !== "removed" && (
        <ActionButton menuItem action={setFeatured.bind(null, event.id, !event.is_featured)}>
          <IconStar size={15} /> {event.is_featured ? "Unfeature" : "Feature"}
        </ActionButton>
      )}
      {(event.status === "removed" || event.status === "cancelled" || event.status === "draft" || event.status === "expired") && (
        <ActionButton
          menuItem
          action={restoreEvent.bind(null, event.id)}
          confirm={{
            title: `Publish “${event.title}” again?`,
            body: "It will be visible to everyone on ORBIT (if its organiser is approved).",
            confirmLabel: "Restore & publish",
          }}
        >
          <IconUndo size={15} /> Restore (publish)
        </ActionButton>
      )}
      {live && (
        <ActionButton
          menuItem
          variant="danger"
          action={cancelEvent.bind(null, event.id)}
          confirm={{
            title: `Cancel “${event.title}”?`,
            body: "The event stays visible as cancelled and everyone registered is notified.",
            confirmLabel: "Cancel event",
            danger: true,
            reason: { label: "Reason shown to guests", placeholder: "e.g. The speaker is unwell", required: true },
          }}
        >
          <IconBan size={15} /> Cancel…
        </ActionButton>
      )}
      {event.status !== "removed" && (
        <ActionButton
          menuItem
          variant="danger"
          action={removeEvent.bind(null, event.id)}
          confirm={{
            title: `Remove “${event.title}”?`,
            body: "Hides it from ORBIT completely (spam, duplicates, wrong info). It stays in the database and you can restore it later.",
            confirmLabel: "Remove event",
            danger: true,
            reason: { label: "Internal note", placeholder: "Optional — e.g. duplicate of the Careers Fair listing" },
          }}
        >
          <IconEyeOff size={15} /> Remove (hide)…
        </ActionButton>
      )}
      <ActionButton
        menuItem
        variant="danger"
        action={deleteEvent.bind(null, event.id)}
        confirm={{
          title: `Delete “${event.title}” permanently?`,
          body: (
            <>
              This erases the event and everything attached to it — registrations, tickets, questions, saved items and
              check-in history. It leaves ORBIT&rsquo;s database entirely and <b>cannot be undone</b>. Use Remove instead
              if you only want it hidden.
            </>
          ),
          confirmLabel: "Delete permanently",
          danger: true,
        }}
      >
        <IconTrash size={15} /> Delete permanently…
      </ActionButton>
    </RowMenu>
  );
}

export function MarkReviewedButton({ eventId }: { eventId: string }) {
  return (
    <ActionButton action={markReviewed.bind(null, eventId)} variant="secondary" successMessage="Marked as reviewed">
      <IconCheck size={14} /> Reviewed
    </ActionButton>
  );
}
