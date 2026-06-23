import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LeadForm, upsertLead, saveForm, getForms } from "@/lib/leadGen";
import { toast } from "sonner";
import { useUserAvatar } from "@/hooks/useUserAvatar";

interface Props { form: LeadForm; preview?: boolean; onSubmitted?: () => void; pageId?: string | null; }

export default function FormRenderer({ form, preview, onSubmitted, pageId }: Props) {
  const { avatarUrl, displayName } = useUserAvatar();
  const initials = (displayName || "U").slice(0, 2).toUpperCase();
  const [values, setValues] = useState<Record<string, any>>({});
  const [done, setDone] = useState(false);

  const set = (id: string, v: any) => setValues({ ...values, [id]: v });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (preview) { toast.info("Preview mode — not saved"); return; }

    // Validate required
    for (const f of form.fields) {
      if (f.required && !values[f.id]) { toast.error(`${f.label} is required`); return; }
    }
    if (form.settings.gdprConsent && !values.__gdpr) { toast.error("Please accept the consent"); return; }

    // Map to lead
    const fn = form.fields.find(f => f.label.toLowerCase().includes("first"))?.id;
    const ln = form.fields.find(f => f.label.toLowerCase().includes("last"))?.id;
    const em = form.fields.find(f => f.type === "email")?.id;
    const ph = form.fields.find(f => f.type === "phone")?.id;
    const co = form.fields.find(f => f.label.toLowerCase().includes("company"))?.id;

    upsertLead({
      firstName: fn ? values[fn] : "",
      lastName: ln ? values[ln] : "",
      email: em ? values[em] : "",
      phone: ph ? values[ph] : "",
      company: co ? values[co] : "",
      source: form.settings.sourceTag || "Embed Form",
      sourceTag: form.settings.sourceTag,
      status: "New",
      formId: form.id,
      pageId: pageId ?? null,
    });

    // Increment form responses
    const updated = { ...form, responses: form.responses + 1 };
    saveForm(updated);

    if (form.settings.redirectUrl) {
      window.location.href = form.settings.redirectUrl;
      return;
    }
    setDone(true);
    onSubmitted?.();
  };

  if (done) {
    return (
      <div className="p-8 text-center rounded-lg" style={{ background: form.design.bgColor, borderRadius: form.design.borderRadius }}>
        <div className="text-4xl mb-3">✓</div>
        <p className="text-lg text-[#0A1628]">{form.settings.successMessage}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="p-6 shadow-sm border"
      style={{ background: form.design.bgColor, borderRadius: form.design.borderRadius }}>
      {avatarUrl && (
        <div className="flex items-center gap-2 mb-4">
          <Avatar className="h-10 w-10">
            <AvatarImage src={avatarUrl} alt={displayName} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          {displayName && <span className="text-sm font-medium text-[#0A1628]">{displayName}</span>}
        </div>
      )}
      <h2 className="text-xl font-bold text-[#0A1628] mb-1">{form.design.title}</h2>
      {form.design.description && <p className="text-sm text-gray-600 mb-4">{form.design.description}</p>}

      <div className="space-y-3">
        {form.fields.filter(f => f.type !== "hidden").map(f => (
          <div key={f.id}>
            <label className="text-sm font-medium mb-1 block text-[#0A1628]">{f.label}{f.required && <span className="text-red-500"> *</span>}</label>
            {f.type === "textarea" ? (
              <Textarea placeholder={f.placeholder} value={values[f.id] || ""} onChange={e => set(f.id, e.target.value)} />
            ) : f.type === "dropdown" ? (
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={values[f.id] || ""} onChange={e => set(f.id, e.target.value)}>
                <option value="">{f.placeholder || "Select..."}</option>
                {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.type === "checkbox" ? (
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!values[f.id]} onCheckedChange={v => set(f.id, !!v)} /> {f.placeholder || "Yes"}</label>
            ) : f.type === "checkboxGroup" ? (
              <div className="space-y-1">{(f.options || []).map(o => (
                <label key={o} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={(values[f.id] || []).includes(o)} onCheckedChange={v => {
                    const cur = values[f.id] || []; set(f.id, v ? [...cur, o] : cur.filter((x: string) => x !== o));
                  }} /> {o}
                </label>
              ))}</div>
            ) : f.type === "radio" ? (
              <div className="space-y-1">{(f.options || []).map(o => (
                <label key={o} className="flex items-center gap-2 text-sm">
                  <input type="radio" name={f.id} value={o} checked={values[f.id] === o} onChange={() => set(f.id, o)} /> {o}
                </label>
              ))}</div>
            ) : f.type === "file" ? (
              <Input type="file" disabled />
            ) : (
              <Input type={f.type === "email" ? "email" : f.type === "date" ? "date" : f.type === "phone" ? "tel" : "text"}
                placeholder={f.placeholder} value={values[f.id] || ""} onChange={e => set(f.id, e.target.value)} />
            )}
          </div>
        ))}

        {form.settings.gdprConsent && (
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={!!values.__gdpr} onCheckedChange={v => set("__gdpr", !!v)} />
            <span>I agree to be contacted.</span>
          </label>
        )}
      </div>

      <Button type="submit" className="w-full mt-4 text-white" style={{ background: form.design.primaryColor }}>
        {form.design.submitText}
      </Button>

      {form.settings.spamProtection && <p className="text-[10px] text-gray-400 text-center mt-2">Protected by B2BNEST</p>}
      {form.design.showBranding && <p className="text-[10px] text-gray-400 text-center mt-1">Powered by B2BNEST</p>}
    </form>
  );
}
