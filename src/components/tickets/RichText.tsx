import { linkify, paragraphs } from "@/lib/tickets/logic";

/** Plain text with paragraphs and line breaks kept and http(s) links made clickable. Never renders HTML. */
export function RichText({ text, className = "" }: { text: string | null | undefined; className?: string }) {
  const paras = paragraphs(text);
  if (paras.length === 0) return null;
  return (
    <div className={`space-y-3 text-[15px] leading-relaxed text-fg/85 ${className}`}>
      {paras.map((p, i) => (
        <p key={i} className="whitespace-pre-line break-words">
          {linkify(p).map((part, j) =>
            part.type === "link" ? (
              <a
                key={j}
                href={part.href}
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
                className="font-medium text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
              >
                {part.value}
              </a>
            ) : (
              part.value
            ),
          )}
        </p>
      ))}
    </div>
  );
}
