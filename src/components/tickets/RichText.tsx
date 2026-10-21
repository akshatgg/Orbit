import type { ReactNode } from "react";
import { inlineParts, textBlocks, type InlinePart, type TextBlock } from "@/lib/tickets/logic";

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

function renderBlock(block: TextBlock, key: number): ReactNode {
  switch (block.type) {
    case "heading":
      return <h3 key={key} className="pt-1 text-base font-semibold text-fg">{renderParts(inlineParts(block.text))}</h3>;
    case "bullets":
      return (
        <ul key={key} className="list-disc space-y-1.5 pl-5 marker:text-muted">
          {block.items.map((item, i) => <li key={i} className="break-words pl-1">{renderParts(inlineParts(item))}</li>)}
        </ul>
      );
    case "numbered":
      return (
        <ol key={key} start={block.start} className="list-decimal space-y-1.5 pl-5 marker:text-muted">
          {block.items.map((item, i) => <li key={i} className="break-words pl-1">{renderParts(inlineParts(item))}</li>)}
        </ol>
      );
    default:
      return <p key={key} className="whitespace-pre-line break-words">{renderParts(inlineParts(block.text))}</p>;
  }
}

/** Plain text with headings, paragraphs, lists, links and safe bold/italic. Never renders arbitrary HTML. */
export function RichText({ text, className = "" }: { text: string | null | undefined; className?: string }) {
  const blocks = textBlocks(text);
  if (blocks.length === 0) return null;
  return <div className={`space-y-3 text-[15px] leading-relaxed text-fg/85 ${className}`}>{blocks.map(renderBlock)}</div>;
}
