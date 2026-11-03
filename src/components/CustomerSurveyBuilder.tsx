import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Download, Eye, FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BROWSER_ONLY_NOTE } from '@/lib/freeTools';
import {
  loadSurveys, MAX_QUESTIONS, MAX_SURVEYS, move, NO_RESPONSES_NOTE, QUESTION_TYPES, saveSurveys, surveyErrors, surveyText,
  type Question, type QuestionType, type Survey,
} from '@/lib/surveys';

const FIELD = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const CARD = 'rounded-card border border-border bg-card p-4 text-card-foreground';
const newQuestion = (): Question => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: 'text', question: '', options: [], required: false });

function Preview({ survey }: { survey: Survey }) {
  return (
    <div className="space-y-4" data-testid="survey-preview">
      <p className="text-xs text-muted-foreground">Preview only: answers here aren't saved or sent.</p>
      <h3 className="text-lg font-semibold">{survey.title || 'Untitled survey'}</h3>
      {survey.description && <p className="text-sm text-muted-foreground">{survey.description}</p>}
      {survey.questions.map((q, i) => (
        <fieldset key={q.id} className="space-y-1">
          <legend className="text-sm font-medium">{i + 1}. {q.question || 'Question text'}{q.required ? ' (required)' : ''}</legend>
          {q.type === 'text' && <Textarea aria-label={q.question} rows={2} />}
          {q.type === 'email' && <Input type="email" aria-label={q.question} />}
          {q.type === 'yes-no' && ['Yes', 'No'].map((o) => <label key={o} className="mr-4 text-sm"><input type="radio" name={`p-${q.id}`} className="mr-1" />{o}</label>)}
          {q.type === 'rating' && [1, 2, 3, 4, 5].map((n) => <label key={n} className="mr-3 text-sm"><input type="radio" name={`p-${q.id}`} className="mr-1" />{n}</label>)}
          {q.type === 'multiple-choice' && q.options.filter((o) => o.trim()).map((o) => <label key={o} className="block text-sm"><input type="radio" name={`p-${q.id}`} className="mr-1" />{o}</label>)}
        </fieldset>
      ))}
    </div>
  );
}

/** Phase 38: write and check customer surveys. Saved in this browser only; it doesn't publish or collect answers. */
export default function CustomerSurveyBuilder() {
  const [surveys, setSurveys] = useState<Survey[]>(loadSurveys);
  const [draft, setDraft] = useState<Survey | null>(null);
  const [preview, setPreview] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [announce, setAnnounce] = useState('');
  const [storageOk, setStorageOk] = useState(true);
  useEffect(() => { setStorageOk(saveSurveys(surveys)); }, [surveys]);

  const edit = (s?: Survey) => { setProblems([]); setPreview(false); setDraft(s ? structuredClone(s) : { id: `${Date.now()}`, title: '', description: '', questions: [newQuestion()], updatedAt: '' }); };
  const setQ = (i: number, q: Partial<Question>) => draft && setDraft({ ...draft, questions: draft.questions.map((x, j) => (j === i ? { ...x, ...q } : x)) });
  const save = () => {
    if (!draft) return;
    const errs = surveyErrors(draft);
    setProblems(errs);
    if (errs.length) return;
    const s = { ...draft, title: draft.title.trim(), updatedAt: new Date().toISOString() };
    setSurveys(surveys.some((x) => x.id === s.id) ? surveys.map((x) => (x.id === s.id ? s : x)) : [s, ...surveys]);
    setDraft(null); setAnnounce(`Survey "${s.title}" saved in this browser.`);
  };
  const remove = (s: Survey) => { if (!window.confirm(`Delete "${s.title}"?`)) return; setSurveys(surveys.filter((x) => x.id !== s.id)); setAnnounce(`"${s.title}" deleted.`); };
  const downloadText = (s: Survey) => {
    const url = URL.createObjectURL(new Blob([surveyText(s)], { type: 'text/plain;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `${s.title.replace(/[^\w-]+/g, '-').slice(0, 40) || 'survey'}.txt`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const copyText = async (s: Survey) => {
    try { await navigator.clipboard.writeText(surveyText(s)); setAnnounce('Questions copied.'); } catch { setAnnounce("Couldn't copy. Use Download instead."); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6">
      <header>
        <h1 className="text-2xl font-bold">Customer Survey Builder</h1>
        <p className="text-sm text-muted-foreground">Write a customer survey, check how it reads, then copy or download the questions. Up to {MAX_SURVEYS} surveys.</p>
        <p className="mt-2 rounded-md border border-border bg-muted/40 p-3 text-sm" data-testid="survey-no-responses">{NO_RESPONSES_NOTE}</p>
        <p className="mt-1 text-xs text-muted-foreground">{BROWSER_ONLY_NOTE}</p>
        {!storageOk && <p role="alert" className="mt-1 text-sm text-destructive">This browser isn't keeping your surveys (storage is blocked or full).</p>}
      </header>
      <p aria-live="polite" className="sr-only" data-testid="survey-announce">{announce}</p>

      {draft ? (
        <section className={`${CARD} space-y-4`} aria-label="Edit survey">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={preview ? 'outline' : 'default'} aria-pressed={!preview} onClick={() => setPreview(false)}><Pencil className="mr-1 h-4 w-4" aria-hidden />Edit</Button>
            <Button type="button" size="sm" variant={preview ? 'default' : 'outline'} aria-pressed={preview} onClick={() => setPreview(true)}><Eye className="mr-1 h-4 w-4" aria-hidden />Preview</Button>
          </div>
          {preview ? <Preview survey={draft} /> : (
            <>
              <div><Label htmlFor="sv-title">Survey title</Label><Input id="sv-title" value={draft.title} maxLength={120} placeholder="For example: after-purchase feedback" onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
              <div><Label htmlFor="sv-desc">Introduction (optional)</Label><Textarea id="sv-desc" rows={2} maxLength={500} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
              <ol className="space-y-3">
                {draft.questions.map((q, i) => (
                  <li key={q.id} className="space-y-2 rounded-md border border-border p-3" data-testid="survey-question">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">Question {i + 1}</span>
                      <div className="flex gap-1">
                        <Button type="button" size="icon" variant="ghost" aria-label={`Move question ${i + 1} up`} disabled={i === 0} onClick={() => setDraft({ ...draft, questions: move(draft.questions, i, -1) })}><ArrowUp className="h-4 w-4" aria-hidden /></Button>
                        <Button type="button" size="icon" variant="ghost" aria-label={`Move question ${i + 1} down`} disabled={i === draft.questions.length - 1} onClick={() => setDraft({ ...draft, questions: move(draft.questions, i, 1) })}><ArrowDown className="h-4 w-4" aria-hidden /></Button>
                        <Button type="button" size="icon" variant="ghost" aria-label={`Delete question ${i + 1}`} onClick={() => setDraft({ ...draft, questions: draft.questions.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" aria-hidden /></Button>
                      </div>
                    </div>
                    <div><Label htmlFor={`q-${q.id}`}>Question text</Label><Input id={`q-${q.id}`} value={q.question} maxLength={300} onChange={(e) => setQ(i, { question: e.target.value })} /></div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div><Label htmlFor={`qt-${q.id}`}>Type</Label>
                        <select id={`qt-${q.id}`} className={FIELD} value={q.type} onChange={(e) => setQ(i, { type: e.target.value as QuestionType })}>
                          {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select></div>
                      <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={q.required} onChange={(e) => setQ(i, { required: e.target.checked })} />Required</label>
                    </div>
                    {q.type === 'multiple-choice' && (
                      <div><Label htmlFor={`qo-${q.id}`}>Options (one per line)</Label>
                        <Textarea id={`qo-${q.id}`} rows={3} value={q.options.join('\n')} onChange={(e) => setQ(i, { options: e.target.value.split('\n') })} /></div>
                    )}
                  </li>
                ))}
              </ol>
              {draft.questions.length === 0 && <p className="text-sm text-muted-foreground">No questions yet.</p>}
              <Button type="button" variant="outline" disabled={draft.questions.length >= MAX_QUESTIONS} onClick={() => setDraft({ ...draft, questions: [...draft.questions, newQuestion()] })}><Plus className="mr-1 h-4 w-4" aria-hidden />Add a question</Button>
            </>
          )}
          {problems.length > 0 && <ul role="alert" className="list-disc pl-5 text-sm text-destructive">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
          <div className="flex gap-2"><Button type="button" onClick={save}>Save survey</Button><Button type="button" variant="ghost" onClick={() => setDraft(null)}>Cancel</Button></div>
        </section>
      ) : (
        <Button type="button" onClick={() => edit()} disabled={surveys.length >= MAX_SURVEYS}><Plus className="mr-1 h-4 w-4" aria-hidden />{surveys.length >= MAX_SURVEYS ? `Limit of ${MAX_SURVEYS} surveys reached` : 'New survey'}</Button>
      )}

      {!draft && (surveys.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="surveys-empty">No surveys yet. Choose "New survey" to write your first one.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {surveys.map((s) => (
            <li key={s.id} className={CARD} data-testid="survey-card">
              <p className="flex items-center gap-2 font-semibold"><FileText className="h-4 w-4" aria-hidden />{s.title}</p>
              <p className="text-sm text-muted-foreground">{s.questions.length} {s.questions.length === 1 ? 'question' : 'questions'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => edit(s)}>Edit or preview</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void copyText(s)}><Copy className="mr-1 h-4 w-4" aria-hidden />Copy questions</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => downloadText(s)}><Download className="mr-1 h-4 w-4" aria-hidden />Download (.txt)</Button>
                <Button type="button" size="sm" variant="ghost" aria-label={`Delete ${s.title}`} onClick={() => remove(s)}><Trash2 className="h-4 w-4" aria-hidden /></Button>
              </div>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}
