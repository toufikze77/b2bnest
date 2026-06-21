import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import LeadGenLayout from "./LeadGenLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LandingPage, getPages, deletePage, savePage } from "@/lib/leadGen";
import { toast } from "sonner";
import { Plus, Layout, Trash2, Copy, ExternalLink, Pencil, Link2 } from "lucide-react";

export default function PagesList() {
  const navigate = useNavigate();
  const [pages, setPages] = useState<LandingPage[]>([]);
  const refresh = () => setPages(getPages());
  useEffect(() => { refresh(); }, []);

  const dup = (p: LandingPage) => {
    savePage({ ...p, id: Math.random().toString(36).slice(2, 11), name: p.name + " (Copy)", slug: p.slug + "-copy", views: 0, leadsCount: 0, createdAt: new Date().toISOString() });
    toast.success("Page duplicated"); refresh();
  };
  const del = (id: string) => { if (!confirm("Delete this page?")) return; deletePage(id); toast.success("Deleted"); refresh(); };

  return (
    <LeadGenLayout title="Landing Pages" subtitle="One-page lead capture sites hosted on B2BNEST"
      right={<Button onClick={() => navigate("/lead-generation/pages/new")} className="bg-[#2563eb] hover:bg-[#1d4ed8]"><Plus className="h-4 w-4 mr-1.5" /> Create Page</Button>}>
      {pages.length === 0 ? (
        <Card className="p-12 text-center">
          <Layout className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <h3 className="font-semibold text-[#0A1628]">No landing pages yet</h3>
          <p className="text-gray-500 mb-4">Build a one-page site to capture leads.</p>
          <Button onClick={() => navigate("/lead-generation/pages/new")} className="bg-[#2563eb]">Create Page</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pages.map(p => {
            const url = `${window.location.origin}/p/${p.slug}`;
            return (
              <Card key={p.id} className="p-5">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-[#0A1628]">{p.name}</h3>
                    <a href={url} target="_blank" rel="noreferrer" className="text-xs text-[#2563eb] hover:underline flex items-center gap-1"><Link2 className="h-3 w-3" /> /p/{p.slug}</a>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${p.status === "Published" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{p.status}</span>
                </div>
                <div className="text-sm text-gray-600 mb-4">{p.views} views · {p.leadsCount} leads</div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => navigate(`/lead-generation/pages/edit/${p.id}`)}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button>
                  <Button size="sm" variant="outline" onClick={() => window.open(url, "_blank")}><ExternalLink className="h-3.5 w-3.5 mr-1" /> Preview</Button>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }}><Copy className="h-3.5 w-3.5 mr-1" /> Copy</Button>
                  <Button size="sm" variant="outline" onClick={() => dup(p)}>Duplicate</Button>
                  <Button size="sm" variant="outline" className="text-red-600" onClick={() => del(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </LeadGenLayout>
  );
}
