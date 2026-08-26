import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { parseCsv, autoMap, rowToObject, downloadTemplate, SKIP, type ImportField } from '@/lib/csvImport';

export type ImportResult = { inserted: number; skipped: number; errors: string[] };

interface Props {
  title: string;
  description: string;
  fields: ImportField[];
  templateName: string;
  /** Receives a batch of mapped rows and persists them. */
  onImport: (rows: Record<string, string>[]) => Promise<ImportResult>;
}

const BATCH = 50;

export default function CsvImportWizard({ title, description, fields, templateName, onImport }: Props) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  const reset = () => {
    setHeaders([]);
    setRows([]);
    setMapping({});
    setProgress(0);
  };

  const onFile = async (file: File) => {
    const { headers: hd, rows: rw } = parseCsv(await file.text());
    if (!hd.length) {
      toast.error('That file looks empty.');
      return;
    }
    setResult(null);
    setHeaders(hd);
    setRows(rw);
    setMapping(autoMap(hd, fields));
  };

  const mappedKeys = new Set(Object.values(mapping).filter((v) => v !== SKIP));
  const missingRequired = fields.filter((f) => f.required && !mappedKeys.has(f.key));

  const runImport = async () => {
    if (missingRequired.length) {
      toast.error(`Map a column for: ${missingRequired.map((f) => f.label).join(', ')}`);
      return;
    }
    setImporting(true);
    const total: ImportResult = { inserted: 0, skipped: 0, errors: [] };
    try {
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH).map((r) => rowToObject(r, mapping));
        const res = await onImport(batch);
        total.inserted += res.inserted;
        total.skipped += res.skipped;
        total.errors.push(...res.errors);
        setProgress(Math.round((Math.min(i + BATCH, rows.length) / rows.length) * 100));
      }
      setResult(total);
      toast.success(`${total.inserted} rows imported. ${total.skipped} skipped.`);
      reset();
    } catch (e: any) {
      toast.error(e?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => downloadTemplate(templateName, fields)}>
            <Download className="h-4 w-4 mr-2" />
            CSV template
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {result && (
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              {result.inserted} imported · {result.skipped} skipped
            </p>
            {result.errors.slice(0, 5).map((err, i) => (
              <p key={i} className="mt-1 flex items-start gap-2 text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {err}
              </p>
            ))}
          </div>
        )}

        {headers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <Upload className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="mb-1 font-medium text-foreground">Upload a CSV export</p>
            <p className="mb-4 text-sm text-muted-foreground">
              Export from your old tool, or start from our template. Columns are matched automatically.
            </p>
            <input
              id={`csv-${templateName}`}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
            <label htmlFor={`csv-${templateName}`}>
              <Button asChild>
                <span>Choose file</span>
              </Button>
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3">CSV column</th>
                    <th className="py-2 pr-3">Maps to</th>
                    <th className="py-2 pr-3">First row</th>
                  </tr>
                </thead>
                <tbody>
                  {headers.map((h, i) => (
                    <tr key={`${h}-${i}`} className="border-b">
                      <td className="py-2 pr-3 font-medium text-foreground">{h || `Column ${i + 1}`}</td>
                      <td className="py-2 pr-3">
                        <Select
                          value={mapping[i] || SKIP}
                          onValueChange={(v) => setMapping({ ...mapping, [i]: v })}
                        >
                          <SelectTrigger className="w-52">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SKIP}>Skip</SelectItem>
                            {fields.map((f) => (
                              <SelectItem key={f.key} value={f.key}>
                                {f.label}
                                {f.required ? ' *' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{rows[0]?.[i] || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {missingRequired.length > 0 && (
              <p className="text-sm text-destructive">
                Required fields not mapped: {missingRequired.map((f) => f.label).join(', ')}
              </p>
            )}

            {importing && <Progress value={progress} />}

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{rows.length} rows ready</Badge>
              <Button onClick={runImport} disabled={importing}>
                {importing ? `Importing… ${progress}%` : `Import ${rows.length} rows`}
              </Button>
              <Button variant="outline" onClick={reset} disabled={importing}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
