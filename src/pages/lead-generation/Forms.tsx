import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import LeadGenLayout from "./LeadGenLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeadForm, getForms, deleteForm, saveForm } from "@/lib/leadGen";
import { toast } from "sonner";
import { Plus, FileText, Copy, ExternalLink, Trash2, Pencil, Eye, Code } from "lucide-react";

export default function FormsList() {
  const navigate = useNavigate();
  const [forms, setForms] = useState<LeadForm[]>([]);
  const [embedForm, setEmbedForm] = useState<LeadForm | null>(null);

  const refresh = () => setForms(getForms());
  useEffect(() => { refresh(); }, []);

  const duplicate = (f: LeadForm) => {
    const copy = { ...f, id: Math.random().toString(36).slice(2, 11), name: f.name + " (Copy)", responses: 0, createdAt: new Date().toISOString() };
    saveForm(copy);
    toast.success("Form duplicated");
    refresh();
  };

  const del = (id: string) => {
    if (!confirm("Delete this form? This cannot be undone.")) return;
    deleteForm(id);
    toast.success("Form deleted");
    refresh();
  };

  const embedSnippet = embedForm ? `<div id="b2bnest-form-${embedForm.id}"></div>\n<script src="https://b2bnest.online/embed/form.js" data-form-id="${embedForm.id}"></script>` : "";
  const directLink = embedForm ? `${window.location.origin}/f/${embedForm.id}` : "";

  return (
    <LeadGenLayout title="Forms" subtitle="Embeddable lead capture forms"
      right={<Button onClick={() => navigate("/lead-generation/forms/new")} className="bg-[#2563eb] hover:bg-[#1d4ed8]"><Plus className="h-4 w-4 mr-1.5" /> Create Form</Button>}>
      {forms.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <h3 className="font-semibold text-[#0A1628] mb-1">No forms yet</h3>
          <p className="text-gray-500 mb-4">Create your first lead capture form.</p>
          <Button onClick={() => navigate("/lead-generation/forms/new")} className="bg-[#2563eb]">Create Form</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {forms.map(f => (
            <Card key={f.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-[#0A1628]">{f.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Created {new Date(f.createdAt).toLocaleDateString("en-GB")}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs ${f.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{f.status}</span>
              </div>
              <div className="text-sm text-gray-600 mb-4">{f.responses} responses · {f.fields.length} fields</div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => navigate(`/lead-generation/forms/edit/${f.id}`)}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button>
                <Button size="sm" variant="outline" onClick={() => window.open(`/f/${f.id}`, "_blank")}><Eye className="h-3.5 w-3.5 mr-1" /> Preview</Button>
                <Button size="sm" variant="outline" onClick={() => setEmbedForm(f)}><Code className="h-3.5 w-3.5 mr-1" /> Embed</Button>
                <Button size="sm" variant="outline" onClick={() => duplicate(f)}><Copy className="h-3.5 w-3.5 mr-1" /> Copy</Button>
                <Button size="sm" variant="outline" className="text-red-600" onClick={() => del(f.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!embedForm} onOpenChange={(o) => !o && setEmbedForm(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Share your form</DialogTitle></DialogHeader>
          <Tabs defaultValue="embed">
            <TabsList><TabsTrigger value="embed">HTML Embed</TabsTrigger><TabsTrigger value="link">Direct Link</TabsTrigger></TabsList>
            <TabsContent value="embed" className="space-y-3">
              <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto whitespace-pre-wrap">{embedSnippet}</pre>
              <Button onClick={() => { navigator.clipboard.writeText(embedSnippet); toast.success("Copied!"); }}><Copy className="h-4 w-4 mr-1.5" /> Copy Code</Button>
              <p className="text-sm text-gray-500">Paste this snippet anywhere on your website. Leads will appear in B2BNEST automatically.</p>
            </TabsContent>
            <TabsContent value="link" className="space-y-3">
              <Input readOnly value={directLink} onClick={(e) => (e.target as HTMLInputElement).select()} />
              <div className="flex gap-2">
                <Button onClick={() => { navigator.clipboard.writeText(directLink); toast.success("Link copied"); }}><Copy className="h-4 w-4 mr-1.5" /> Copy Link</Button>
                <Button variant="outline" onClick={() => window.open(directLink, "_blank")}><ExternalLink className="h-4 w-4 mr-1.5" /> Open Link</Button>
              </div>
              <p className="text-sm text-gray-500">Share this link directly — no website needed. Works great for social media or email.</p>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </LeadGenLayout>
  );
}
