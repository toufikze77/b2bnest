import { useState } from "react";
import LeadGenLayout from "./LeadGenLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { upsertLead, getLeads } from "@/lib/leadGen";
import { toast } from "sonner";
import { Upload } from "lucide-react";

const TARGETS = ["Skip","First Name","Last Name","Email","Phone","Company","Source","Notes"];

export default function ImportPage() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const onFile = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    const parse = (line: string) => {
      const out: string[] = []; let cur = ""; let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') inQ = !inQ;
        else if (c === "," && !inQ) { out.push(cur); cur = ""; }
        else cur += c;
      }
      out.push(cur); return out;
    };
    const all = lines.map(parse);
    const hd = all[0] || [];
    setHeaders(hd);
    setRows(all.slice(1));
    const m: Record<number, string> = {};
    hd.forEach((h, i) => {
      const l = h.toLowerCase();
      if (l.includes("first")) m[i] = "First Name";
      else if (l.includes("last") || l === "surname") m[i] = "Last Name";
      else if (l.includes("email")) m[i] = "Email";
      else if (l.includes("phone")) m[i] = "Phone";
      else if (l.includes("company")) m[i] = "Company";
      else if (l.includes("source")) m[i] = "Source";
      else m[i] = "Skip";
    });
    setMapping(m);
  };

  const emailIdx = () => Object.entries(mapping).find(([_, v]) => v === "Email")?.[0];

  const doImport = async () => {
    const ei = emailIdx();
    if (ei === undefined) { toast.error("Email column must be mapped"); return; }
    setImporting(true);
    const existing = new Set(getLeads().map(l => l.email.toLowerCase()));
    let ok = 0, skip = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const obj: any = { source: "CSV Import" };
      Object.entries(mapping).forEach(([idx, target]) => {
        if (target === "Skip") return;
        const v = (r[Number(idx)] || "").trim();
        if (target === "First Name") obj.firstName = v;
        else if (target === "Last Name") obj.lastName = v;
        else if (target === "Email") obj.email = v;
        else if (target === "Phone") obj.phone = v;
        else if (target === "Company") obj.company = v;
        else if (target === "Source") obj.source = v || "CSV Import";
      });
      if (!obj.email || existing.has(obj.email.toLowerCase())) { skip++; }
      else { upsertLead(obj); existing.add(obj.email.toLowerCase()); ok++; }
      setProgress(Math.round(((i + 1) / rows.length) * 100));
      if (i % 20 === 0) await new Promise(r => setTimeout(r, 0));
    }
    setImporting(false);
    toast.success(`${ok} leads imported successfully. ${skip} skipped (duplicates or missing email).`);
    setHeaders([]); setRows([]); setMapping({}); setProgress(0);
  };

  return (
    <LeadGenLayout title="Import Leads" subtitle="Upload a CSV and map columns to lead fields">
      {headers.length === 0 ? (
        <Card className="p-12 text-center">
          <Upload className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <h3 className="font-semibold text-[#0A1628] mb-2">Upload a CSV file</h3>
          <input type="file" accept=".csv" id="csv-up" className="hidden" onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
          <label htmlFor="csv-up"><Button className="bg-[#2563eb]" asChild><span>Choose file</span></Button></label>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold text-[#0A1628] mb-3">Step 2 — Map columns</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-3">CSV Column</th>
                  <th className="py-2 pr-3">Map to</th>
                  <th className="py-2 pr-3">Preview (first row)</th>
                </tr></thead>
                <tbody>
                  {headers.map((h, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-2 pr-3 font-medium">{h}</td>
                      <td className="py-2 pr-3">
                        <Select value={mapping[i] || "Skip"} onValueChange={v => setMapping({ ...mapping, [i]: v })}>
                          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                          <SelectContent>{TARGETS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 pr-3 text-gray-600">{rows[0]?.[i] || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold text-[#0A1628] mb-2">Step 3 — Import</h3>
            <p className="text-sm text-gray-600 mb-3">{rows.length} rows ready to import.</p>
            {importing && <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3"><div className="h-full bg-[#2563eb] transition-all" style={{ width: `${progress}%` }} /></div>}
            <div className="flex gap-2">
              <Button onClick={doImport} disabled={importing} className="bg-[#00D68F] hover:bg-[#00b377] text-white">{importing ? `Importing... ${progress}%` : `Import ${rows.length} Leads`}</Button>
              <Button variant="outline" onClick={() => { setHeaders([]); setRows([]); setMapping({}); }}>Cancel</Button>
            </div>
          </Card>
        </div>
      )}
    </LeadGenLayout>
  );
}
