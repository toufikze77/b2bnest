import { useMemo } from "react";
import { renderNoteHtml } from "@/lib/noteHtml";
import { cn } from "@/lib/utils";
import "./note-content.css";

/** The start of a note on its card. Rich text is sanitised and shown with real lists; other formats as text. */
export function NoteContentPreview({ content, format, className }: { content: string | null | undefined; format: string; className?: string }) {
  const html = useMemo(() => (format === "richtext" ? renderNoteHtml(content) : null), [content, format]);
  if (html === null) {
    return <p className={cn("line-clamp-3", className)}>{content?.substring(0, 150)}...</p>;
  }
  return (
    <div
      data-note-content
      className={cn("note-content pointer-events-none max-h-40 overflow-hidden [mask-image:linear-gradient(to_bottom,black_75%,transparent)]", className)}
      // Sanitised by DOMPurify in renderNoteHtml.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
