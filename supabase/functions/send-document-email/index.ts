// NOT DEPLOYED (Phase 4b). Deploy only after the owner approves; see docs/phase4b-document-email/README.md.
// Needs the document_email_log table (docs/phase4b-document-email/proposal.sql), DOCUMENT_EMAIL_ENABLED=true and the
// account listed in DOCUMENT_EMAIL_ALLOWED_USERS (unset = nobody may send).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { makeHandler, type DocRow } from "./handler.ts";
import { sendSmtp } from "../workflow-send-email/smtp.ts";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });

serve(makeHandler({
  env: (n) => Deno.env.get(n),
  getUser: async (token) => {
    const { data, error } = await admin.auth.getUser(token);
    return error || !data.user ? null : { id: data.user.id, email: data.user.email ?? null, email_confirmed_at: data.user.email_confirmed_at ?? null };
  },
  // The document is read with the caller's own token, so row-level security decides what is visible.
  loadDocument: async (token, kind, id) => {
    const asUser = createClient(url, anon, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
    const cols = kind === "invoice"
      ? "id,user_id,status,archived_at,client_email,client_name,company_name,total_amount,currency,invoice_number,due_date"
      : "id,user_id,status,archived_at,client_email,client_name,company_name,total_amount,currency,quote_number,valid_until";
    const { data, error } = await asUser.from(kind === "invoice" ? "invoices" : "quotes").select(cols).eq("id", id).maybeSingle();
    if (error || !data) return null;
    const r = data as Record<string, unknown>;
    return {
      id: String(r.id), user_id: String(r.user_id), kind, status: (r.status as string) ?? null, archived_at: (r.archived_at as string) ?? null,
      client_email: (r.client_email as string) ?? null, client_name: (r.client_name as string) ?? null, company_name: (r.company_name as string) ?? null,
      total_amount: (r.total_amount as number) ?? null, currency: (r.currency as string) ?? null,
      number: ((kind === "invoice" ? r.invoice_number : r.quote_number) as string) ?? null,
      date: ((kind === "invoice" ? r.due_date : r.valid_until) as string) ?? null,
    } satisfies DocRow;
  },
  // document_email_recent_counts (proposal.sql) counts accepted + uncertain sends since `since`; service role only.
  recentCounts: async (userId, documentId, since) => {
    const { data, error } = await admin.rpc("document_email_recent_counts", { _user_id: userId, _document_id: documentId, _since: since });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) throw new Error("limit check failed");
    return { user: Number(row.user_count) || 0, document: Number(row.document_count) || 0 };
  },
  log: async (row) => {
    const { error } = await admin.from("document_email_log").insert(row);
    if (error) throw new Error(error.message);
  },
  send: (cfg, envelope, raw) => sendSmtp(cfg, { from: envelope.from, to: [envelope.to], subject: "" }, raw),
}));
