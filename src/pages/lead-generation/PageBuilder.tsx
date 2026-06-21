import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import LeadGenLayout from "./LeadGenLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LandingPage, PageBlock, getPages, savePage, newDefaultPage, getForms, uid } from "@/lib/leadGen";
import { toast } from "sonner";
import { ArrowLeft, ChevronUp, ChevronDown, Trash2, Plus } from "lucide-react";
import PageRenderer from "./PageRenderer";

const EMOJIS = ["🚀","💼","📈","✨","💡","🎯","🌟","🔥","💷","📊","🤝","⚡"];

export default function PageBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState<LandingPage | null>(null);
  const forms = getForms();

  useEffect(() => {
    if (id) {
      const p = getPages().find(x => x.id === id);
      setPage(p || newDefaultPage());
    } else setPage(newDefaultPage());
  }, [id]);

  if (!page) return null;
  const update = (patch: Partial<LandingPage>) => setPage({ ...page, ...patch });
  const updateSettings = (patch: any) => setPage({ ...page, settings: { ...page.settings, ...patch } });

  const addBlock = (type: PageBlock["type"]) => {
    const defaults: Record<string, any> = {
      hero: { headline: "Headline", subheadline: "Subheading", bgColor: "#0A1628" },
      text: { text: "Your text here..." },
      features: { items: [{ icon: "⚡", title: "Fast", description: "Quick to use." },{ icon: "🔒", title: "Secure", description: "Safe by default." },{ icon: "💷", title: "Affordable", description: "Great value." }] },
      form: { formId: forms[0]?.id || "" },
      social: { quote: "Best tool we've used.", name: "Jane Doe", company: "Acme Co" },
      cta: { label: "Get Started", link: "#" },
    };
    update({ blocks: [...page.blocks, { id: uid(), type, content: defaults[type] }] });
  };

  const updateBlock = (bid: string, content: any) => update({ blocks: page.blocks.map(b => b.id === bid ? { ...b, content: { ...b.content, ...content } } : b) });
  const removeBlock = (bid: string) => update({ blocks: page.blocks.filter(b => b.id !== bid) });
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= page.blocks.length) return;
    const next = [...page.blocks]; [next[i], next[j]] = [next[j], next[i]]; update({ blocks: next });
  };

  const save = (status?: "Draft" | "Published") => {
    if (!page.name.trim()) { toast.error("Page needs a name"); return; }
    savePage(status ? { ...page, status } : page);
    toast.success(status === "Published" ? "Page published" : "Page saved");
    navigate("/lead-generation/pages");
  };

  return (
    <LeadGenLayout title={id ? "Edit Page" : "New Landing Page"} subtitle="Build a one-page lead capture site"
      right={<div className="flex gap-2">
        <Button variant="outline" onClick={() => navigate("/lead-generation/pages")}><ArrowLeft className="h-4 w-4 mr-1.5" /> Back</Button>
        <Button variant="outline" onClick={() => save("Draft")}>Save Draft</Button>
        <Button onClick={() => save("Published")} className="bg-[#00D68F] hover:bg-[#00b377] text-white">Publish</Button>
      </div>}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4">
            <Input className="text-lg font-semibold" value={page.name} onChange={e => update({ name: e.target.value })} placeholder="Page name" />
          </Card>

          {page.blocks.map((b, i) => (
            <Card key={b.id} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-500 uppercase">{b.type}</span>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => move(i, -1)}><ChevronUp className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => move(i, 1)}><ChevronDown className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-red-500" onClick={() => removeBlock(b.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>

              {b.type === "hero" && <div className="space-y-2">
                <Input value={b.content.headline} onChange={e => updateBlock(b.id, { headline: e.target.value })} placeholder="Headline" />
                <Input value={b.content.subheadline} onChange={e => updateBlock(b.id, { subheadline: e.target.value })} placeholder="Subheadline" />
                <div className="flex items-center gap-2"><span className="text-sm">Background</span><Input type="color" className="w-20" value={b.content.bgColor} onChange={e => updateBlock(b.id, { bgColor: e.target.value })} /></div>
              </div>}
              {b.type === "text" && <Textarea value={b.content.text} onChange={e => updateBlock(b.id, { text: e.target.value })} rows={4} />}
              {b.type === "features" && <div className="space-y-2">
                {b.content.items.map((it: any, idx: number) => (
                  <div key={idx} className="grid grid-cols-12 gap-2">
                    <Input className="col-span-2" value={it.icon} onChange={e => { const items = [...b.content.items]; items[idx].icon = e.target.value; updateBlock(b.id, { items }); }} placeholder="🚀" />
                    <Input className="col-span-4" value={it.title} onChange={e => { const items = [...b.content.items]; items[idx].title = e.target.value; updateBlock(b.id, { items }); }} placeholder="Title" />
                    <Input className="col-span-6" value={it.description} onChange={e => { const items = [...b.content.items]; items[idx].description = e.target.value; updateBlock(b.id, { items }); }} placeholder="Description" />
                  </div>
                ))}
              </div>}
              {b.type === "form" && <Select value={b.content.formId} onValueChange={v => updateBlock(b.id, { formId: v })}>
                <SelectTrigger><SelectValue placeholder="Select a form" /></SelectTrigger>
                <SelectContent>{forms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
              </Select>}
              {b.type === "social" && <div className="space-y-2">
                <Textarea value={b.content.quote} onChange={e => updateBlock(b.id, { quote: e.target.value })} />
                <Input value={b.content.name} onChange={e => updateBlock(b.id, { name: e.target.value })} placeholder="Name" />
                <Input value={b.content.company} onChange={e => updateBlock(b.id, { company: e.target.value })} placeholder="Company" />
              </div>}
              {b.type === "cta" && <div className="space-y-2">
                <Input value={b.content.label} onChange={e => updateBlock(b.id, { label: e.target.value })} placeholder="Button text" />
                <Input value={b.content.link} onChange={e => updateBlock(b.id, { link: e.target.value })} placeholder="https://..." />
              </div>}
            </Card>
          ))}

          <Card className="p-4">
            <p className="text-sm text-gray-500 mb-2">Add a block</p>
            <div className="flex flex-wrap gap-2">
              {(["hero","text","features","form","social","cta"] as const).map(t => (
                <Button key={t} size="sm" variant="outline" onClick={() => addBlock(t)}><Plus className="h-3 w-3 mr-1" /> {t}</Button>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4 space-y-3">
            <h3 className="font-semibold text-[#0A1628]">Page Settings</h3>
            <div><label className="text-sm">Page Title</label><Input value={page.settings.title} onChange={e => updateSettings({ title: e.target.value })} /></div>
            <div><label className="text-sm">URL slug</label><Input value={page.slug} onChange={e => update({ slug: e.target.value.replace(/[^a-z0-9-]/gi, "-").toLowerCase() })} /><p className="text-xs text-gray-500 mt-1">b2bnest.online/p/{page.slug}</p></div>
            <div><label className="text-sm">SEO Description</label><Textarea value={page.settings.seoDescription} onChange={e => updateSettings({ seoDescription: e.target.value })} rows={2} /></div>
            <div>
              <label className="text-sm">Favicon</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => updateSettings({ faviconEmoji: e })} className={`text-xl p-1 rounded ${page.settings.faviconEmoji === e ? "bg-blue-100" : "hover:bg-gray-100"}`}>{e}</button>
                ))}
              </div>
            </div>
            <label className="flex items-center justify-between text-sm pt-2"><span>Published</span>
              <Switch checked={page.status === "Published"} onCheckedChange={v => update({ status: v ? "Published" : "Draft" })} />
            </label>
          </Card>

          <Card className="p-3">
            <p className="text-xs font-medium text-gray-500 mb-2">PREVIEW</p>
            <div className="border rounded overflow-hidden" style={{ transform: "scale(0.85)", transformOrigin: "top left", width: "117%" }}>
              <PageRenderer page={page} preview />
            </div>
          </Card>
        </div>
      </div>
    </LeadGenLayout>
  );
}
