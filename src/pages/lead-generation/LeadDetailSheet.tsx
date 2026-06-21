import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Lead, LeadStatus, upsertLead, scoreBadgeClass, getLeads, setLeads } from "@/lib/leadGen";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { UserPlus, Mail, XCircle, ExternalLink } from "lucide-react";

interface Props { lead: Lead | null; onClose: () => void; onChange: () => void; }

export default function LeadDetailSheet({ lead, onClose, onChange }: Props) {
  const { user } = useAuth();
  const [note, setNote] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  if (!lead) return null;

  const refresh = () => onChange();

  const updateStatus = (status: LeadStatus) => {
    upsertLead({ ...lead, status });
    toast.success("Status updated");
    refresh();
  };

  const addNote = () => {
    if (!note.trim()) return;
    const notes = [...lead.notes, { text: note.trim(), date: new Date().toISOString() }];
    upsertLead({ ...lead, notes });
    setNote("");
    toast.success("Note added");
    refresh();
  };

  const addToCRM = async () => {
    if (!user) {
      toast.error("Please sign in to add contacts to CRM");
      return;
    }
    try {
      // Duplicate check
      const { data: existing } = await supabase
        .from("contacts")
        .select("id")
        .eq("user_id", user.id)
        .eq("email", lead.email)
        .maybeSingle();

      if (existing) {
        toast.warning("This email already exists in CRM", {
          action: { label: "View CRM", onClick: () => window.location.assign("/crm") },
        });
        upsertLead({ ...lead, status: "Converted", crmContactId: existing.id });
        refresh();
        return;
      }

      const { data, error } = await supabase.from("contacts").insert({
        user_id: user.id,
        name: `${lead.firstName} ${lead.lastName}`.trim(),
        email: lead.email,
        phone: lead.phone || null,
        company: lead.company || null,
        source: "Lead Gen",
        status: "lead",
        tags: ["from-lead-gen"],
        notes: `Converted from lead. Original source: ${lead.source}. Lead score at conversion: ${lead.score}.`,
      }).select().single();
      if (error) throw error;

      upsertLead({ ...lead, status: "Converted", crmContactId: data.id });
      toast.success("Contact created in CRM");
      refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to add to CRM");
    }
  };

  const disqualify = () => {
    if (!confirm("Disqualify this lead?")) return;
    upsertLead({ ...lead, status: "Disqualified" });
    toast.success("Lead disqualified");
    refresh();
  };

  const sendEmail = () => {
    toast.success("Email queued");
    setEmailOpen(false);
    setEmailSubject(""); setEmailBody("");
    const notes = [...lead.notes, { text: `Email sent: ${emailSubject}`, date: new Date().toISOString() }];
    upsertLead({ ...lead, notes });
    refresh();
  };

  const pct = lead.score;
  const ringColor = lead.score >= 90 ? "#00D68F" : lead.score >= 70 ? "#f59e0b" : lead.score >= 40 ? "#2563eb" : "#94a3b8";

  return (
    <Sheet open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-[#0A1628]">{lead.firstName} {lead.lastName}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="flex items-center gap-6">
            <div className="relative h-24 w-24">
              <svg className="h-24 w-24 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.915" fill="none" stroke={ringColor} strokeWidth="3"
                  strokeDasharray={`${pct} ${100 - pct}`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-[#0A1628]">{lead.score}</span>
                <span className={`text-[10px] px-1.5 rounded ${scoreBadgeClass(lead.scoreLabel)}`}>{lead.scoreLabel}</span>
              </div>
            </div>
            <div className="space-y-1 text-sm">
              <div><span className="text-gray-500">Email:</span> {lead.email || "—"}</div>
              <div><span className="text-gray-500">Phone:</span> {lead.phone || "—"}</div>
              <div><span className="text-gray-500">Company:</span> {lead.company || "—"}</div>
              <div><span className="text-gray-500">Source:</span> {lead.source}</div>
              <div><span className="text-gray-500">Captured:</span> {new Date(lead.createdAt).toLocaleDateString("en-GB")}</div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Status</label>
            <Select value={lead.status} onValueChange={(v) => updateStatus(v as LeadStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["New","Contacted","Qualified","Disqualified","Converted"] as LeadStatus[]).map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button onClick={addToCRM} className="bg-[#00D68F] hover:bg-[#00b377] text-white" disabled={lead.status === "Converted"}>
              <UserPlus className="h-4 w-4 mr-1.5" /> {lead.status === "Converted" ? "In CRM" : "Add to CRM"}
            </Button>
            <Button onClick={() => setEmailOpen(true)} variant="outline">
              <Mail className="h-4 w-4 mr-1.5" /> Send Email
            </Button>
            <Button onClick={disqualify} variant="outline" className="text-red-600 hover:text-red-700">
              <XCircle className="h-4 w-4 mr-1.5" /> Disqualify
            </Button>
          </div>

          {lead.crmContactId && (
            <a href="/crm" className="inline-flex items-center text-sm text-[#2563eb] hover:underline">
              View in CRM <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          )}

          <div>
            <h3 className="font-semibold text-[#0A1628] mb-2">Activity Timeline</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              <TimelineItem text="Lead captured" date={lead.createdAt} />
              {lead.status === "Converted" && lead.crmContactId && (
                <TimelineItem text="Added to CRM" date={lead.updatedAt} />
              )}
              {lead.notes.map((n, i) => <TimelineItem key={i} text={n.text} date={n.date} />)}
            </div>
            <div className="flex gap-2 mt-3">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note..." />
              <Button onClick={addNote}>Add</Button>
            </div>
          </div>
        </div>

        <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Send Email</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm">To</label>
                <Input value={lead.email} disabled />
              </div>
              <div>
                <label className="text-sm">Subject</label>
                <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
              </div>
              <div>
                <label className="text-sm">Message</label>
                <Textarea rows={6} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEmailOpen(false)}>Cancel</Button>
              <Button onClick={sendEmail} className="bg-[#2563eb]">Send</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}

function TimelineItem({ text, date }: { text: string; date: string }) {
  return (
    <div className="flex gap-3 text-sm">
      <div className="h-2 w-2 rounded-full bg-[#2563eb] mt-1.5 flex-shrink-0" />
      <div className="flex-1">
        <div className="text-[#0A1628]">{text}</div>
        <div className="text-xs text-gray-500">{new Date(date).toLocaleString("en-GB")}</div>
      </div>
    </div>
  );
}
