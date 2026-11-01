import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Copy, Download, FileText, Loader2, Trash2, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import LegalMarkdown from '@/components/legal/LegalMarkdown';
import {
  AI_DRAFT_BANNER, buildFields, creditLine, CREDITS_PER_DOCUMENT, DATA_COLLECTED_OPTIONS, DEFAULT_JURISDICTION, docTypeById,
  fieldLabel, fieldMax, FIELDS, groupedDocTypes, invokeGenerateLegalDocument, JURISDICTIONS, notEnoughCreditsText, PROGRESS_TEXT,
  type DocKind, type FieldId, type GenerateError, type Jurisdiction,
} from '@/lib/legalDocuments';
import { buildDocx, buildPdf, documentFileName, downloadBlob, markdownBlob } from '@/lib/legalExport';
import { deleteHistory, type HistoryEntry, loadHistory, newHistoryId, saveHistory } from '@/lib/legalHistory';
import { placeholdersIn } from '@/lib/legalMarkdown';
import { useAiCredits, useAiCreditsUpdater } from '@/hooks/useAiCredits';
import { resetLine } from '@/lib/aiCredits';

interface Props { kind: DocKind; title: string; intro: string }

const control = 'w-full rounded-md border border-input bg-background p-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring';

/**
 * Phase 30: the one engine behind the Contract Generator and the Privacy / Legal Notices Generator. The server
 * (generate-legal-document) drafts with AI for CREDITS_PER_DOCUMENT credits; drafts are kept in this browser only.
 */
export default function LegalDocumentGenerator({ kind, title, intro }: Props) {
  const groups = useMemo(() => groupedDocTypes(kind), [kind]);
  const [docTypeId, setDocTypeId] = useState(groups[0]?.types[0]?.id ?? '');
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>(DEFAULT_JURISDICTION);
  const [values, setValues] = useState<Partial<Record<FieldId, string>>>({});
  const [dataCollected, setDataCollected] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<GenerateError | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const balance = useAiCredits();
  const updateCredits = useAiCreditsUpdater();
  const short = balance.remaining != null && balance.remaining < CREDITS_PER_DOCUMENT;
  const [current, setCurrent] = useState<HistoryEntry | null>(null);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory(kind));
  const [exporting, setExporting] = useState<string | null>(null);
  const { toast } = useToast();
  const doc = docTypeById(docTypeId);
  const idp = `legal-${kind}`;

  const generate = async () => {
    if (!doc || running || short) return;
    const built = buildFields(doc, values, dataCollected);
    setMissing(built.missing);
    setError(null);
    if (built.missing.length) return;
    setRunning(true);
    const r = await invokeGenerateLegalDocument({ kind, docType: doc.id, jurisdiction, fields: built.fields });
    setRunning(false);
    if (!r.ok) { setError((r as Extract<typeof r, { ok: false }>).error); updateCredits(null); return; }
    const data = (r as Extract<typeof r, { ok: true }>).data;
    const entry: HistoryEntry = {
      id: newHistoryId(), kind, docType: doc.id, label: doc.label, jurisdiction,
      otherParty: built.fields.other_party_name ?? built.fields.business_name, document: data.document, createdAt: new Date().toISOString(),
    };
    setHistory(saveHistory(entry));
    setCurrent(entry); setText(data.document); setEditing(false);
    updateCredits(data);
  };

  const open = (e: HistoryEntry) => { setCurrent(e); setText(e.document); setEditing(false); setError(null); };
  const remove = (e: HistoryEntry) => {
    setHistory(deleteHistory(kind, e.id));
    if (current?.id === e.id) { setCurrent(null); setText(''); }
  };
  const keepEdits = () => {
    if (current && text !== current.document) {
      const next = { ...current, document: text };
      setCurrent(next); setHistory(saveHistory(next));
    }
  };

  const fileName = (ext: string) => documentFileName(current?.docType ?? 'document', current?.otherParty, new Date(), ext);
  const exportAs = async (what: 'md' | 'pdf' | 'docx') => {
    if (!current) return;
    setExporting(what);
    try {
      const blob = what === 'md' ? markdownBlob(text) : what === 'pdf' ? await buildPdf(text, current.label) : await buildDocx(text, current.label);
      downloadBlob(blob, fileName(what));
    } catch {
      toast({ title: "Couldn't create the file", description: 'Please try again, or copy the text instead.', variant: 'destructive' });
    } finally { setExporting(null); }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied', description: 'The document text is on your clipboard.' });
    } catch {
      toast({ title: "Couldn't copy", description: 'Select the text and copy it instead.', variant: 'destructive' });
    }
  };

  const setValue = (id: FieldId, v: string) => setValues((s) => ({ ...s, [id]: v }));
  const toggleData = (id: string) => setDataCollected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const placeholders = placeholdersIn(text);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{intro}</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Document details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`${idp}-type`}>Document type</Label>
              <select id={`${idp}-type`} className={control} value={docTypeId} disabled={running}
                onChange={(e) => { setDocTypeId(e.target.value); setMissing([]); setError(null); }}>
                {groups.map((g) => (
                  <optgroup key={g.group} label={g.group}>
                    {g.types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${idp}-jurisdiction`}>Jurisdiction</Label>
              <select id={`${idp}-jurisdiction`} className={control} value={jurisdiction} disabled={running}
                onChange={(e) => setJurisdiction(e.target.value as Jurisdiction)}>
                {JURISDICTIONS.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
              </select>
            </div>
          </div>

          {doc && (
            <div className="grid gap-4 sm:grid-cols-2" data-testid="legal-fields">
              {doc.fields.map((f) => {
                const def = FIELDS[f.id];
                const id = `${idp}-${f.id}`;
                const label = `${fieldLabel(doc, f.id)}${f.required ? ' (required)' : ''}`;
                const hint = def.hint ? <p id={`${id}-hint`} className="text-xs text-muted-foreground">{def.hint}</p> : null;
                const described = def.hint ? `${id}-hint` : undefined;
                if (def.input === 'checkboxes') {
                  return (
                    <fieldset key={f.id} className="space-y-2 sm:col-span-2">
                      <legend className="text-sm font-medium">{label}</legend>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {DATA_COLLECTED_OPTIONS.map((o) => (
                          <label key={o.id} className="flex items-center gap-2 text-sm">
                            <input type="checkbox" className="h-4 w-4 rounded border-input focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
                              checked={dataCollected.includes(o.id)} disabled={running} onChange={() => toggleData(o.id)} />
                            {o.label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  );
                }
                const wide = def.input === 'textarea';
                return (
                  <div key={f.id} className={`space-y-1 ${wide ? 'sm:col-span-2' : ''}`}>
                    <Label htmlFor={id}>{label}</Label>
                    {def.input === 'select' ? (
                      <select id={id} className={control} value={values[f.id] ?? ''} disabled={running} aria-describedby={described}
                        onChange={(e) => setValue(f.id, e.target.value)}>
                        <option value="">Not specified</option>
                        {def.options?.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                      </select>
                    ) : wide ? (
                      <Textarea id={id} rows={3} maxLength={fieldMax(f.id)} value={values[f.id] ?? ''} disabled={running} aria-describedby={described}
                        onChange={(e) => setValue(f.id, e.target.value)} />
                    ) : (
                      <Input id={id} type={def.input === 'date' ? 'date' : 'text'} maxLength={fieldMax(f.id)} value={values[f.id] ?? ''} disabled={running}
                        aria-describedby={described} aria-required={f.required || undefined} onChange={(e) => setValue(f.id, e.target.value)} />
                    )}
                    {hint}
                  </div>
                );
              })}
            </div>
          )}

          {missing.length > 0 && <p role="alert" className="text-sm text-destructive">Fill in: {missing.join(', ')}.</p>}

          <p className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="credits-left">
            <Zap className="h-3.5 w-3.5 text-primary" aria-hidden />{creditLine(balance.remaining)}
          </p>
          {short && (
            <p id={`${idp}-short`} role="status" className="text-sm text-destructive">
              {notEnoughCreditsText(balance.remaining!, resetLine(balance.resetDate))}{' '}
              <Link to="/pricing" className="font-medium text-primary underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">Compare plans</Link>
            </p>
          )}
          {balance.error && (
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              Couldn't load your credits; the server still checks them when you generate.
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2" onClick={() => void balance.refetch()}>Retry</Button>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={generate} disabled={running || !doc || short} aria-describedby={short ? `${idp}-short` : undefined}>
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <FileText className="mr-2 h-4 w-4" aria-hidden />}
              {running ? 'Drafting…' : 'Generate with AI'}
            </Button>
          </div>
          {running && <p role="status" className="text-sm text-muted-foreground">{PROGRESS_TEXT}</p>}
          {error && (
            <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">
              <p>{error.message}</p>
              {error.kind === 'trial_ended' && <Link to="/pricing" className="mt-1 inline-block font-medium text-primary underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">See plans on the Pricing page</Link>}
              {error.kind === 'insufficient_credits' && <Link to="/pricing" className="mt-1 inline-block font-medium text-primary underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">Compare plans</Link>}
            </div>
          )}
        </CardContent>
      </Card>

      {current && (
        <Card>
          <CardHeader className="space-y-3">
            <div role="note" className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-950 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{AI_DRAFT_BANNER}</span>
            </div>
            <CardTitle className="text-lg">{current.label}</CardTitle>
            {placeholders.length > 0 && (
              <p className="text-xs text-muted-foreground">{placeholders.length} placeholder{placeholders.length === 1 ? '' : 's'} to fill in, shown highlighted.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex rounded-md border border-input" role="group" aria-label="View">
                <Button type="button" size="sm" variant={editing ? 'ghost' : 'secondary'} aria-pressed={!editing} onClick={() => { keepEdits(); setEditing(false); }}>Preview</Button>
                <Button type="button" size="sm" variant={editing ? 'secondary' : 'ghost'} aria-pressed={editing} onClick={() => setEditing(true)}>Edit</Button>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={copy}><Copy className="mr-1 h-4 w-4" aria-hidden />Copy</Button>
              <Button type="button" size="sm" variant="outline" disabled={!!exporting} onClick={() => exportAs('md')}><Download className="mr-1 h-4 w-4" aria-hidden />.md</Button>
              <Button type="button" size="sm" variant="outline" disabled={!!exporting} onClick={() => exportAs('pdf')}><Download className="mr-1 h-4 w-4" aria-hidden />PDF</Button>
              <Button type="button" size="sm" variant="outline" disabled={!!exporting} onClick={() => exportAs('docx')}><Download className="mr-1 h-4 w-4" aria-hidden />Word</Button>
            </div>
          </CardHeader>
          <CardContent>
            {editing ? (
              <div className="space-y-1">
                <Label htmlFor={`${idp}-editor`}>Edit the document (Markdown)</Label>
                <Textarea id={`${idp}-editor`} className="min-h-[28rem] font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} onBlur={keepEdits} />
              </div>
            ) : (
              <div className="max-h-[40rem] overflow-y-auto rounded-md border border-border bg-background p-4 sm:p-6">
                <LegalMarkdown markdown={text} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent documents</CardTitle>
          <p className="text-xs text-muted-foreground">Saved in this browser only. The last 10 are kept; download anything you want to keep.</p>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents yet.</p>
          ) : (
            <ul className="divide-y divide-border" aria-label="Recent documents">
              {history.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{e.label}{e.otherParty ? ` · ${e.otherParty}` : ''}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(e.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {' · '}{JURISDICTIONS.find((j) => j.id === e.jurisdiction)?.label}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => open(e)} aria-label={`Open ${e.label}`}>Open</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => remove(e)} aria-label={`Delete ${e.label}`}><Trash2 className="h-4 w-4" aria-hidden /></Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
