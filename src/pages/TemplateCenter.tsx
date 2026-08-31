import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  LayoutGrid,
  Sparkles,
  Clock,
  Star,
  Gift,
  Flame,
  Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import SEOHead from '@/components/SEOHead';
import Footer from '@/components/Footer';
import TemplateCard from '@/components/template-centre/TemplateCard';
import TemplatePreviewDialog from '@/components/template-centre/TemplatePreviewDialog';
import UseWorkspaceTemplateDialog from '@/components/template-centre/UseWorkspaceTemplateDialog';
import { INDUSTRIES, TEMPLATE_CATEGORIES } from '@/data/workspaceTemplates';
import {
  loadTemplates,
  loadUsage,
  logTemplateEvent,
} from '@/services/workspaceTemplateService';
import {
  TEMPLATE_TYPE_LABELS,
  TemplateType,
  TemplateUsage,
  WorkspaceTemplate,
} from '@/types/workspaceTemplate';
import { useSubscription } from '@/hooks/useSubscription';

type SortKey = 'featured' | 'popular' | 'recent' | 'name';

const SORT_LABELS: Record<SortKey, string> = {
  featured: 'Featured first',
  popular: 'Most used',
  recent: 'Recently added',
  name: 'Name (A–Z)',
};

const QUICK_LINKS = [
  { id: 'all', label: 'All templates', icon: LayoutGrid },
  { id: 'featured', label: 'Featured', icon: Star },
  { id: 'popular', label: 'Popular', icon: Flame },
  { id: 'recent', label: 'Recently added', icon: Clock },
  { id: 'ai', label: 'AI-Powered', icon: Sparkles },
  { id: 'free', label: 'Free', icon: Gift },
];

const TemplateCenter = () => {
  const { isPremium } = useSubscription();
  const [templates, setTemplates] = useState<WorkspaceTemplate[]>([]);
  const [usage, setUsage] = useState<Record<string, TemplateUsage>>({});
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [activeView, setActiveView] = useState('all');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const [industry, setIndustry] = useState<string | null>(null);
  const [types, setTypes] = useState<TemplateType[]>([]);
  const [aiOnly, setAiOnly] = useState(false);
  const [freeOnly, setFreeOnly] = useState(false);
  const [premiumOnly, setPremiumOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('featured');

  const [preview, setPreview] = useState<WorkspaceTemplate | null>(null);
  const [useTemplate, setUseTemplate] = useState<WorkspaceTemplate | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [list, counts] = await Promise.all([loadTemplates(), loadUsage()]);
      if (!active) return;
      setTemplates(list);
      setUsage(counts);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    let list = [...templates];
    const q = query.trim().toLowerCase();

    if (q) {
      list = list.filter((t) =>
        [
          t.name,
          t.description,
          t.longDescription,
          t.subcategory,
          TEMPLATE_CATEGORIES.find((c) => c.id === t.category)?.name ?? '',
          TEMPLATE_TYPE_LABELS[t.templateType],
          ...t.tags,
          ...t.industries,
          ...t.aiFeatures,
          ...t.helpsYouManage,
        ]
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    }

    if (activeView === 'featured') list = list.filter((t) => t.featured);
    if (activeView === 'ai') list = list.filter((t) => t.isAiPowered);
    if (activeView === 'free') list = list.filter((t) => t.plan === 'free');
    if (activeView === 'popular') list = list.filter((t) => (usage[t.slug]?.created ?? 0) > 0);
    if (activeView === 'recent') {
      const cutoff = [...templates]
        .map((t) => t.createdAt)
        .sort()
        .slice(-12)[0];
      list = list.filter((t) => t.createdAt >= (cutoff ?? ''));
    }

    if (activeCategory) list = list.filter((t) => t.category === activeCategory);
    if (activeSubcategory) list = list.filter((t) => t.subcategory === activeSubcategory);
    if (industry) list = list.filter((t) => t.industries.includes(industry));
    if (types.length) list = list.filter((t) => types.includes(t.templateType));
    if (aiOnly) list = list.filter((t) => t.isAiPowered);
    if (freeOnly) list = list.filter((t) => t.plan === 'free');
    if (premiumOnly) list = list.filter((t) => t.plan === 'premium');

    switch (sort) {
      case 'popular':
        return list.sort((a, b) => (usage[b.slug]?.created ?? 0) - (usage[a.slug]?.created ?? 0));
      case 'recent':
        return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      case 'name':
        return list.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return list.sort(
          (a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name),
        );
    }
  }, [
    templates,
    query,
    activeView,
    activeCategory,
    activeSubcategory,
    industry,
    types,
    aiOnly,
    freeOnly,
    premiumOnly,
    sort,
    usage,
  ]);

  const featured = useMemo(
    () => templates.filter((t) => t.featured).slice(0, 6),
    [templates],
  );

  const showFeaturedRow =
    activeView === 'all' && !activeCategory && !activeSubcategory && !query && featured.length > 0;

  const handlePreview = (t: WorkspaceTemplate) => {
    setPreview(t);
    void logTemplateEvent(t.slug, 'preview');
  };

  const handleUse = (t: WorkspaceTemplate) => {
    setPreview(null);
    setUseTemplate(t);
    void logTemplateEvent(t.slug, 'use_click');
  };

  const selectCategory = (categoryId: string | null, subcategory: string | null = null) => {
    setActiveView('all');
    setActiveCategory(categoryId);
    setActiveSubcategory(subcategory);
  };

  const heading = activeSubcategory
    ? activeSubcategory
    : activeCategory
      ? TEMPLATE_CATEGORIES.find((c) => c.id === activeCategory)?.name ?? 'Templates'
      : QUICK_LINKS.find((q) => q.id === activeView)?.label ?? 'All templates';

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Template Centre — Ready-Made Business Workflows | B2BNest"
        description="Browse ready-made business workflow templates for CRM, sales, marketing, finance, HR, operations and AI automation. Preview a template and create a working workspace in one click."
        canonical="https://www.b2bnest.online/template-center"
      />

      <header className="sticky top-0 z-20 border-b border-border bg-background">
        <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:gap-4 md:px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <LayoutGrid className="h-4 w-4" />
            </span>
            <h1 className="text-lg font-semibold">Template Centre</h1>
          </div>

          <div className="relative flex-1 md:mx-6 md:max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates by name, use case, industry or AI capability"
              aria-label="Search templates"
              className="rounded-full pl-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <SlidersHorizontal className="mr-2 h-4 w-4" /> Filter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-96 w-64 overflow-y-auto bg-popover">
                <DropdownMenuLabel>Template type</DropdownMenuLabel>
                {(Object.keys(TEMPLATE_TYPE_LABELS) as TemplateType[]).map((t) => (
                  <DropdownMenuCheckboxItem
                    key={t}
                    checked={types.includes(t)}
                    onCheckedChange={(v) =>
                      setTypes((prev) => (v ? [...prev, t] : prev.filter((p) => p !== t)))
                    }
                  >
                    {TEMPLATE_TYPE_LABELS[t]}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Industry</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={industry ?? 'all'}
                  onValueChange={(v) => setIndustry(v === 'all' ? null : v)}
                >
                  <DropdownMenuRadioItem value="all">All industries</DropdownMenuRadioItem>
                  {INDUSTRIES.map((i) => (
                    <DropdownMenuRadioItem key={i} value={i}>
                      {i}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Availability</DropdownMenuLabel>
                <DropdownMenuCheckboxItem checked={aiOnly} onCheckedChange={(v) => setAiOnly(!!v)}>
                  AI-Powered only
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={freeOnly} onCheckedChange={(v) => setFreeOnly(!!v)}>
                  Free only
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={premiumOnly}
                  onCheckedChange={(v) => setPremiumOnly(!!v)}
                >
                  Premium only
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  <ArrowUpDown className="mr-2 h-4 w-4" /> {SORT_LABELS[sort]}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                  {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                    <DropdownMenuRadioItem key={k} value={k}>
                      {SORT_LABELS[k]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="sticky top-[61px] hidden h-[calc(100vh-61px)] w-64 shrink-0 border-r border-border bg-background lg:block">
          <ScrollArea className="h-full">
            <div className="p-4">
              <nav className="space-y-1 border-b border-border pb-4">
                {QUICK_LINKS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => {
                      setActiveView(id);
                      setActiveCategory(null);
                      setActiveSubcategory(null);
                    }}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                      activeView === id && !activeCategory
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </nav>

              <div className="mt-4 space-y-4">
                {TEMPLATE_CATEGORIES.map((cat) => (
                  <div key={cat.id}>
                    <button
                      onClick={() => selectCategory(cat.id)}
                      className={`mb-1 w-full px-2 text-left text-xs font-semibold uppercase tracking-wide transition-colors ${
                        activeCategory === cat.id ? 'text-primary' : 'text-foreground'
                      }`}
                    >
                      {cat.name}
                    </button>
                    <div className="space-y-0.5">
                      {cat.subcategories.map((sub) => (
                        <button
                          key={`${cat.id}-${sub}`}
                          onClick={() => selectCategory(cat.id, sub)}
                          className={`w-full rounded-md px-2 py-1 text-left text-sm transition-colors ${
                            activeCategory === cat.id && activeSubcategory === sub
                              ? 'bg-primary/10 font-medium text-primary'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                <div>
                  <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide">
                    Industries
                  </p>
                  <div className="space-y-0.5">
                    {INDUSTRIES.map((i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setIndustry(industry === i ? null : i);
                          setActiveView('all');
                        }}
                        className={`w-full rounded-md px-2 py-1 text-left text-sm transition-colors ${
                          industry === i
                            ? 'bg-primary/10 font-medium text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        {i}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
          {/* Mobile chips */}
          <div className="mb-5 flex gap-2 overflow-x-auto lg:hidden">
            {QUICK_LINKS.map((l) => (
              <button
                key={l.id}
                onClick={() => {
                  setActiveView(l.id);
                  setActiveCategory(null);
                  setActiveSubcategory(null);
                }}
                className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs ${
                  activeView === l.id && !activeCategory
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground'
                }`}
              >
                {l.label}
              </button>
            ))}
            {TEMPLATE_CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => selectCategory(c.id)}
                className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs ${
                  activeCategory === c.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {showFeaturedRow && (
            <section className="mb-8">
              <h2 className="mb-1 text-xl font-bold">Featured templates</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Choose a ready-made business workflow and start working in minutes.
              </p>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {featured.map((t) => (
                  <TemplateCard
                    key={t.slug}
                    template={t}
                    usage={usage[t.slug]}
                    hasPremiumAccess={!!isPremium}
                    onPreview={handlePreview}
                    onUse={handleUse}
                  />
                ))}
              </div>
            </section>
          )}

          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold">{heading}</h2>
              <p className="text-sm text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? 'template' : 'templates'}
                {industry ? ` · ${industry}` : ''}
              </p>
            </div>
            {(activeCategory || activeSubcategory || industry || types.length || aiOnly || freeOnly || premiumOnly) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setActiveCategory(null);
                  setActiveSubcategory(null);
                  setIndustry(null);
                  setTypes([]);
                  setAiOnly(false);
                  setFreeOnly(false);
                  setPremiumOnly(false);
                }}
              >
                Clear filters
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-20 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading templates…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center">
              <p className="font-medium">No templates match your search</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different keyword or clear the filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filtered.map((t) => (
                <TemplateCard
                  key={t.slug}
                  template={t}
                  usage={usage[t.slug]}
                  hasPremiumAccess={!!isPremium}
                  onPreview={handlePreview}
                  onUse={handleUse}
                />
              ))}
            </div>
          )}

          <div className="mt-10 rounded-xl border border-border bg-muted/30 p-6">
            <h2 className="text-lg font-semibold">Need something specific?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tell us the workflow you run and we will add it to the Template Centre.
            </p>
            <Button asChild size="sm" variant="outline" className="mt-3">
              <Link to="/contact">Request a template</Link>
            </Button>
          </div>
        </main>
      </div>

      <TemplatePreviewDialog
        template={preview}
        isOpen={!!preview}
        hasPremiumAccess={!!isPremium}
        onClose={() => setPreview(null)}
        onUse={handleUse}
      />

      <UseWorkspaceTemplateDialog
        template={useTemplate}
        isOpen={!!useTemplate}
        onClose={() => setUseTemplate(null)}
      />

      <Footer />
    </div>
  );
};

export default TemplateCenter;
