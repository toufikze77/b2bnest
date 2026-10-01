// GENERATED COPY of src/lib/aiTemplateSchema.ts (schema part). Keep in sync; checked by src/lib/aiTemplateSchema.sync.test.ts
/**
 * Strict, versioned schema for AI-generated templates (v1).
 * Model output is untrusted: it is parsed as JSON data only, validated here,
 * and mapped onto the existing WorkspaceTemplate shape so creation goes through
 * the existing validated creation service. No scripts, HTML, SQL or actions.
 */
import { z } from 'npm:zod@3.23.8';

export const AI_TEMPLATE_SCHEMA_VERSION = 1 as const;
export const LIMITS = { boards: 8, groupsPerBoard: 8, tasksPerBoard: 40, tasksTotal: 120, name: 80, text: 500, maxDayOffset: 365 };

/** Only views the app renders today. */
export const SUPPORTED_VIEWS = ['table', 'board', 'calendar'] as const;
const STATUSES = ['backlog', 'todo', 'in-progress', 'review', 'done'] as const;

// Plain text only: reject anything that looks like markup, script or template syntax.
const UNSAFE = /<[^>]*>|javascript:|\{\{|\}\}|<\?|\bon\w+\s*=/i;
const text = (max: number) =>
  z.string().trim().min(1).max(max).refine((s) => !UNSAFE.test(s), 'Must be plain text');

const Task = z.object({
  title: text(120),
  description: text(LIMITS.text).optional(),
  status: z.enum(STATUSES),
  priority: z.enum(['low', 'medium', 'high']),
  dayOffset: z.number().int().min(0).max(LIMITS.maxDayOffset),
}).strict();

const Group = z.object({ name: text(60), tasks: z.array(Task).max(LIMITS.tasksPerBoard) }).strict();

const Board = z.object({
  name: text(LIMITS.name),
  description: text(LIMITS.text),
  views: z.array(z.enum(SUPPORTED_VIEWS)).min(1).max(3),
  groups: z.array(Group).min(1).max(LIMITS.groupsPerBoard),
}).strict().refine((b) => b.groups.reduce((n, g) => n + g.tasks.length, 0) <= LIMITS.tasksPerBoard, 'Too many tasks on a board');

export const AiTemplateV1 = z.object({
  schemaVersion: z.literal(AI_TEMPLATE_SCHEMA_VERSION),
  kind: z.enum(['project', 'workspace']),
  name: text(LIMITS.name),
  description: text(LIMITS.text),
  boards: z.array(Board).min(1).max(LIMITS.boards),
}).strict()
  .refine((t) => t.kind === 'workspace' || t.boards.length === 1, 'A project template has exactly one board')
  .refine((t) => t.boards.reduce((n, b) => n + b.groups.reduce((m, g) => m + g.tasks.length, 0), 0) <= LIMITS.tasksTotal, 'Too many tasks');

export type AiTemplate = z.infer<typeof AiTemplateV1>;

export type ParseResult = { ok: true; template: AiTemplate } | { ok: false; errors: string[] };

/** Parse raw model text. Never evaluates it; rejects anything not matching v1. */
export function parseAiTemplate(raw: unknown): ParseResult {
  let data: unknown = raw;
  if (typeof raw === 'string') {
    if (raw.length > 65536) return { ok: false, errors: ['Output too large'] };
    try { data = JSON.parse(raw); } catch { return { ok: false, errors: ['Output is not valid JSON'] }; }
  }
  const r = AiTemplateV1.safeParse(data);
  if (!r.success) return { ok: false, errors: r.error.issues.slice(0, 10).map((i) => `${i.path.join('.') || 'template'}: ${i.message}`) };
  return { ok: true, template: r.data };
}

