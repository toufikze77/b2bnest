import { supabase } from '@/integrations/supabase/client';
import type { TicketStatus } from '@/lib/supportTicket';
import { attachmentPath } from '@/lib/supportTicket';

// Tables come from a reviewed migration that is not applied yet; they are absent from generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
export const BUCKET = 'support-attachments';

export type SupportSettings = { organization_id: string; support_name: string; logo_url: string | null; support_hours: string | null; time_zone: string | null; portal_enabled: boolean };
export type Category = { id: string; name: string; archived_at: string | null };
export type Ticket = {
  id: string; organization_id: string; reference: string; subject: string; description: string; category_id: string | null;
  priority: string; status: TicketStatus; requester_id: string; assignee_id: string | null; created_at: string; updated_at: string;
};
export type Message = { id: string; author_id: string; body: string; is_internal: boolean; created_at: string };
export type Attachment = { id: string; message_id: string | null; storage_path: string; file_name: string; size_bytes: number; is_internal: boolean };
export type Customer = { id: string; email: string; display_name: string | null; client_name: string | null; user_id: string | null; revoked_at: string | null };
export type Agent = { user_id: string };

export class NotEnabledError extends Error {
  constructor() { super('Support ticketing is not switched on yet. It needs an approved database update.'); }
}
const friendly = (e: { code?: string; message?: string }): Error => {
  if (e.code === 'PGRST205' || e.code === 'PGRST202' || e.code === '42P01' || e.code === '42883' || /does not exist|schema cache/i.test(e.message || '')) return new NotEnabledError();
  return new Error(e.message || 'Something went wrong. Your text is still in the form — please try again.');
};
const run = async <T,>(p: PromiseLike<{ data: T; error: { code?: string; message?: string } | null }>): Promise<T> => {
  const { data, error } = await p;
  if (error) throw friendly(error);
  return data;
};

export const getSettings = (org: string) => run<SupportSettings | null>(db.from('support_settings').select('*').eq('organization_id', org).maybeSingle());
export const saveSettings = async (s: Partial<SupportSettings> & { organization_id: string }, exists: boolean) => {
  const q = exists ? db.from('support_settings').update(s).eq('organization_id', s.organization_id).select('organization_id') : db.from('support_settings').insert(s).select('organization_id');
  const rows = await run<unknown[]>(q);
  if (!rows?.length) throw new Error('Nothing was saved. You may not have permission to manage support for this company.');
};
export const listCategories = (org: string) => run<Category[]>(db.from('support_categories').select('id,name,archived_at').eq('organization_id', org).order('name'));
export const addCategory = (org: string, name: string) => run(db.from('support_categories').insert({ organization_id: org, name: name.trim() }).select('id'));
export const setCategoryArchived = (id: string, archived: boolean) => run(db.from('support_categories').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', id).select('id'));
export const listAgents = (org: string) => run<Agent[]>(db.from('support_agents').select('user_id').eq('organization_id', org));
export const addAgent = (org: string, userId: string, me: string) => run(db.from('support_agents').insert({ organization_id: org, user_id: userId, added_by: me }).select('user_id'));
export const removeAgent = (org: string, userId: string) => run(db.from('support_agents').delete().eq('organization_id', org).eq('user_id', userId).select('user_id'));
export const listCustomers = (org: string) => run<Customer[]>(db.from('support_customers').select('*').eq('organization_id', org).order('created_at', { ascending: false }));
export const inviteCustomer = (org: string, email: string, me: string, display_name?: string, client_name?: string) =>
  run(db.from('support_customers').insert({ organization_id: org, email: email.trim().toLowerCase(), invited_by: me, display_name: display_name || null, client_name: client_name || null }).select('id'));
export const setCustomerRevoked = (id: string, revoked: boolean) => run(db.from('support_customers').update({ revoked_at: revoked ? new Date().toISOString() : null }).eq('id', id).select('id'));

export const listTickets = (org: string) => run<Ticket[]>(db.from('support_tickets').select('*').eq('organization_id', org).order('updated_at', { ascending: false }).limit(500));
export const getTicket = (id: string) => run<Ticket | null>(db.from('support_tickets').select('*').eq('id', id).maybeSingle());
export const listMessages = (ticket: string) => run<Message[]>(db.from('support_messages').select('id,author_id,body,is_internal,created_at').eq('ticket_id', ticket).order('created_at'));
export const listAttachments = (ticket: string) => run<Attachment[]>(db.from('support_attachments').select('id,message_id,storage_path,file_name,size_bytes,is_internal').eq('ticket_id', ticket));

/** requestId is generated once per form; retries and double clicks return the same ticket. */
export const createTicket = (org: string, subject: string, description: string, category: string | null, priority: string, requestId: string) =>
  run<string>(db.rpc('support_create_ticket', { _org: org, _subject: subject, _description: description, _category: category, _priority: priority, _client_request_id: requestId }));
export const addMessage = (ticket: string, body: string, internal: boolean, requestId: string) =>
  run<string>(db.rpc('support_add_message', { _ticket: ticket, _body: body, _internal: internal, _client_request_id: requestId }));
export const updateTicket = (ticket: string, p: { status?: TicketStatus; priority?: string; category?: string; assignee?: string | null }) =>
  run(db.rpc('support_update_ticket', { _ticket: ticket, _status: p.status ?? null, _priority: p.priority ?? null, _category: p.category ?? null,
    _assignee: p.assignee ?? null, _set_assignee: p.assignee !== undefined }));
export const claimInvitations = () => run<number>(db.rpc('support_claim_invitations'));
export const myCustomerCompanies = (uid: string) => run<{ organization_id: string }[]>(db.from('support_customers').select('organization_id').eq('user_id', uid).is('revoked_at', null));

/** Uploads then records the file. If recording fails, the upload is removed so no orphan stays readable. */
export async function uploadAttachment(org: string, ticket: string, file: File, internal: boolean, messageId: string | null) {
  const path = attachmentPath(org, ticket, file.name, crypto.randomUUID());
  const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) throw new Error('The file could not be uploaded. The message itself was saved.');
  try {
    await run(db.rpc('support_add_attachment', { _ticket: ticket, _message: messageId, _path: path, _name: file.name.slice(0, 200), _size: file.size, _mime: file.type, _internal: internal }));
  } catch (e) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw e;
  }
}
export async function downloadUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
  if (error || !data) throw new Error('You do not have access to this file.');
  return data.signedUrl;
}
