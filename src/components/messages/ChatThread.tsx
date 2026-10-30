"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition, type ChangeEvent, type KeyboardEvent } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { refreshBadges } from "@/components/social/badges";
import { GroupEventCard } from "@/components/social/GroupEventCard";
import { SocialIcon } from "@/components/social/icons";
import { deleteMessage, editMessage, markConversationRead, sendMessage } from "@/lib/social/actions";
import { clockTime, dayLabel, displayName, firstName, sameDay } from "@/lib/social/format";
import { uploadChatAttachment } from "@/lib/storage";
import type { AttachmentInput, ChatMessage, SocialUser, Thread } from "@/types/social";
import { EventSummary, hasLink, LinkPreview, Linkified, MessageAttachments } from "./ChatMedia";

type Item = ChatMessage & { pending?: boolean };

/** A file in the composer: uploading on its own as soon as it's picked, ready to go with the message. */
type Upload = {
  key: number;
  kind: AttachmentInput["kind"];
  name: string;
  /** A local copy of an image, for its thumbnail. */
  thumb?: string;
  attachment?: AttachmentInput;
  error?: string;
};

const PAGE = 50;
// Poll fast while the conversation is active, slower the longer it stays quiet.
const DELAYS = [4_000, 4_000, 4_000, 8_000, 8_000, 15_000, 30_000];
// Every so often re-read the latest page too, to pick up messages deleted since.
const RECONCILE_EVERY = 4;
const MAX_LENGTH = 2000;
const MAX_FILES = 10;
// How long an open thread keeps re-reading the latest page for a new link's preview (filled in by the
// API after sending, without marking the message as changed).
const PREVIEW_WAIT_MS = 60_000;

async function fetchThread(conversationId: string, query: Record<string, string> = {}): Promise<Thread | { error: string; status: number }> {
  const qs = new URLSearchParams(query).toString();
  const response = await fetch(`/api/social/conversations/${encodeURIComponent(conversationId)}${qs ? `?${qs}` : ""}`, { cache: "no-store" });
  if (!response.headers.get("content-type")?.includes("json")) return { error: "Couldn't load messages", status: response.status };
  const data = await response.json();
  return response.ok ? (data as Thread) : { error: (data as { error?: string }).error ?? "Couldn't load messages", status: response.status };
}

/** Sent a moment ago with a link whose preview hasn't arrived yet. */
function awaitingPreview(m: Item) {
  if (m.pending || m.deleted || !m.links?.length) return false;
  return Date.now() - new Date(m.created_at).getTime() < PREVIEW_WAIT_MS && m.links.some((l) => !l.title && !l.description && !l.image_url);
}

function isChanged(known: Item, m: ChatMessage) {
  return known.deleted !== m.deleted
    || known.body !== m.body
    || (known.edited_at ?? null) !== (m.edited_at ?? null)
    || JSON.stringify(known.links ?? []) !== JSON.stringify(m.links ?? []);
}

/** What ORBIT posts and event cards stand alone: no bubble, and they break a run of messages. */
function standsAlone(m: Item) {
  return !m.deleted && (m.kind === "event" || m.kind === "system" || m.kind === "summary");
}

function merge(list: Item[], incoming: ChatMessage[]): Item[] {
  if (!incoming.length) return list;
  const byId = new Map(list.map((m) => [m.id, m]));
  for (const m of incoming) {
    const known = byId.get(m.id);
    // An edit of ours still on its way: keep the new text until the API answers.
    if (known?.pending) continue;
    byId.set(m.id, { ...known, ...m, pending: false });
  }
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/**
 * A conversation (circle chat, channel or DM). The first page comes rendered from the server; after
 * that it polls `?after=` only while the tab is visible, backing off from 4 s to 30 s while nothing
 * happens, loads older messages when you scroll to the top, and sends / deletes optimistically (rolled
 * back if the API refuses). Files upload from the browser as soon as they're picked.
 */
export function ChatThread({ conversationId, initial, initialHasMore, initialPolledAt, initialSaved, me, kind, canSend = true, canModerate = false, notice }: {
  conversationId: string;
  initial: ChatMessage[];
  /** The first page's `polled_at`: edits and deletes after it reach this thread through the poll. */
  initialPolledAt?: string;
  /** Older messages exist before the first page. */
  initialHasMore?: boolean;
  /** Event messages on the first page that the viewer has saved. */
  initialSaved?: string[];
  me: SocialUser;
  kind: "circle" | "direct" | "channel";
  canSend?: boolean;
  /** A channel's moderators: delete on every message. */
  canModerate?: boolean;
  /** Shown instead of the composer (e.g. "You blocked Sam"). */
  notice?: React.ReactNode;
}) {
  const [items, setItems] = useState<Item[]>(initial);
  // A channel's moderators can change while it's open; the polls carry what the viewer may do now.
  const [allowed, setAllowed] = useState({ post: canSend, moderate: canModerate });
  const [saved, setSaved] = useState<Set<string>>(() => new Set(initialSaved));
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const [hasOlder, setHasOlder] = useState(initialHasMore ?? initial.length >= PAGE);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; draft: string } | null>(null);
  const [, startTransition] = useTransition();

  const itemsRef = useRef(items);
  const polls = useRef(0);
  const polledAt = useRef<string | undefined>(initialPolledAt);
  const kick = useRef<() => void>(() => {});
  const top = useRef<HTMLDivElement>(null);
  const keepOffset = useRef<number | null>(null);
  const stickToBottom = useRef(true);
  const tempId = useRef(0);
  const uploadKey = useRef(0);
  const thumbs = useRef(new Set<string>());

  const markRead = useCallback(() => {
    startTransition(async () => {
      await markConversationRead(conversationId);
      refreshBadges();
    });
  }, [conversationId]);

  // ── polling ──────────────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    const confirmed = itemsRef.current.filter((m) => !m.pending);
    const last = confirmed.at(-1);
    // Edits and deletes come back as `changed` since the previous response's `polled_at`; without
    // that (an older API) every few polls re-read the latest page instead.
    const since = polledAt.current;
    const reconcile = (!since && ++polls.current % RECONCILE_EVERY === 0) || itemsRef.current.some(awaitingPreview);
    const query: Record<string, string> = last && !reconcile ? { after: last.created_at, after_id: last.id } : {};
    if (since) query.changed_since = since;
    const result = await fetchThread(conversationId, query);
    if ("error" in result) {
      if (result.status === 403 || result.status === 404) setGone(result.error);
      return false;
    }
    if (result.polled_at) polledAt.current = result.polled_at;
    if (kind === "channel" && result.conversation?.can_post !== undefined) {
      const next = { post: !!result.conversation.can_post, moderate: !!result.conversation.can_moderate };
      setAllowed((a) => (a.post === next.post && a.moderate === next.moderate ? a : next));
    }
    if (result.saved_event_ids?.length) setSaved((s) => new Set([...s, ...result.saved_event_ids!]));
    const fresh = result.items.filter((m) => !itemsRef.current.some((x) => x.id === m.id));
    const updates = [...result.items, ...(result.changed ?? [])].filter((m) => {
      const known = itemsRef.current.find((x) => x.id === m.id);
      return known && !known.pending && isChanged(known, m);
    });
    if (fresh.length || updates.length) setItems((list) => merge(list, [...fresh, ...updates]));
    if (fresh.some((m) => m.sender?.id !== me.id)) markRead();
    // A burst bigger than one page: come straight back for the rest.
    return fresh.length > 0 || updates.length > 0 || (!reconcile && !!result.has_more);
  }, [conversationId, kind, me.id, markRead]);

  // One timer at a time: each poll schedules the next, slower while nothing arrives, paused while the
  // tab is hidden. `kick` resets to the fast pace (after sending, focusing the composer).
  useEffect(() => {
    if (gone) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let idle = 0;
    let stopped = false;

    function plan() {
      if (timer) clearTimeout(timer);
      timer = null;
      if (stopped || document.visibilityState !== "visible") return;
      timer = setTimeout(tick, DELAYS[Math.min(idle, DELAYS.length - 1)]);
    }
    async function tick() {
      timer = null;
      const gotNew = await poll().catch(() => false);
      idle = gotNew ? 0 : idle + 1;
      plan();
    }
    function onVisibility() {
      if (document.visibilityState === "visible") {
        idle = 0;
        void tick();
      } else if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }

    kick.current = () => {
      idle = 0;
      plan();
    };
    markRead();
    plan();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      kick.current = () => {};
    };
  }, [poll, markRead, gone]);

  // ── scrolling ────────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    itemsRef.current = items;
    if (keepOffset.current !== null) {
      // Older messages went in above: keep what was on screen in place.
      window.scrollBy(0, document.documentElement.scrollHeight - keepOffset.current);
      keepOffset.current = null;
    } else if (stickToBottom.current) {
      // To the very end of the page, so the composer and the tab bar don't sit over the last message.
      window.scrollTo({ top: document.documentElement.scrollHeight });
    }
  }, [items]);

  useEffect(() => {
    const onScroll = () => {
      const fromBottom = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
      stickToBottom.current = fromBottom < 160;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const loadOlder = useCallback(async () => {
    const first = itemsRef.current.find((m) => !m.pending);
    if (!first || loadingOlder) return;
    setLoadingOlder(true);
    const result = await fetchThread(conversationId, { before: first.created_at, before_id: first.id }).catch(() => null);
    setLoadingOlder(false);
    if (!result || "error" in result) return;
    setHasOlder(result.has_more ?? result.items.length >= PAGE);
    if (!result.items.length) return;
    keepOffset.current = document.documentElement.scrollHeight;
    stickToBottom.current = false;
    setItems((list) => merge(list, result.items));
  }, [conversationId, loadingOlder]);

  useEffect(() => {
    const el = top.current;
    if (!el || !hasOlder) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void loadOlder();
    }, { rootMargin: "200px 0px 0px 0px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasOlder, loadOlder]);

  // ── sending / deleting ───────────────────────────────────────────────────
  const uploading = uploads.some((u) => !u.attachment && !u.error);
  const ready = uploads.filter((u) => u.attachment);

  useEffect(() => {
    const urls = thumbs.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function pickFiles(kindOfFile: AttachmentInput["kind"], e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    setAttachOpen(false);
    if (!files.length) return;
    const room = MAX_FILES - uploads.filter((u) => !u.error).length;
    setError(files.length > room ? `Send up to ${MAX_FILES} files at a time` : null);
    for (const file of files.slice(0, Math.max(room, 0))) {
      const key = ++uploadKey.current;
      const thumb = kindOfFile === "image" && file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
      if (thumb) thumbs.current.add(thumb);
      setUploads((list) => [...list, { key, kind: kindOfFile, name: file.name, thumb }]);
      uploadChatAttachment(kindOfFile, file).then(
        (attachment) => setUploads((list) => list.map((u) => (u.key === key ? { ...u, attachment } : u))),
        (e: unknown) => setUploads((list) => list.map((u) => (u.key === key ? { ...u, error: e instanceof Error ? e.message : "Upload failed" } : u))),
      );
    }
  }

  function dropUpload(key: number) {
    setUploads((list) => list.filter((u) => u.key !== key));
  }

  function send() {
    const body = draft.trim();
    if ((!body && ready.length === 0) || uploading || body.length > MAX_LENGTH) return;
    const sending = ready;
    const attachments = sending.map((u) => u.attachment!);
    const temp: Item = {
      id: `temp-${++tempId.current}`,
      sender: me,
      body,
      deleted: false,
      created_at: new Date().toISOString(),
      kind: attachments.length ? "media" : "text",
      attachments: attachments.map((a, i) => ({ ...a, id: `temp-${tempId.current}-${i}` })),
      pending: true,
    };
    setItems((list) => [...list, temp]);
    setDraft("");
    setUploads((list) => list.filter((u) => !u.attachment));
    setError(null);
    stickToBottom.current = true;
    kick.current();
    startTransition(async () => {
      const result = await sendMessage(conversationId, body, attachments).catch(() => ({ ok: false as const, error: "Couldn't send. Try again." }));
      if (result.ok) {
        setItems((list) => merge(list.filter((m) => m.id !== temp.id), [result.sent]));
      } else {
        // Roll back: drop the bubble and give the text and files back.
        setItems((list) => list.filter((m) => m.id !== temp.id));
        setDraft((d) => d || body);
        setUploads((list) => [...sending, ...list]);
        setError(result.error);
      }
    });
  }

  function startEdit(message: Item) {
    setSelected(null);
    setError(null);
    setEditing({ id: message.id, draft: message.body });
  }

  function saveEdit() {
    if (!editing) return;
    const message = items.find((m) => m.id === editing.id);
    const body = editing.draft.trim();
    setEditing(null);
    // A media or event message stands without its text; any other needs some.
    const caption = message?.kind === "media" || message?.kind === "event";
    if (!message || (!body && !caption) || body === message.body || body.length > MAX_LENGTH) return;
    // Optimistic: the new text shows at once and goes back if the API refuses.
    setItems((list) => list.map((m) => (m.id === message.id ? { ...m, body, edited_at: new Date().toISOString(), pending: true } : m)));
    startTransition(async () => {
      const result = await editMessage(message.id, body, caption).catch(() => ({ ok: false as const, error: "Couldn't save the edit" }));
      if (result.ok) {
        setItems((list) => list.map((m) => (m.id === message.id ? { ...m, ...(result.edited ?? {}), pending: false } : m)));
      } else {
        setItems((list) => list.map((m) => (m.id === message.id ? message : m)));
        setError(result.error);
      }
    });
  }

  function onEditKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      setEditing(null);
    } else if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      saveEdit();
    }
  }

  function remove(message: Item) {
    setSelected(null);
    setItems((list) => list.map((m) => (m.id === message.id ? { ...m, deleted: true, body: "", attachments: [], links: [], event: null } : m)));
    startTransition(async () => {
      const result = await deleteMessage(message.id).catch(() => ({ ok: false as const, error: "Couldn't delete it" }));
      if (!result.ok) {
        setItems((list) => list.map((m) => (m.id === message.id ? message : m)));
        setError(result.error);
      }
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  if (gone) {
    return (
      <div className="mx-4 rounded-[22px] border border-dashed border-ink/12 bg-ink/[0.025] px-6 py-10 text-center text-sm text-muted">
        {gone}
      </div>
    );
  }

  return (
    // Tall enough that the composer sits at the bottom of the screen even in a short conversation.
    <div className="flex min-h-[calc(100dvh-17rem)] flex-col md:min-h-[calc(100dvh-15rem)]">
      <div ref={top} aria-hidden className="h-px" />
      {hasOlder && (
        <div className="flex justify-center pb-2">
          <button type="button" onClick={loadOlder} disabled={loadingOlder} className="rounded-full px-3 py-1 text-xs font-medium text-muted hover:bg-ink/[0.06] hover:text-fg disabled:opacity-50">
            {loadingOlder ? "Loading…" : "Load earlier messages"}
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-muted">
          {kind === "circle" ? "No messages yet. Say hi to the circle." : kind === "channel" ? "No messages yet." : "No messages yet. Say hi."}
        </p>
      ) : (
        <ol className="space-y-0.5 px-4" aria-label="Messages" aria-live="polite" aria-relevant="additions">
          {items.map((m, i) => {
            const prev = items[i - 1];
            const next = items[i + 1];
            const mine = m.sender?.id === me.id;
            const newDay = !prev || !sameDay(prev.created_at, m.created_at);
            const startsRun = newDay || prev.sender?.id !== m.sender?.id || gap(prev, m) || standsAlone(prev);
            const endsRun = !next || next.sender?.id !== m.sender?.id || gap(m, next) || !sameDay(m.created_at, next.created_at) || standsAlone(next);
            const dayRow = newDay && <p className="py-3 text-center text-[11px] font-medium text-subtle">{dayLabel(m.created_at)}</p>;

            if (!m.deleted && m.kind === "system") {
              return (
                <li key={m.id}>
                  {dayRow}
                  <p className="px-4 py-2 text-center text-xs text-muted">{m.body}</p>
                </li>
              );
            }

            const canAct = !m.deleted && !m.pending && (mine || allowed.moderate);
            const canEdit = mine && allowed.post;
            // Text alone is a button to tap; anything holding its own links gets a "More" beside the time.
            const tappable = !m.deleted && !!m.body && !hasLink(m.body) && m.kind !== "event";
            const isEditing = editing?.id === m.id;
            const editor = isEditing && (
              <div className="w-[min(78vw,28rem)]">
                <label htmlFor={`edit-${m.id}`} className="sr-only">Edit message</label>
                <textarea
                  id={`edit-${m.id}`}
                  value={editing.draft}
                  onChange={(e) => setEditing({ id: m.id, draft: e.target.value })}
                  onKeyDown={onEditKeyDown}
                  onBlur={() => setEditing((e) => (e?.id === m.id && e.draft === m.body ? null : e))}
                  maxLength={MAX_LENGTH}
                  autoFocus
                  onFocus={(e) => e.target.setSelectionRange(e.target.value.length, e.target.value.length)}
                  rows={1}
                  className="field-sizing-content max-h-48 min-h-10 w-full resize-none rounded-[18px] border border-accent/50 bg-ink/[0.06] px-3.5 py-2 text-[14.5px] leading-snug text-fg outline-none ring-4 ring-accent/15 light:bg-surface"
                />
                <span className="mt-0.5 flex justify-end gap-2 px-1 text-[10.5px] text-subtle">
                  Enter to save · Esc to cancel
                </span>
              </div>
            );
            const meta = !isEditing && (endsRun || selected === m.id || (!!m.edited_at && !m.deleted) || (canAct && !tappable)) && (
              <span className="mt-0.5 flex items-center gap-2 px-1 text-[10.5px] text-subtle">
                {m.pending && !m.edited_at ? "Sending…" : clockTime(m.created_at)}
                {m.edited_at && !m.deleted && <span title={`Edited ${clockTime(m.edited_at)}`}>· edited</span>}
                {canAct && !tappable && (
                  <button type="button" onClick={() => setSelected((s) => (s === m.id ? null : m.id))} aria-label="Message options" aria-expanded={selected === m.id} className="font-medium text-muted hover:text-fg hover:underline">
                    {selected === m.id ? "Less" : "More"}
                  </button>
                )}
                {selected === m.id && (
                  <>
                    {canEdit && (
                      <button type="button" onClick={() => startEdit(m)} className="font-medium text-accent hover:underline">
                        Edit
                      </button>
                    )}
                    <button type="button" onClick={() => remove(m)} className="font-medium text-red-300 hover:underline">
                      Delete
                    </button>
                  </>
                )}
              </span>
            );

            if (!m.deleted && m.kind === "summary" && m.data) {
              return (
                <li key={m.id}>
                  {dayRow}
                  <div className="flex flex-col items-center py-1.5">
                    <div className="w-full max-w-md"><EventSummary data={m.data} /></div>
                    {meta}
                  </div>
                </li>
              );
            }

            if (!m.deleted && m.kind === "event") {
              return (
                <li key={m.id}>
                  {dayRow}
                  <div className="flex flex-col items-center py-1.5">
                    <div className="w-full max-w-md">
                      {m.event ? (
                        <GroupEventCard
                          item={{ event: m.event, shared_by: m.sender, note: m.body || null, shared_at: m.created_at, interested: [], going: [], my_status: null }}
                          groupId={conversationId}
                          kind="channel"
                          viewerId={me.id}
                          canModerate={false}
                          saved={saved.has(m.event.id)}
                          onSaved={(on) => setSaved((set) => {
                            const copy = new Set(set);
                            if (on) copy.add(m.event!.id);
                            else copy.delete(m.event!.id);
                            return copy;
                          })}
                          inChat
                        />
                      ) : (
                        <p className="rounded-[18px] border border-dashed border-ink/15 px-4 py-3 text-center text-sm text-muted">This event isn&apos;t available any more.</p>
                      )}
                    </div>
                    {editor}
                    {meta}
                  </div>
                </li>
              );
            }

            const bubble = `whitespace-pre-wrap break-words rounded-[18px] px-3.5 py-2 text-left text-[14.5px] leading-snug transition-opacity ${
              m.deleted
                ? "border border-dashed border-ink/15 bg-transparent italic text-muted"
                : mine
                  ? "bg-gradient text-bg"
                  : "bg-ink/[0.08] text-fg light:bg-surface light:shadow-[var(--card-shadow)]"
            } ${m.pending ? "opacity-60" : ""}`;

            return (
              <li key={m.id}>
                {dayRow}
                <div className={`flex items-end gap-2 ${mine ? "justify-end" : ""} ${startsRun && !newDay ? "pt-2" : ""}`}>
                  {!mine && kind !== "direct" && (
                    <span className="w-7 shrink-0">{endsRun && m.sender && <Avatar src={m.sender.avatar_url} name={displayName(m.sender)} size={28} />}</span>
                  )}
                  <div className={`flex max-w-[78%] flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
                    {!mine && kind !== "direct" && startsRun && m.sender && <span className="-mb-0.5 px-1 text-[11px] font-medium text-muted">{firstName(m.sender)}</span>}
                    {!m.deleted && !!m.attachments?.length && <MessageAttachments attachments={m.attachments} />}
                    {isEditing ? editor : m.deleted || tappable ? (
                      <button
                        type="button"
                        disabled={!canAct}
                        onClick={() => setSelected((s) => (s === m.id ? null : m.id))}
                        aria-label={canAct ? "Message options" : undefined}
                        className={`${bubble} disabled:cursor-text`}
                      >
                        {m.deleted ? "Message deleted" : m.body}
                      </button>
                    ) : m.body ? (
                      <p className={bubble}><Linkified text={m.body} /></p>
                    ) : null}
                    {!m.deleted && m.links?.map((link) => <LinkPreview key={link.id} link={link} />)}
                    {meta}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <div className="h-2" />

      <div className="sticky bottom-[calc(max(env(safe-area-inset-bottom),12px)+5.25rem)] z-20 mt-auto px-3 pt-2 md:bottom-4">
        {error && <p role="alert" className="mb-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
        {uploads.length > 0 && allowed.post && (
          <ul aria-label="Files to send" className="mb-2 flex gap-2 overflow-x-auto pb-1">
            {uploads.map((u) => <UploadChip key={u.key} upload={u} onRemove={() => dropUpload(u.key)} />)}
          </ul>
        )}
        {allowed.post ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="glass-strong relative flex items-end gap-1 rounded-[24px] p-1.5"
          >
            <button
              type="button"
              aria-label="Attach a file"
              aria-expanded={attachOpen}
              onClick={() => setAttachOpen((o) => !o)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-ink/[0.06] hover:text-fg active:scale-95"
            >
              <SocialIcon name="plus" className={`h-5 w-5 transition-transform duration-200 motion-reduce:transition-none ${attachOpen ? "rotate-45" : ""}`} />
            </button>
            {attachOpen && (
              <>
                <button type="button" aria-label="Close attach menu" tabIndex={-1} onClick={() => setAttachOpen(false)} className="fixed inset-0 z-10 cursor-default" />
                <div className="glass-strong absolute bottom-full left-0 z-20 mb-2 w-44 overflow-hidden rounded-[18px] p-1">
                  <AttachOption icon="image" label="Image" accept="image/jpeg,image/png,image/webp" onChange={(e) => pickFiles("image", e)} />
                  <AttachOption icon="file" label="PDF" accept="application/pdf,.pdf" onChange={(e) => pickFiles("doc", e)} />
                </div>
              </>
            )}
            <label htmlFor={`composer-${conversationId}`} className="sr-only">Message</label>
            <textarea
              id={`composer-${conversationId}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={() => kick.current()}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={MAX_LENGTH}
              placeholder="Message"
              className="field-sizing-content max-h-40 min-h-10 flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] text-fg outline-none placeholder:text-subtle"
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={uploading || (!draft.trim() && ready.length === 0)}
              className="bg-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-bg transition active:scale-95 disabled:opacity-40"
            >
              <SocialIcon name="send" className="h-[18px] w-[18px]" />
            </button>
          </form>
        ) : (
          <div className="glass-strong rounded-[20px] px-4 py-3 text-center text-sm text-muted">{notice ?? "You can't send messages here."}</div>
        )}
        {draft.length > MAX_LENGTH - 200 && (
          <p className="mt-1 text-right text-[11px] text-muted tabular-nums">{draft.length}/{MAX_LENGTH}</p>
        )}
      </div>
    </div>
  );
}

function AttachOption({ icon, label, accept, onChange }: {
  icon: "image" | "file";
  label: string;
  accept: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-sm font-medium transition-colors hover:bg-ink/[0.07] has-focus-visible:outline has-focus-visible:outline-2 has-focus-visible:outline-accent">
      <SocialIcon name={icon} className="h-[18px] w-[18px] text-muted" />
      {label}
      <input type="file" accept={accept} multiple onChange={onChange} className="sr-only" />
    </label>
  );
}

/** A file waiting in the composer: its thumbnail or name, uploading, ready or refused. */
function UploadChip({ upload, onRemove }: { upload: Upload; onRemove: () => void }) {
  const busy = !upload.attachment && !upload.error;
  return (
    <li className={`glass relative flex w-56 shrink-0 items-center gap-2 rounded-[14px] p-1.5 pr-8 ${upload.error ? "border-red-400/30" : ""}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-ink/[0.06] text-muted">
        {upload.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={upload.thumb} alt="" className={`h-full w-full object-cover ${busy ? "opacity-50" : ""}`} />
        ) : (
          <SocialIcon name="file" className="h-[18px] w-[18px]" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium">{upload.name}</span>
        {upload.error ? (
          <span role="alert" title={upload.error} className="line-clamp-2 text-[11px] leading-tight text-red-300">{upload.error}</span>
        ) : (
          <span aria-live="polite" className="block text-[11px] text-muted">{busy ? "Uploading…" : "Ready"}</span>
        )}
      </span>
      <button type="button" aria-label={`Remove ${upload.name}`} onClick={onRemove} className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-ink/[0.08] hover:text-fg">
        <SocialIcon name="x" className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

/** More than 5 minutes between two messages starts a new run. */
function gap(a: ChatMessage, b: ChatMessage) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime() > 5 * 60_000;
}
