import type { ReactNode } from "react";
import { inlineParts, paragraphs, type InlinePart } from "@/lib/tickets/logic";

function renderParts(parts: InlinePart[]): ReactNode[] {
  return parts.map((part, index) => {
    switch (part.type) {
      case "link":
        return (
          <a
            key={index}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            className="font-medium text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
          >
            {part.value}
          </a>
        );
      case "bold":
        return <strong key={index} className="font-semibold text-fg">{renderParts(part.children)}</strong>;
      case "italic":
        return <em key={index}>{renderParts(part.children)}</em>;
      default:
        return part.value;
    }
  });
}

/** Plain text with paragraphs, links and safe bold/italic. Never renders arbitrary HTML. */
export function RichText({ text, className = "" }: { text: string | null | undefined; className?: string }) {
  const paras = paragraphs(text);
  if (paras.length === 0) return null;
  return (
    <div className={`space-y-3 text-[15px] leading-relaxed text-fg/85 ${className}`}>
      {paras.map((p, i) => (
        <p key={i} className="whitespace-pre-line break-words">{renderParts(inlineParts(p))}</p>
      ))}
    </div>
  );
}
