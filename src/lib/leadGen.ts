// Lead Generation storage & helpers (localStorage-backed)

export type LeadStatus = "New" | "Contacted" | "Qualified" | "Disqualified" | "Converted";
export type ScoreLabel = "Cold" | "Warm" | "Hot" | "Ready";

export interface LeadNote { text: string; date: string; }

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  source: string;
  sourceTag: string;
  score: number;
  scoreLabel: ScoreLabel;
  status: LeadStatus;
  notes: LeadNote[];
  formId: string | null;
  pageId: string | null;
  crmContactId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FormField {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  locked?: boolean;
}

export interface LeadForm {
  id: string;
  name: string;
  status: "Draft" | "Active";
  fields: FormField[];
  design: {
    title: string;
    description: string;
    submitText: string;
    primaryColor: string;
    bgColor: string;
    borderRadius: number;
    showBranding: boolean;
  };
  settings: {
    successMessage: string;
    redirectUrl: string;
    sourceTag: string;
    emailNotification: boolean;
    gdprConsent: boolean;
    spamProtection: boolean;
  };
  responses: number;
  createdAt: string;
}

export interface PageBlock {
  id: string;
  type: "hero" | "text" | "features" | "form" | "social" | "cta";
  content: any;
}

export interface LandingPage {
  id: string;
  name: string;
  slug: string;
  status: "Draft" | "Published";
  blocks: PageBlock[];
  settings: { title: string; seoDescription: string; faviconEmoji: string };
  views: number;
  leadsCount: number;
  createdAt: string;
}

const K_LEADS = "b2bnest_leadgen_leads";
const K_FORMS = "b2bnest_leadgen_forms";
const K_PAGES = "b2bnest_leadgen_pages";
const K_SEEDED = "b2bnest_leadgen_seeded_v1";

export const uid = () => Math.random().toString(36).slice(2, 11) + Date.now().toString(36);

export function calculateScore(lead: Partial<Lead>): { score: number; label: ScoreLabel } {
  let s = 0;
  if (lead.email) s += 20;
  if (lead.phone) s += 15;
  if (lead.company) s += 15;
  const src = (lead.source || "").toLowerCase();
  if (src.includes("referral") || src.includes("event")) s += 20;
  else if (src.includes("website") || src.includes("form") || src.includes("landing")) s += 10;
  else if (src.includes("cold")) s += 5;
  if (lead.status === "Contacted") s += 10;
  if (lead.status === "Qualified") s += 25;
  if (lead.createdAt) {
    const ageDays = (Date.now() - new Date(lead.createdAt).getTime()) / 86400000;
    if (ageDays < 7) s += 5;
  } else {
    s += 5;
  }
  s = Math.min(100, Math.max(0, s));
  let label: ScoreLabel = "Cold";
  if (s >= 90) label = "Ready";
  else if (s >= 70) label = "Hot";
  else if (s >= 40) label = "Warm";
  return { score: s, label };
}

export const scoreBadgeClass = (label: ScoreLabel) =>
  ({
    Cold: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
    Warm: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
    Hot: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
    Ready: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  }[label]);

export const sourceBadgeClass = (source: string) => {
  const s = source.toLowerCase();
  if (s.includes("form")) return "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300";
  if (s.includes("landing")) return "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300";
  if (s.includes("import")) return "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200";
  if (s.includes("referral")) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300";
  if (s.includes("manual")) return "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300";
  return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200";
};

// Storage helpers
const read = <T>(k: string, fallback: T): T => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};
const write = <T>(k: string, v: T) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

export const getLeads = (): Lead[] => read<Lead[]>(K_LEADS, []);
export const setLeads = (v: Lead[]) => write(K_LEADS, v);
export const getForms = (): LeadForm[] => read<LeadForm[]>(K_FORMS, []);
export const setForms = (v: LeadForm[]) => write(K_FORMS, v);
export const getPages = (): LandingPage[] => read<LandingPage[]>(K_PAGES, []);
export const setPages = (v: LandingPage[]) => write(K_PAGES, v);

export function upsertLead(input: Partial<Lead>): Lead {
  const leads = getLeads();
  const existing = input.id ? leads.find(l => l.id === input.id) : undefined;
  const now = new Date().toISOString();
  const base: Lead = existing ?? {
    id: uid(),
    firstName: "", lastName: "", email: "", phone: "", company: "",
    source: "Manual", sourceTag: "",
    score: 0, scoreLabel: "Cold",
    status: "New", notes: [],
    formId: null, pageId: null, crmContactId: null,
    createdAt: now, updatedAt: now,
  };
  const merged: Lead = { ...base, ...input, updatedAt: now };
  const { score, label } = calculateScore(merged);
  merged.score = score; merged.scoreLabel = label;
  const next = existing ? leads.map(l => l.id === merged.id ? merged : l) : [merged, ...leads];
  setLeads(next);
  return merged;
}

export function deleteLead(id: string) { setLeads(getLeads().filter(l => l.id !== id)); }

export function newDefaultForm(): LeadForm {
  return {
    id: uid(),
    name: "Untitled Form",
    status: "Draft",
    fields: [
      { id: uid(), type: "text", label: "First Name", placeholder: "Jane", required: true, locked: true },
      { id: uid(), type: "text", label: "Last Name", placeholder: "Doe", required: true, locked: true },
      { id: uid(), type: "email", label: "Email", placeholder: "jane@example.com", required: true, locked: true },
    ],
    design: {
      title: "Get in touch", description: "We'd love to hear from you.",
      submitText: "Submit", primaryColor: "#2563eb", bgColor: "#ffffff",
      borderRadius: 8, showBranding: true,
    },
    settings: {
      successMessage: "Thank you! We'll be in touch soon.",
      redirectUrl: "", sourceTag: "Embed Form",
      emailNotification: false, gdprConsent: false, spamProtection: true,
    },
    responses: 0,
    createdAt: new Date().toISOString(),
  };
}

export function saveForm(form: LeadForm) {
  const forms = getForms();
  const exists = forms.some(f => f.id === form.id);
  setForms(exists ? forms.map(f => f.id === form.id ? form : f) : [form, ...forms]);
}
export const deleteForm = (id: string) => setForms(getForms().filter(f => f.id !== id));

export function newDefaultPage(): LandingPage {
  return {
    id: uid(),
    name: "Untitled Page",
    slug: "page-" + Math.random().toString(36).slice(2, 7),
    status: "Draft",
    blocks: [
      { id: uid(), type: "hero", content: { headline: "Your headline here", subheadline: "A compelling subheading.", bgColor: "#0A1628" } },
    ],
    settings: { title: "Landing Page", seoDescription: "", faviconEmoji: "" },
    views: 0,
    leadsCount: 0,
    createdAt: new Date().toISOString(),
  };
}
export function savePage(p: LandingPage) {
  const pages = getPages();
  const exists = pages.some(x => x.id === p.id);
  setPages(exists ? pages.map(x => x.id === p.id ? p : x) : [p, ...pages]);
}
export const deletePage = (id: string) => setPages(getPages().filter(p => p.id !== id));

export function seedIfEmpty() {
  if (localStorage.getItem(K_SEEDED)) return;
  if (getLeads().length === 0) {
    const samples: Array<Partial<Lead>> = [
      { firstName: "Sarah", lastName: "Johnson", email: "sarah@techstartup.io", company: "TechStartup", source: "Website Form", status: "New" },
      { firstName: "James", lastName: "Carter", email: "j.carter@growthco.com", phone: "+44 7700 900111", company: "GrowthCo", source: "Referral", status: "Contacted" },
      { firstName: "Priya", lastName: "Patel", email: "priya@designstudio.co.uk", company: "Design Studio", source: "Landing Page", status: "New" },
      { firstName: "Marcus", lastName: "Webb", email: "m.webb@consultingltd.com", company: "Consulting Ltd", source: "CSV Import", status: "Qualified" },
      { firstName: "Emma", lastName: "Collins", email: "emma@retailbrand.co.uk", source: "Cold Outreach", status: "New" },
    ];
    samples.forEach(s => upsertLead(s));
  }
  if (getForms().length === 0) {
    const f = newDefaultForm();
    f.name = "Contact Us Form";
    f.status = "Active";
    f.responses = 5;
    f.fields.push({ id: uid(), type: "phone", label: "Phone", placeholder: "+44...", required: false });
    f.fields.push({ id: uid(), type: "textarea", label: "Message", placeholder: "How can we help?", required: false });
    saveForm(f);
    if (getPages().length === 0) {
      const p = newDefaultPage();
      p.name = "Book a Free Demo";
      p.slug = "book-a-demo";
      p.status = "Published";
      p.blocks = [
        { id: uid(), type: "hero", content: { headline: "Book a Free Demo", subheadline: "See B2BNEST in action — 15 minutes, no pressure.", bgColor: "#0A1628" } },
        { id: uid(), type: "features", content: { items: [
          { icon: "⚡", title: "Fast setup", description: "Up and running in minutes." },
          { icon: "🔒", title: "Secure", description: "Enterprise-grade security." },
          { icon: "💷", title: "Save money", description: "Replace 10+ tools." },
        ]}},
        { id: uid(), type: "form", content: { formId: f.id } },
      ];
      savePage(p);
    }
  }
  localStorage.setItem(K_SEEDED, "1");
}
