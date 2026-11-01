// Phase 30: the last documents drafted, kept in this browser only (no database table). Every storage access is in a
// try/catch: in a private window, with storage full or blocked, history is simply empty and nothing breaks.
import type { DocKind, Jurisdiction } from '@/lib/legalDocuments';

export const HISTORY_KEY = 'legalDocuments.history.v1';
/** Per kind (contracts and legal notices each keep their own last 10). */
export const HISTORY_MAX = 10;

export interface HistoryEntry {
  id: string; kind: DocKind; docType: string; label: string; jurisdiction: Jurisdiction;
  otherParty?: string; document: string; createdAt: string;
}

const isEntry = (x: unknown): x is HistoryEntry => {
  const e = x as HistoryEntry;
  return !!e && typeof e.id === 'string' && (e.kind === 'contract' || e.kind === 'legal_notice') && typeof e.docType === 'string'
    && typeof e.label === 'string' && typeof e.document === 'string' && typeof e.createdAt === 'string';
};

function readAll(): HistoryEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter(isEntry) : [];
  } catch {
    return [];
  }
}

function writeAll(entries: HistoryEntry[]): boolean {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(entries)); return true; } catch { return false; }
}

/** Newest first. */
export const loadHistory = (kind: DocKind) => readAll().filter((e) => e.kind === kind).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/** Adds or replaces (same id) an entry, keeping the newest HISTORY_MAX of its kind. Returns that kind's list. */
export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const all = [entry, ...readAll().filter((e) => e.id !== entry.id)];
  const mine = all.filter((e) => e.kind === entry.kind).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, HISTORY_MAX);
  writeAll([...mine, ...all.filter((e) => e.kind !== entry.kind)]);
  return mine;
}

export function deleteHistory(kind: DocKind, id: string): HistoryEntry[] {
  writeAll(readAll().filter((e) => e.id !== id));
  return loadHistory(kind).filter((e) => e.id !== id);
}

export const newHistoryId = () => {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
};
