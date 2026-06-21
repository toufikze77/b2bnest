import { useEffect, useMemo, useState } from "react";
import LeadGenLayout from "./LeadGenLayout";
import LeadDetailSheet from "./LeadDetailSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lead, getLeads, scoreBadgeClass, sourceBadgeClass } from "@/lib/leadGen";
import { Download, Search } from "lucide-react";

const PAGE_SIZE = 20;

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [scoreF, setScoreF] = useState("All");
  const [source, setSource] = useState("All");
  const [page, setPage] = useState(1);

  const refresh = () => setLeads(getLeads());
  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => leads.filter(l => {
    if (search && !`${l.firstName} ${l.lastName} ${l.email}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (status !== "All" && l.status !== status) return false;
    if (scoreF !== "All" && l.scoreLabel !== scoreF) return false;
    if (source !== "All" && l.source !== source) return false;
    return true;
  }), [leads, search, status, scoreF, source]);

  const sources = useMemo(() => Array.from(new Set(leads.map(l => l.source))), [leads]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportCSV = () => {
    const headers = ["First Name", "Last Name", "Email", "Phone", "Company", "Source", "Score", "Status", "Created"];
    const rows = filtered.map(l => [l.firstName, l.lastName, l.email, l.phone, l.company, l.source, l.score, l.status, l.createdAt]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <LeadGenLayout title="All Leads" subtitle="Manage and convert your captured leads">
      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
            <Input className="pl-9" placeholder="Search name or email..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={status} onValueChange={v => { setStatus(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>{["All","New","Contacted","Qualified","Disqualified","Converted"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={scoreF} onValueChange={v => { setScoreF(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Score" /></SelectTrigger>
            <SelectContent>{["All","Cold","Warm","Hot","Ready"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={source} onValueChange={v => { setSource(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent><SelectItem value="All">All sources</SelectItem>{sources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-1.5" /> Export CSV</Button>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-600">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Score</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-gray-500">No leads match these filters</td></tr>}
              {paged.map(l => (
                <tr key={l.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(l)}>
                  <td className="py-2.5 px-4 font-medium text-[#0A1628]">{l.firstName} {l.lastName}</td>
                  <td className="py-2.5 px-4 text-gray-600">{l.email}</td>
                  <td className="py-2.5 px-4"><span className={`px-2 py-0.5 rounded-full text-xs ${sourceBadgeClass(l.source)}`}>{l.source}</span></td>
                  <td className="py-2.5 px-4"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${scoreBadgeClass(l.scoreLabel)}`}>{l.score} {l.scoreLabel}</span></td>
                  <td className="py-2.5 px-4 text-gray-500">{new Date(l.createdAt).toLocaleDateString("en-GB")}</td>
                  <td className="py-2.5 px-4 text-gray-700">{l.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <span className="text-sm text-gray-500">Page {page} of {pages} · {filtered.length} leads</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      <LeadDetailSheet lead={selected} onClose={() => setSelected(null)} onChange={refresh} />
    </LeadGenLayout>
  );
}
