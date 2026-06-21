import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import LeadGenLayout from "./LeadGenLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { LeadForm, FormField, getForms, newDefaultForm, saveForm, uid } from "@/lib/leadGen";
import { toast } from "sonner";
import { GripVertical, Trash2, Plus, ArrowLeft, Smartphone, Monitor } from "lucide-react";
import FormRenderer from "./FormRenderer";

const FIELD_TYPES = [
  { type: "text", label: "Text Input" },
  { type: "email", label: "Email Input" },
  { type: "phone", label: "Phone Number" },
  { type: "textarea", label: "Textarea" },
  { type: "dropdown", label: "Dropdown" },
  { type: "checkbox", label: "Checkbox" },
  { type: "checkboxGroup", label: "Checkbox Group" },
  { type: "radio", label: "Radio Buttons" },
  { type: "date", label: "Date Picker" },
  { type: "file", label: "File Upload" },
  { type: "hidden", label: "Hidden Field" },
];

export default function FormBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<LeadForm | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  useEffect(() => {
    if (id) {
      const existing = getForms().find(f => f.id === id);
      setForm(existing || newDefaultForm());
    } else {
      setForm(newDefaultForm());
    }
  }, [id]);

  if (!form) return null;

  const update = (patch: Partial<LeadForm>) => setForm({ ...form, ...patch });
  const updateDesign = (patch: any) => setForm({ ...form, design: { ...form.design, ...patch } });
  const updateSettings = (patch: any) => setForm({ ...form, settings: { ...form.settings, ...patch } });

  const addField = (type: string) => {
    const def = FIELD_TYPES.find(t => t.type === type);
    const f: FormField = { id: uid(), type, label: def?.label || "Field", placeholder: "", required: false };
    if (type === "dropdown" || type === "radio" || type === "checkboxGroup") f.options = ["Option 1", "Option 2"];
    update({ fields: [...form.fields, f] });
  };

  const updateField = (fid: string, patch: Partial<FormField>) => {
    update({ fields: form.fields.map(f => f.id === fid ? { ...f, ...patch } : f) });
  };
  const deleteField = (fid: string) => update({ fields: form.fields.filter(f => f.id !== fid) });
  const moveField = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= form.fields.length) return;
    const next = [...form.fields]; [next[i], next[j]] = [next[j], next[i]]; update({ fields: next });
  };

  const save = (status?: "Draft" | "Active") => {
    const toSave = status ? { ...form, status } : form;
    saveForm(toSave);
    toast.success(status === "Active" ? "Form published" : "Form saved");
    navigate("/lead-generation/forms");
  };

  return (
    <LeadGenLayout title={id ? "Edit Form" : "New Form"} subtitle="Build a lead capture form"
      right={<div className="flex gap-2">
        <Button variant="outline" onClick={() => navigate("/lead-generation/forms")}><ArrowLeft className="h-4 w-4 mr-1.5" /> Back</Button>
        <Button variant="outline" onClick={() => save("Draft")}>Save Draft</Button>
        <Button onClick={() => save("Active")} className="bg-[#00D68F] hover:bg-[#00b377] text-white">Publish Form</Button>
      </div>}>
      <div className="mb-4">
        <Input className="text-lg font-semibold max-w-md" value={form.name} onChange={e => update({ name: e.target.value })} placeholder="Form name" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <Tabs defaultValue="fields">
            <TabsList className="w-full"><TabsTrigger value="fields" className="flex-1">Fields</TabsTrigger><TabsTrigger value="design" className="flex-1">Design</TabsTrigger><TabsTrigger value="settings" className="flex-1">Settings</TabsTrigger></TabsList>

            <TabsContent value="fields" className="space-y-3 mt-4">
              {form.fields.map((f, i) => (
                <Card key={f.id} className="p-3">
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col">
                      <button onClick={() => moveField(i, -1)} className="text-gray-400 hover:text-gray-700"><GripVertical className="h-4 w-4" /></button>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">{f.type}</span>
                        {f.locked && <span className="text-xs text-gray-400">locked</span>}
                      </div>
                      <Input value={f.label} onChange={e => updateField(f.id, { label: e.target.value })} placeholder="Label" />
                      <Input value={f.placeholder || ""} onChange={e => updateField(f.id, { placeholder: e.target.value })} placeholder="Placeholder" />
                      {(f.type === "dropdown" || f.type === "radio" || f.type === "checkboxGroup") && (
                        <Input value={(f.options || []).join(", ")} onChange={e => updateField(f.id, { options: e.target.value.split(",").map(s => s.trim()) })} placeholder="Options, comma separated" />
                      )}
                      <label className="flex items-center gap-2 text-sm">
                        <Switch checked={!!f.required} onCheckedChange={v => updateField(f.id, { required: v })} disabled={f.locked} />
                        Required
                      </label>
                    </div>
                    {!f.locked && (
                      <Button size="icon" variant="ghost" className="text-red-500" onClick={() => deleteField(f.id)}><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                  <div className="flex gap-1 mt-2">
                    <Button size="sm" variant="ghost" onClick={() => moveField(i, -1)} disabled={i === 0}>↑</Button>
                    <Button size="sm" variant="ghost" onClick={() => moveField(i, 1)} disabled={i === form.fields.length - 1}>↓</Button>
                  </div>
                </Card>
              ))}
              <div>
                <Select onValueChange={addField}>
                  <SelectTrigger><SelectValue placeholder="+ Add field..." /></SelectTrigger>
                  <SelectContent>{FIELD_TYPES.map(t => <SelectItem key={t.type} value={t.type}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="design" className="space-y-3 mt-4">
              <Labeled label="Form Title"><Input value={form.design.title} onChange={e => updateDesign({ title: e.target.value })} /></Labeled>
              <Labeled label="Description"><Textarea value={form.design.description} onChange={e => updateDesign({ description: e.target.value })} /></Labeled>
              <Labeled label="Submit Button Text"><Input value={form.design.submitText} onChange={e => updateDesign({ submitText: e.target.value })} /></Labeled>
              <div className="grid grid-cols-2 gap-3">
                <Labeled label="Primary colour"><Input type="color" value={form.design.primaryColor} onChange={e => updateDesign({ primaryColor: e.target.value })} /></Labeled>
                <Labeled label="Background"><Input type="color" value={form.design.bgColor} onChange={e => updateDesign({ bgColor: e.target.value })} /></Labeled>
              </div>
              <Labeled label={`Border radius: ${form.design.borderRadius}px`}>
                <Slider value={[form.design.borderRadius]} max={16} step={1} onValueChange={([v]) => updateDesign({ borderRadius: v })} />
              </Labeled>
              <label className="flex items-center justify-between text-sm py-2">
                <span>Show B2BNEST branding</span>
                <Switch checked={form.design.showBranding} onCheckedChange={v => updateDesign({ showBranding: v })} />
              </label>
            </TabsContent>

            <TabsContent value="settings" className="space-y-3 mt-4">
              <Labeled label="Success Message"><Textarea value={form.settings.successMessage} onChange={e => updateSettings({ successMessage: e.target.value })} /></Labeled>
              <Labeled label="Redirect URL (optional)"><Input value={form.settings.redirectUrl} onChange={e => updateSettings({ redirectUrl: e.target.value })} placeholder="https://..." /></Labeled>
              <Labeled label="Lead Source Tag"><Input value={form.settings.sourceTag} onChange={e => updateSettings({ sourceTag: e.target.value })} placeholder="e.g. Homepage Form" /></Labeled>
              {[
                ["emailNotification","Email me on new submission"],
                ["gdprConsent","GDPR consent checkbox"],
                ["spamProtection","Spam protection"],
              ].map(([k, l]) => (
                <label key={k} className="flex items-center justify-between text-sm py-1.5">
                  <span>{l}</span>
                  <Switch checked={(form.settings as any)[k]} onCheckedChange={v => { updateSettings({ [k]: v }); if (k === "emailNotification" && v) toast.success("Email notifications enabled"); }} />
                </label>
              ))}
            </TabsContent>
          </Tabs>
        </Card>

        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-600">Live Preview</span>
            <div className="flex gap-1">
              <Button size="sm" variant={device === "desktop" ? "default" : "outline"} onClick={() => setDevice("desktop")}><Monitor className="h-4 w-4" /></Button>
              <Button size="sm" variant={device === "mobile" ? "default" : "outline"} onClick={() => setDevice("mobile")}><Smartphone className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="bg-gray-100 p-4 rounded-lg flex justify-center">
            <div style={{ width: device === "mobile" ? 360 : "100%", maxWidth: "100%" }}>
              <FormRenderer form={form} preview />
            </div>
          </div>
        </div>
      </div>
    </LeadGenLayout>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-sm font-medium block mb-1">{label}</label>{children}</div>;
}
