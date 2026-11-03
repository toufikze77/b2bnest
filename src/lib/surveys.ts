// Phase 38: Customer Survey Builder helpers (tested in surveys.test.ts). Surveys are saved in this browser only.
// It does not publish surveys or collect answers: there is no link to send and nowhere answers are stored.
export type QuestionType = 'text' | 'multiple-choice' | 'rating' | 'yes-no' | 'email';
export interface Question { id: string; type: QuestionType; question: string; options: string[]; required: boolean }
export interface Survey { id: string; title: string; description: string; questions: Question[]; updatedAt: string }
export const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'text', label: 'Text answer' }, { value: 'multiple-choice', label: 'Multiple choice' }, { value: 'rating', label: 'Rating (1 to 5)' },
  { value: 'yes-no', label: 'Yes or no' }, { value: 'email', label: 'Email address' },
];
export const STORAGE_KEY = 'b2bnest.surveys.v1';
export const MAX_SURVEYS = 5;
export const MAX_QUESTIONS = 30;
export const NO_RESPONSES_NOTE = "This tool helps you write and check a survey. It doesn't publish it or collect answers: there is no link to send, and no responses are stored. When it's ready, copy or download the questions into your own form or email.";

const TYPES = QUESTION_TYPES.map((t) => t.value);
export function loadSurveys(): Survey[] {
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(list)) return [];
    return list.flatMap((s): Survey[] => {
      if (!s || typeof s.id !== 'string' || typeof s.title !== 'string' || !Array.isArray(s.questions)) return [];
      const questions = s.questions.flatMap((q: Partial<Question>): Question[] => (q && typeof q.id === 'string' && typeof q.question === 'string' && TYPES.includes(q.type as QuestionType)
        ? [{ id: q.id, type: q.type as QuestionType, question: q.question, options: Array.isArray(q.options) ? q.options.filter((o) => typeof o === 'string') : [], required: !!q.required }] : []));
      return [{ id: s.id, title: s.title, description: typeof s.description === 'string' ? s.description : '', questions, updatedAt: typeof s.updatedAt === 'string' ? s.updatedAt : '' }];
    }).slice(0, MAX_SURVEYS);
  } catch { return []; }
}
export function saveSurveys(list: Survey[]): boolean { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); return true; } catch { return false; } }

/** Moves question `index` by `by` (-1 up, +1 down); out of range = unchanged. */
export function move<T>(list: T[], index: number, by: number): T[] {
  const to = index + by;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return list;
  const next = [...list]; const [x] = next.splice(index, 1); next.splice(to, 0, x); return next;
}

/** Problems that stop saving, in words. */
export function surveyErrors(s: Pick<Survey, 'title' | 'questions'>): string[] {
  const e: string[] = [];
  if (!s.title.trim()) e.push('Give the survey a title.');
  if (s.questions.length === 0) e.push('Add at least one question.');
  s.questions.forEach((q, i) => {
    if (!q.question.trim()) e.push(`Question ${i + 1} has no text.`);
    if (q.type === 'multiple-choice' && q.options.filter((o) => o.trim()).length < 2) e.push(`Question ${i + 1} needs at least two options.`);
  });
  return e;
}

/** The survey as plain text, to paste into an email or another form tool. */
export function surveyText(s: Survey): string {
  const lines = [s.title, ...(s.description ? [s.description] : []), ''];
  s.questions.forEach((q, i) => {
    lines.push(`${i + 1}. ${q.question}${q.required ? ' (required)' : ''}`);
    if (q.type === 'multiple-choice') q.options.filter((o) => o.trim()).forEach((o) => lines.push(`   - ${o}`));
    if (q.type === 'rating') lines.push('   1  2  3  4  5');
    if (q.type === 'yes-no') lines.push('   Yes / No');
    if (q.type === 'email') lines.push('   Email address:');
    lines.push('');
  });
  return lines.join('\n').trimEnd() + '\n';
}

/** Phase 39: a survey read back from the account. */
export const isSurvey = (x: unknown): x is Survey => !!x && typeof x === 'object' && typeof (x as Survey).id === 'string'
  && typeof (x as Survey).title === 'string' && Array.isArray((x as Survey).questions);
