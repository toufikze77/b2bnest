// Phase 39: saving free-tool work to the account (public.free_tool_items, docs/phase39/proposal.sql).
// Own rows only; any signed-in account that isn't suspended may write (the free tier includes trial-ended accounts and
// accounts with no plan). Before the SQL is applied every call answers "needs a database update" and the tools keep
// working in the browser, so nothing is lost.
import { supabase } from '@/integrations/supabase/client';
import { authUrlWithNext } from '@/lib/onboarding';

export const SAVABLE_TOOLS = [
  'roi-calculator', 'goal-tracker', 'customer-survey-builder', 'cost-calculator', 'setup-checklist', 'compliance', 'best-practices',
] as const;
export type SavableTool = typeof SAVABLE_TOOLS[number];
export const isSavableTool = (t: string | null | undefined): t is SavableTool => !!t && (SAVABLE_TOOLS as readonly string[]).includes(t);

export const MAX_ITEMS_PER_TOOL = 50;
export const MAX_NAME_LENGTH = 120;
/** The database refuses more than 64 KB (pg_column_size); the browser checks the JSON text, which is never smaller. */
export const MAX_DATA_BYTES = 65536;

export interface FreeToolItem<T = unknown> { id: string; tool: SavableTool; name: string; data: T; created_at: string; updated_at: string }

export const NEEDS_DB_UPDATE = 'Saving to your account needs a database update. Your work is still here in this browser.';
export const LIMIT_MESSAGE = `You can save up to ${MAX_ITEMS_PER_TOOL} items in each tool. Delete one first.`;
export const TOO_BIG_MESSAGE = 'This is too big to save (over 64 KB). Remove some of it and try again.';
export const SUSPENDED_SAVE_MESSAGE = "Your account is suspended, so it can't save. The tools still work in this browser.";
export const MFA_MESSAGE = 'Enter your two-step verification code to save to your account.';
export const SAVE_FAILED_MESSAGE = "Couldn't save to your account. Check your connection and try again. Your work is still here.";

/** ok: value is set; otherwise error (plain words) and missing (the database update isn't applied). */
export interface ItemResult<T> { ok: boolean; value?: T; error?: string; missing?: boolean }
type DbError = { code?: string; message?: string; details?: string; hint?: string } | null;

/** Table not there yet (PostgREST PGRST205 / Postgres 42P01): docs/phase39/proposal.sql not applied. */
export const isMissingTable = (e: DbError) =>
  !!e && (e.code === 'PGRST205' || e.code === '42P01' || /free_tool_items/.test(e.message ?? '') && /schema cache|does not exist/i.test(e.message ?? ''));

/** A database error in plain words. */
export function itemError(e: DbError): string {
  if (!e) return SAVE_FAILED_MESSAGE;
  const text = `${e.message ?? ''} ${e.details ?? ''} ${e.hint ?? ''}`;
  if (isMissingTable(e)) return NEEDS_DB_UPDATE;
  if (/FREE_TOOL_ITEM_LIMIT/.test(text)) return LIMIT_MESSAGE;
  if (/MFA_REQUIRED/.test(text)) return MFA_MESSAGE;
  if (/fti_data/.test(text)) return TOO_BIG_MESSAGE;
  if (/fti_name/.test(text)) return `Give it a name of 1 to ${MAX_NAME_LENGTH} characters.`;
  if (e.code === '42501' || /row-level security/i.test(text)) return SUSPENDED_SAVE_MESSAGE;
  return SAVE_FAILED_MESSAGE;
}

export const byteSize = (data: unknown) => new TextEncoder().encode(JSON.stringify(data) ?? '').length;

/** Checked before anything is sent; the database checks the same again. */
export function validateItem(tool: string, name: string, data: unknown): string | null {
  if (!isSavableTool(tool)) return 'This tool can’t save to an account.';
  const n = name.trim();
  if (n.length < 1 || n.length > MAX_NAME_LENGTH) return `Give it a name of 1 to ${MAX_NAME_LENGTH} characters.`;
  if (data === null || typeof data !== 'object') return 'There is nothing to save.';
  if (byteSize(data) > MAX_DATA_BYTES) return TOO_BIG_MESSAGE;
  return null;
}

// public.free_tool_items is not in the generated types until the SQL is applied.
type Query = PromiseLike<{ data: unknown; error: DbError }> & Record<string, (...a: unknown[]) => Query>;
const table = () => (supabase as unknown as { from: (t: string) => Query }).from('free_tool_items');
const COLS = 'id, tool, name, data, created_at, updated_at';

export async function listItems<T>(tool: SavableTool): Promise<ItemResult<FreeToolItem<T>[]>> {
  try {
    const { data, error } = await table().select(COLS).eq('tool', tool).order('updated_at', { ascending: false }).limit(MAX_ITEMS_PER_TOOL);
    if (error) return { ok: false, error: itemError(error), missing: isMissingTable(error) };
    return { ok: true, value: (Array.isArray(data) ? data : []) as FreeToolItem<T>[] };
  } catch {
    return { ok: false, error: SAVE_FAILED_MESSAGE };
  }
}

/** Insert a new item, or update one of yours (pass its id). */
export async function saveItem<T>(userId: string, tool: SavableTool, name: string, data: T, id?: string): Promise<ItemResult<FreeToolItem<T>>> {
  const invalid = validateItem(tool, name, data);
  if (invalid) return { ok: false, error: invalid };
  try {
    const row = { name: name.trim(), data };
    const q = id
      ? table().update(row).eq('id', id).select(COLS).single()
      : table().insert({ ...row, user_id: userId, tool }).select(COLS).single();
    const { data: saved, error } = await q;
    if (error) return { ok: false, error: itemError(error), missing: isMissingTable(error) };
    return { ok: true, value: saved as FreeToolItem<T> };
  } catch {
    return { ok: false, error: SAVE_FAILED_MESSAGE };
  }
}

export async function deleteItem(id: string): Promise<ItemResult<true>> {
  try {
    const { error } = await table().delete().eq('id', id);
    if (error) return { ok: false, error: itemError(error), missing: isMissingTable(error) };
    return { ok: true, value: true };
  } catch {
    return { ok: false, error: SAVE_FAILED_MESSAGE };
  }
}

// In-progress work kept for this browser tab, so it is still there after signing in (sessionStorage, try/catch).
const draftKey = (tool: SavableTool) => `b2bnest.freeToolDraft.${tool}`;
export function loadDraft<T>(tool: SavableTool, isValid: (v: unknown) => v is T): T | null {
  try {
    const raw = sessionStorage.getItem(draftKey(tool));
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    return isValid(v) ? v : null;
  } catch { return null; }
}
export function saveDraft(tool: SavableTool, value: unknown): void {
  try { sessionStorage.setItem(draftKey(tool), JSON.stringify(value)); } catch { /* storage blocked: this view only */ }
}
export function clearDraft(tool: SavableTool): void {
  try { sessionStorage.removeItem(draftKey(tool)); } catch { /* storage blocked */ }
}

// The one-time "move what you saved in this browser" offer: answered once per account per tool (localStorage).
const moveKey = (tool: SavableTool, userId: string) => `b2bnest.freeToolMove.${tool}.${userId}`;
export function moveAnswered(tool: SavableTool, userId: string): boolean {
  try { return localStorage.getItem(moveKey(tool, userId)) === '1'; } catch { return false; }
}
export function markMoveAnswered(tool: SavableTool, userId: string): void {
  try { localStorage.setItem(moveKey(tool, userId), '1'); } catch { /* storage blocked: asked again next time */ }
}

// "Create a free account" prompt, hidden for the session once dismissed.
const promptKey = (tool: SavableTool) => `b2bnest.freeToolPrompt.${tool}`;
export function promptDismissed(tool: SavableTool): boolean {
  try { return sessionStorage.getItem(promptKey(tool)) === '1'; } catch { return false; }
}
export function dismissPrompt(tool: SavableTool): void {
  try { sessionStorage.setItem(promptKey(tool), '1'); } catch { /* storage blocked: this view only */ }
}

/** Where "Create a free account" / "Sign in" go: back to the same tool afterwards. */
export const toolPath = (tool: SavableTool) => `/business-tools?tool=${tool}`;
export const signUpUrl = (tool: SavableTool) => `${authUrlWithNext(toolPath(tool))}&mode=signup`;
export const signInUrl = (tool: SavableTool) => authUrlWithNext(toolPath(tool));
export const ACCOUNT_NOTE = 'Saved to your account. It appears on any device you sign in on.';
export const TRIAL_ENDED_NOTE = 'Your trial has ended. The free tools stay free. See plans to unlock the rest.';

/** The one-time move: the account's list plus anything from the browser it doesn't have yet (matched by id). */
export function mergeById<T extends { id: string }>(account: T[], browser: T[]): T[] {
  const have = new Set(account.map((x) => x.id));
  return [...account, ...browser.filter((x) => !have.has(x.id))];
}
export const isListOf = <T>(isItem: (x: unknown) => x is T) => (v: unknown): v is T[] => Array.isArray(v) && v.every(isItem);

/** Dates as 2 Nov 2026 (UK). */
export const shortDate = (d: string | Date) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
