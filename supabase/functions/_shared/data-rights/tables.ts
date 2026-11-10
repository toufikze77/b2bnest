// HMRC P7b: what "Download my data" and "Download company data" contain (docs/hmrc-p7b/README.md).
// Pure data and small pure helpers: imported by the data-export Edge Function, its Deno tests and the vitest coverage
// test (src/test/dataExportCoverage.test.ts), which fails when a table with user_id, organization_id or company_id is
// neither exported nor listed in NOT_EXPORTED with a reason.

/** Rows that belong to one person, read with that person's own sign-in (RLS) unless `via: 'service'`. */
export interface AccountTable {
  table: string;
  /** The column that names the person. */
  by: 'user_id' | 'id';
  /** 'caller': the person's own JWT, so RLS applies. 'service': no browser read policy exists; filtered by `by` here. */
  via: 'caller' | 'service';
  /** For tables that also carry a company column: only the person's rows with no company (company rows are in the company download). */
  personalOnly?: 'organization_id' | 'company_id';
  /** Columns never exported for this table (on top of SENSITIVE_COLUMN). */
  omit?: string[];
}

/** Rows that belong to one company, read with the service role after the owner/admin check, filtered by company. */
export interface CompanyTable {
  table: string;
  by: 'organization_id' | 'company_id' | 'id';
  /** An explicit column list where only part of the row may leave (e.g. the HMRC connection without its tokens). */
  select?: string;
  omit?: string[];
  /** Also written as CSV. */
  csv?: boolean;
}

/** Child rows of exported company rows (they have no company column of their own). */
export interface CompanyChildTable { table: string; parent: string; fk: string; omit?: string[] }

export const ACCOUNT_TABLES: AccountTable[] = [
  { table: 'profiles', by: 'id', via: 'caller' },
  ...[
    'ai_conversations', 'ai_credit_lots', 'ai_workflows', 'ai_workspaces', 'audit_logs', 'b2b_form_submissions', 'bank_accounts', 'bank_transactions',
    'banking_audit_logs', 'business_insights', 'crm_contacts', 'crm_deals', 'data_rights_requests', 'document_email_log', 'documents', 'feedback_requests',
    'forum_posts', 'forum_replies', 'free_tool_items', 'integration_audit_logs', 'integration_settings', 'marketing_audiences', 'marketing_campaigns',
    'marketing_consents', 'marketing_content_items', 'note_categories', 'notes', 'notification_logs', 'notification_type_prefs', 'notifications',
    'organization_members', 'outgoings', 'payment_audit_logs', 'payments', 'payroll_employees', 'payroll_runs', 'payroll_submissions', 'post_comments',
    'post_likes', 'products_services', 'project_activities', 'project_members', 'quotes', 'security_audit_logs', 'social_posts', 'staking_rewards',
    'staking_transactions', 'staking_wallet_links', 'subscribers', 'suppliers', 'support_customers', 'team_members', 'template_events',
    'time_tracker_settings', 'todo_comments', 'todo_history', 'todo_subtasks', 'user_ai_preferences', 'user_document_templates', 'user_documents',
    'user_favorite_tools', 'user_favorites', 'user_notification_preferences', 'user_roles', 'user_stakes', 'workflow_run_logs',
  ].map((table): AccountTable => ({ table, by: 'user_id', via: 'caller' })),
  // Personal rows of tables that also hold company records: only the rows with no company.
  { table: 'invoices', by: 'user_id', via: 'caller', personalOnly: 'organization_id' },
  { table: 'expenses', by: 'user_id', via: 'caller', personalOnly: 'organization_id' },
  { table: 'bills', by: 'user_id', via: 'caller', personalOnly: 'organization_id' },
  { table: 'projects', by: 'user_id', via: 'caller', personalOnly: 'organization_id' },
  { table: 'todos', by: 'user_id', via: 'caller', personalOnly: 'organization_id' },
  { table: 'project_time_entries', by: 'user_id', via: 'caller', personalOnly: 'company_id' },
  // No browser read policy: read with the service role, filtered by the person here.
  { table: 'advertisements', by: 'user_id', via: 'service' },
  { table: 'ai_credit_ledger', by: 'user_id', via: 'service' },
  { table: 'ai_topup_checkouts', by: 'user_id', via: 'service' },
  { table: 'email_optouts', by: 'user_id', via: 'service' },
  { table: 'master_access', by: 'user_id', via: 'service' },
  { table: 'trial_email_log', by: 'user_id', via: 'service' },
  { table: 'user_integrations', by: 'user_id', via: 'service' },
  { table: 'hmrc_settings', by: 'user_id', via: 'service', personalOnly: 'organization_id', omit: ['client_id'] },
];

export const COMPANY_TABLES: CompanyTable[] = [
  { table: 'organizations', by: 'id' },
  { table: 'organization_members', by: 'organization_id', omit: ['permissions'] },
  { table: 'organization_invitations', by: 'organization_id', omit: ['email'] },
  { table: 'organization_billing', by: 'organization_id' },
  { table: 'invoices', by: 'organization_id', csv: true },
  { table: 'expenses', by: 'organization_id', csv: true },
  { table: 'bills', by: 'organization_id', csv: true },
  { table: 'projects', by: 'organization_id' },
  { table: 'todos', by: 'organization_id' },
  { table: 'project_time_entries', by: 'company_id' },
  { table: 'rota_employees', by: 'organization_id' },
  { table: 'rota_shifts', by: 'organization_id' },
  { table: 'rota_week_publications', by: 'organization_id' },
  { table: 'rota_leave_allowances', by: 'company_id' },
  { table: 'rota_leave_requests', by: 'company_id' },
  { table: 'teams', by: 'organization_id' },
  { table: 'template_applications', by: 'organization_id' },
  { table: 'support_settings', by: 'organization_id' },
  { table: 'support_categories', by: 'organization_id' },
  { table: 'support_agents', by: 'organization_id' },
  { table: 'support_customers', by: 'organization_id' },
  { table: 'support_tickets', by: 'organization_id' },
  { table: 'support_messages', by: 'organization_id' },
  { table: 'support_attachments', by: 'organization_id' },
  { table: 'support_ticket_feedback', by: 'organization_id' },
  { table: 'support_notification_prefs', by: 'organization_id' },
  { table: 'hmrc_settings', by: 'organization_id', omit: ['client_id'] },
  { table: 'hmrc_submission_logs', by: 'organization_id' },
  // The nine boxes as sent and HMRC's receipt (the business's VAT return record).
  { table: 'hmrc_vat_submissions', by: 'organization_id', csv: true },
  // Connection status only: never a token.
  { table: 'hmrc_connections', by: 'company_id', select: 'environment,status,scopes,connected_at,expires_at,updated_at' },
  // B2BNEST's HMRC trail for this company (event codes only).
  { table: 'hmrc_audit_log', by: 'company_id' },
  // Finance phase 2 ledger (docs/ledger): the company's chart of accounts and its journals. journal_lines is also a CSV.
  { table: 'ledger_settings', by: 'organization_id' },
  { table: 'ledger_accounts', by: 'organization_id' },
  { table: 'journal_entries', by: 'organization_id' },
  { table: 'journal_lines', by: 'organization_id', csv: true },
  // Finance phase 3a (docs/ledger-auto): the automatic-postings switch, which journal posted which invoice, and the
  // invoices that need attention.
  { table: 'ledger_auto_settings', by: 'organization_id' },
  { table: 'ledger_postings', by: 'organization_id' },
  { table: 'ledger_post_issues', by: 'organization_id' },
];

export const COMPANY_CHILD_TABLES: CompanyChildTable[] = [
  { table: 'project_members', parent: 'projects', fk: 'project_id' },
  { table: 'project_activities', parent: 'projects', fk: 'project_id' },
  { table: 'todo_subtasks', parent: 'todos', fk: 'todo_id' },
  { table: 'todo_comments', parent: 'todos', fk: 'todo_id' },
  { table: 'todo_history', parent: 'todos', fk: 'todo_id' },
  { table: 'team_members', parent: 'teams', fk: 'team_id' },
];

/** Tables with user_id, organization_id or company_id that are deliberately left out, with the reason shown in README.txt. */
export const NOT_EXPORTED: Record<string, string> = {
  user_2fa_codes: 'Two-step sign-in codes: never exported, for your security.',
  user_2fa_settings: 'Two-step sign-in secrets: never exported, for your security.',
  user_2fa_attempts: 'Two-step sign-in attempt counters: security records, never exported.',
  hmrc_oauth_states: 'Short-lived HMRC sign-in state that expires within minutes; it holds no lasting data.',
  demo_readonly_users: 'An internal switch that makes the demo account view only.',
  trial_email_outbox: 'A short-lived queue of emails waiting to be sent; what was sent is in trial_email_log.',
  onboarding_email_outbox: 'A short-lived queue of emails waiting to be sent.',
  support_email_outbox: 'A short-lived queue of emails waiting to be sent.',
  phase12_subscribers_backup: 'A one-off internal copy taken during a 2026 migration; your live record is in subscribers.',
  job_postings: 'Linked to the old public companies directory, not to your B2BNEST company; it holds no personal column.',
  _data_rights_gate: 'An internal, always-empty table used by the deletion and purge functions.',
  ledger_post_queue: 'A short-lived list of invoices waiting to be posted to the ledger; what was posted is in ledger_postings.',
};

/** Column names that never leave B2BNEST, whatever the table: tokens, secrets, passwords, codes, keys and payment-provider references. */
export const SENSITIVE_COLUMN = /(^|_)(access|refresh|id|session|bearer|api|auth|oauth|reset|verification|invite|invitation|unsubscribe|confirmation)?_?token(_enc|_hash)?$|_enc$|secret|password|passwd|totp|(^|_)otp(_|$)|(^|_)code_hash$|^code$|api_?key|private_?key|credentials?$|^stripe_(customer|subscription|price|session|payment_intent)_id$|webhook/i;

export const ACCOUNT_BUCKETS = ['user-avatars', 'company-logos', 'advertisement-images', 'service-images'] as const;
export const COMPANY_BUCKETS = ['support-attachments'] as const;
export const SIGNED_URL_SECONDS = 3600;

/** Removes sensitive columns (and the table's own omit list). Returns the row and the names it left out. */
export function redact(row: Record<string, unknown>, omit: string[] = []): { row: Record<string, unknown>; left: string[] } {
  const out: Record<string, unknown> = {};
  const left: string[] = [];
  for (const [k, v] of Object.entries(row)) {
    if (SENSITIVE_COLUMN.test(k) || omit.includes(k)) left.push(k);
    else out[k] = v;
  }
  return { row: out, left };
}

/** Every table either download reads (for the coverage test and the README). */
export function exportedTables(): Set<string> {
  return new Set([...ACCOUNT_TABLES.map((t) => t.table), ...COMPANY_TABLES.map((t) => t.table), ...COMPANY_CHILD_TABLES.map((t) => t.table)]);
}
