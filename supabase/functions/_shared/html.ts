/**
 * HTML-escape user-controlled strings before interpolating into email templates.
 * Prevents HTML/script injection in transactional emails.
 */
export function escapeHtml(input: unknown): string {
  if (input === null || input === undefined) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * HTML-escape, then convert newlines into <br> tags. Safe for multi-line
 * user-supplied text inserted into HTML email bodies.
 */
export function escapeHtmlMultiline(input: unknown): string {
  return escapeHtml(input).replace(/\r?\n/g, "<br>");
}
