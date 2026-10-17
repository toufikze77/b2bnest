/** Contact counts for the CRM summary row, from loaded contacts only. A missing status counts as a lead, as the table shows it. */
export function contactStatusCounts(contacts: { status: string | null }[]) {
  const counts = { all: contacts.length, lead: 0, prospect: 0, customer: 0 };
  for (const c of contacts) {
    const s = (c.status || 'lead').toLowerCase();
    if (s === 'lead' || s === 'prospect' || s === 'customer') counts[s]++;
  }
  return counts;
}

/** Status a contact is filtered and labelled by: a missing status reads as lead. */
export const contactStatus = (c: { status: string | null }) => (c.status || 'lead').toLowerCase();
