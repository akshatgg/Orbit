"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SocialIcon } from "@/components/social/icons";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { fileSize } from "@/lib/social/format";
import type { MessageAttachment, MessageLink } from "@/types/social";

/** http(s) only: what a chat message or a scraped page says never becomes another kind of link. */
export function safeHref(url: string | null | undefined) {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

const URLS = /(https?:\/\/[^\s<>"']+)/gi;
const TRAILING = /[.,;:!?)\]]+$/;

/** A message's text with its links clickable. */
export function Linkified({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  for (const [i, part] of text.split(URLS).entries()) {
    if (i % 2 === 0) {
      parts.push(part);
      continue;
    }
    // Punctuation after a link belongs to the sentence.
    const url = part.replace(TRAILING, "");
    parts.push(
      <a key={i} href={url} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2 [overflow-wrap:anywhere]">
        {url}
      </a>,
      part.slice(url.length),
    );
  }
  return <>{parts}</>;
}

export function hasLink(text: string) {
  return /https?:\/\/\S/i.test(text);
}

/** An uploaded image, with a quiet placeholder when it won't load. */
export function ChatImage({ src, alt, width, className = "" }: { src: string; alt: string; width?: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <span role="img" aria-label={alt ? `${alt} (couldn't load)` : "Image couldn't load"} className={`flex h-full min-h-24 w-full items-center justify-center bg-ink/[0.06] text-subtle ${className}`}>
        <SocialIcon name="image" className="h-6 w-6" />
      </span>
    );
  }
  return (
    <img
      src={width ? cloudinaryUrl(src, { width }) : src}
      alt={alt}
      loading="lazy"
      onError={() => setBroken(true)}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}

/** Tall photos sit in a square, wide ones in their own shape, so a grid of one stays readable. */
function singleRatio({ width, height }: MessageAttachment) {
  if (!width || !height) return "4 / 3";
  return `${Math.max(1, Math.min(width / height, 16 / 9))}`;
}

/** A message's images as a grid (tap for the lightbox), then its PDFs as rows. */
export function MessageAttachments({ attachments }: { attachments: MessageAttachment[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const images = attachments.filter((a) => a.kind === "image");
  const docs = attachments.filter((a) => a.kind === "doc");
  return (
    <div className="w-[min(72vw,22rem)] space-y-1.5">
      {images.length > 0 && (
        <div className={`grid gap-1 overflow-hidden rounded-[18px] ${images.length > 1 ? "grid-cols-2" : ""}`}>
          {images.map((image, i) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setOpen(i)}
              aria-label={`Open image${image.name ? `: ${image.name}` : ""}`}
              style={{ aspectRatio: images.length === 1 ? singleRatio(image) : "1 / 1" }}
              className={`block overflow-hidden bg-ink/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${images.length % 2 === 1 && i === 0 && images.length > 1 ? "col-span-2 !aspect-[2/1]" : ""}`}
            >
              <ChatImage src={image.url} alt={image.name ?? ""} width={images.length === 1 ? 704 : 352} />
            </button>
          ))}
        </div>
      )}
      {docs.map((doc) => <PdfRow key={doc.id} doc={doc} />)}
      {open !== null && <Lightbox images={images} index={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** A PDF: its name and size, opening in a new tab. */
export function PdfRow({ doc, sub }: { doc: Pick<MessageAttachment, "url" | "name" | "bytes">; sub?: string }) {
  const href = safeHref(doc.url);
  const detail = [fileSize(doc.bytes), sub].filter(Boolean).join(" · ");
  const body = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
        <SocialIcon name="file" className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-fg">{doc.name || "Document.pdf"}</span>
        <span className="block truncate text-xs text-muted">PDF{detail && ` · ${detail}`}</span>
      </span>
    </>
  );
  const row = "glass flex items-center gap-3 rounded-[16px] px-3 py-2.5 text-left";
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`${row} transition-colors hover:bg-ink/[0.07]`}>{body}</a>
  ) : (
    <span className={row}>{body}</span>
  );
}

/** A link's preview once the API has fetched one; nothing until then (the text already links it). */
export function LinkPreview({ link }: { link: MessageLink }) {
  const href = safeHref(link.url);
  const image = safeHref(link.image_url);
  const [broken, setBroken] = useState(false);
  if (!href || (!link.title && !link.description)) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="glass block w-[min(72vw,22rem)] overflow-hidden rounded-[16px] text-left transition-colors hover:bg-ink/[0.07]">
      {image && !broken && (
        <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="aspect-[1.91/1] w-full object-cover" />
      )}
      <span className="block px-3 py-2.5">
        {link.title && <span className="line-clamp-2 text-sm font-semibold leading-snug text-fg">{link.title}</span>}
        {link.description && <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">{link.description}</span>}
        {link.domain && <span className="mt-1 block truncate text-[11px] text-subtle">{link.domain}</span>}
      </span>
    </a>
  );
}

/** The images of a message or a Media tab, one at a time, on the top layer. */
export function Lightbox({ images, index, onClose }: {
  images: Pick<MessageAttachment, "url" | "name">[];
  index: number;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [at, setAt] = useState(index);
  const count = images.length;
  const image = images[Math.min(at, count - 1)];

  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);

  function step(by: number) {
    setAt((i) => (i + by + count) % count);
  }

  return (
    <dialog
      ref={dialog}
      aria-label={image?.name ?? "Image"}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
      onKeyDown={(e) => {
        if (count < 2) return;
        if (e.key === "ArrowRight") step(1);
        else if (e.key === "ArrowLeft") step(-1);
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none bg-black/90 p-0 text-white backdrop:bg-black/90"
    >
      {image && (
        <img
          src={image.url}
          alt={image.name ?? ""}
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 m-auto max-h-[calc(100dvh-6rem)] max-w-full object-contain"
        />
      )}
      <button
        type="button"
        autoFocus
        aria-label="Close"
        onClick={() => dialog.current?.close()}
        className="glass-float absolute right-3 top-[max(env(safe-area-inset-top),0.75rem)] flex h-10 w-10 items-center justify-center rounded-full"
      >
        <SocialIcon name="x" className="h-5 w-5" />
      </button>
      {count > 1 && (
        <div className="absolute inset-x-0 bottom-[max(env(safe-area-inset-bottom),0.75rem)] flex items-center justify-center gap-4">
          <button type="button" aria-label="Previous image" onClick={() => step(-1)} className="glass-float flex h-10 w-10 items-center justify-center rounded-full">
            <SocialIcon name="back" className="h-5 w-5" />
          </button>
          <span className="text-sm tabular-nums" aria-live="polite">{Math.min(at, count - 1) + 1} / {count}</span>
          <button type="button" aria-label="Next image" onClick={() => step(1)} className="glass-float flex h-10 w-10 items-center justify-center rounded-full">
            <SocialIcon name="chevron" className="h-5 w-5" />
          </button>
        </div>
      )}
    </dialog>
  );
}
