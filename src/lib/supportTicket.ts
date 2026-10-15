/** Shared ticketing rules used by the staff desk and the customer portal. Mirrors the database checks. */
export const TICKET_STATUSES = ['new', 'open', 'waiting_customer', 'resolved', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const STATUS_LABEL: Record<TicketStatus, string> = {
  new: 'New', open: 'Open', waiting_customer: 'Waiting for customer', resolved: 'Resolved', closed: 'Closed',
};
export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_TEXT = 10000;
export const ALLOWED_MIME = [
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export function validateFile(f: { name: string; size: number; type: string }): string | null {
  if (f.size <= 0) return 'This file is empty.';
  if (f.size > MAX_FILE_BYTES) return 'Files must be 10 MB or smaller.';
  if (!ALLOWED_MIME.includes(f.type)) return 'Only images, PDF, text, CSV, Word (.docx) and Excel (.xlsx) files are allowed.';
  return null;
}

/** Storage path: <company>/<ticket>/<random>-<safe name>. The database rejects any other shape. */
export function attachmentPath(orgId: string, ticketId: string, name: string, rand: string): string {
  const safe = name.replace(/[^\w.-]+/g, '_').slice(-120) || 'file';
  return `${orgId}/${ticketId}/${rand}-${safe}`;
}

/** Customers may only reopen their own resolved/closed tickets; staff may set any status. */
export const customerCanReopen = (s: TicketStatus) => s === 'resolved' || s === 'closed';
export const customerCanReply = (s: TicketStatus) => s !== 'closed';

export function validateTicket(subject: string, description: string): string | null {
  if (!subject.trim()) return 'Please add a subject.';
  if (subject.trim().length > 200) return 'Subject must be 200 characters or fewer.';
  if (!description.trim()) return 'Please describe the problem.';
  if (description.length > MAX_TEXT) return 'Description must be 10,000 characters or fewer.';
  return null;
}
