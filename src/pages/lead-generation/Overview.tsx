import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import LeadGenLayout from "./LeadGenLayout";
import LeadDetailSheet from "./LeadDetailSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lead, getLeads, upsertLead, scoreBadgeClass, sourceBadgeClass } from "@/lib/leadGen";
import { toast } from "sonner";
import { Users, Sparkles, Flame, CheckCircle2, Plus } from "lucide-react";

export default function LeadGenOverview() {
  const navigate = useNavigate();
  const [leads, setLeadsState] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", company: "", source: "Website" });

  const refresh = () => setLeadsState(getLeads());
  useEffect(() => { refresh(); }, []);

  const stats = useMemo(() => {
    const monthAgo = Date.now() - 30 * 86400000;
    return {
      total: leads.length,
      thisMonth: leads.filter(l => new Date(l.createdAt).getTime() >= monthAgo).length,
      hot: leads.filter(l => l.score >= 70).length,
      converted: leads.filter(l => l.status === "Converted").length,
    };
  }, [leads]);

  const sources = useMemo(() => {
    const buckets: Record<string, number> = { "Embed Form": 0, "Landing Page": 0, "Manual Entry": 0, "CSV Import": 0 };
    leads.forEach(l => {
      const s = l.source.toLowerCase();
      if (s.includes("form") || s.includes("website")) buckets["Embed Form"]++;
      else if (s.includes("landing")) buckets["Landing Page"]++;
      else if (s.includes("import")) buckets["CSV Import"]++;
      else buckets["Manual Entry"]++;
    });
    const max = Math.max(1, ...Object.values(buckets));
    return Object.entries(buckets).map(([k, v]) => ({ k, v, pct: (v / max) * 100 }));
  }, [leads]);

  const quickAdd = () => {
    if (!form.firstName || !form.email) { toast.error("Name and email required"); return; }
    upsertLead({ ...form, source: form.source, status: "New" });
    setForm({ firstName: "", lastName: "", email: "", phone: "", company: "", source: "Website" });
    toast.success("Lead added successfully");
    refresh();
  };

  const recent = leads.slice(0, 8);

  return (
    <LeadGenLayout right={
      <Button onClick={() => navigate("/lead-generation/forms/new")} className="bg-[#2563eb] hover:bg-[#1d4ed8]">
        <Plus className="h-4 w-4 mr-1.5" /> Create Form
      </Button>
    }>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<Users className="h-5 w-5" />} label="Total Leads Captured" value={stats.total} color="#2563eb" />
        <StatCard icon={<Sparkles className="h-5 w-5" />} label="New This Month" value={stats.thisMonth} color="#0A1628" />
        <StatCard icon={<Flame className="h-5 w-5" />} label="Hot Leads (70+)" value={stats.hot} color="#f59e0b" />
        <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="Converted to Contacts" value={stats.converted} color="#00D68F" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[#0A1628]">Recent Leads</h2>
            <Link to="/lead-generation/leads" className="text-sm text-[#2563eb] hover:underline">View All →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-2">Name</th>
                  <th className="py-2 pr-2">Email</th>
                  <th className="py-2 pr-2">Source</th>
                  <th className="py-2 pr-2">Score</th>
                  <th className="py-2 pr-2">Date</th>
                  <th className="py-2 pr-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-gray-500">No leads yet</td></tr>}
                {recent.map(l => (
                  <tr key={l.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(l)}>
                    <td className="py-2.5 pr-2 font-medium text-[#0A1628]">{l.firstName} {l.lastName}</td>
                    <td className="py-2.5 pr-2 text-gray-600">{l.email}</td>
                    <td className="py-2.5 pr-2"><span className={`px-2 py-0.5 rounded-full text-xs ${sourceBadgeClass(l.source)}`}>{l.source}</span></td>
                    <td className="py-2.5 pr-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${scoreBadgeClass(l.scoreLabel)}`}>{l.score} {l.scoreLabel}</span></td>
                    <td className="py-2.5 pr-2 text-gray-500">{new Date(l.createdAt).toLocaleDateString("en-GB")}</td>
                    <td className="py-2.5 pr-2 text-gray-700">{l.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card className="p-5">
            <h3 className="font-semibold text-[#0A1628] mb-4">Lead Sources</h3>
            <div className="space-y-3">
              {sources.map(s => (
                <div key={s.k}>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>{s.k}</span><span className="font-medium">{s.v}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${s.pct}%`, background: "#2563eb" }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold text-[#0A1628] mb-4">Quick Add Lead</h3>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="First name" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
                <Input placeholder="Last name" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
              </div>
              <Input placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              <Input placeholder="Phone (optional)" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              <Input placeholder="Company (optional)" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
              <Select value={form.source} onValueChange={v => setForm({ ...form, source: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Website", "Referral", "Social Media", "Event", "Cold Outreach", "Other"].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={quickAdd} className="w-full bg-[#2563eb] hover:bg-[#1d4ed8]">Add Lead</Button>
            </div>
          </Card>
        </div>
      </div>

      <LeadDetailSheet lead={selected} onClose={() => setSelected(null)} onChange={refresh} />
    </LeadGenLayout>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg flex items-center justify-center text-white" style={{ background: color }}>{icon}</div>
        <div>
          <div className="text-xs text-gray-500">{label}</div>
          <div className="text-2xl font-bold text-[#0A1628]">{value}</div>
        </div>
      </div>
    </Card>
  );
}
