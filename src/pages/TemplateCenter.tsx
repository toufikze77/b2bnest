import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, SlidersHorizontal, Download, Sparkles, ArrowUpDown, MessageSquare, LayoutGrid } from 'lucide-react';
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
import TemplateThumbnail from '@/components/template-center/TemplateThumbnail';
import DocumentPreviewModal from '@/components/DocumentPreviewModal';
import CheckoutModal from '@/components/checkout/CheckoutModal';
import { templateService } from '@/services/templateService';
import { downloadTemplate } from '@/lib/templateGenerator';
import { toast } from '@/components/ui/use-toast';
import { Template } from '@/types/template';


type SortKey = 'recent' | 'popular' | 'rating' | 'price';

const SORT_LABELS: Record<SortKey, string> = {
  recent: 'Recently updated',
  popular: 'Most downloaded',
  rating: 'Top rated',
  price: 'Price: low to high',
};

const TemplateCenter = () => {
  const allTemplates = useMemo(() => templateService.searchTemplates(''), []);
  const categories = useMemo(() => templateService.getCategories(), []);

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [freeOnly, setFreeOnly] = useState(false);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [preview, setPreview] = useState<Template | null>(null);
  const [checkoutTemplate, setCheckoutTemplate] = useState<Template | null>(null);


  const filtered = useMemo(() => {
    let list = [...allTemplates];
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.author.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)),
      );
    }
    if (activeCategory === 'free') list = list.filter((t) => t.price === 0);
    else if (activeCategory === 'new') list = list.filter((t) => t.isNew);
    else if (activeCategory === 'trending') list = list.filter((t) => t.trending);
    else if (activeCategory !== 'all') list = list.filter((t) => t.category.id === activeCategory);

    if (freeOnly) list = list.filter((t) => t.price === 0);
    if (featuredOnly) list = list.filter((t) => t.featured);

    switch (sort) {
      case 'popular':
        return list.sort((a, b) => b.downloads - a.downloads);
      case 'rating':
        return list.sort((a, b) => b.rating - a.rating);
      case 'price':
        return list.sort((a, b) => a.price - b.price);
      default:
        return list.sort(
          (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime(),
        );
    }
  }, [allTemplates, query, activeCategory, sort, freeOnly, featuredOnly]);

  const activeLabel =
    activeCategory === 'all'
      ? 'All templates'
      : activeCategory === 'free'
        ? 'Free templates'
        : activeCategory === 'new'
          ? 'New'
          : activeCategory === 'trending'
            ? 'Trending'
            : categories.find((c) => c.id === activeCategory)?.name ?? 'Templates';

  const quickLinks = [
    { id: 'all', label: 'All templates' },
    { id: 'trending', label: 'Recommended for you' },
    { id: 'new', label: 'Recently added' },
    { id: 'free', label: 'Free templates' },
  ];

  const runDownload = (t: Template) => {
    try {
      const format = downloadTemplate(t);
      templateService.incrementDownloads(t.id);
      toast({
        title: 'Template downloaded',
        description: `${t.title} was generated as a ready-to-edit ${format} file.`,
      });
    } catch (error) {
      console.error('Template download failed:', error);
      toast({
        title: 'Download failed',
        description: 'We could not generate this template. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = (t: Template) => {
    if (t.price === 0) {
      runDownload(t);
    } else {
      setCheckoutTemplate(t);
    }
  };


  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Template Center — B2BNest"
        description="Browse ready-to-use business templates for CRM, invoicing, HR, legal and operations. Preview, customise and download in seconds."
        canonical="https://b2bnest.online/template-center"
      />

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-border bg-background">
        <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:gap-4 md:px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <LayoutGrid className="h-4 w-4" />
            </span>
            <h1 className="text-lg font-semibold">Template center</h1>
          </div>

          <div className="relative flex-1 md:mx-6 md:max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by template name, creator or description"
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
              <DropdownMenuContent align="end" className="w-52 bg-popover">
                <DropdownMenuLabel>Filters</DropdownMenuLabel>
                <DropdownMenuCheckboxItem checked={freeOnly} onCheckedChange={(v) => setFreeOnly(!!v)}>
                  Free only
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={featuredOnly} onCheckedChange={(v) => setFeaturedOnly(!!v)}>
                  Featured only
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="sm" asChild>
              <Link to="/contact">
                <MessageSquare className="mr-2 h-4 w-4" /> Feedback
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="sticky top-[61px] hidden h-[calc(100vh-61px)] w-64 shrink-0 border-r border-border bg-background lg:block">
          <ScrollArea className="h-full">
            <div className="p-4">
              <p className="mb-3 px-2 text-sm font-semibold">Work management</p>
              <nav className="space-y-1 border-b border-border pb-4">
                {quickLinks.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setActiveCategory(l.id)}
                    className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                      activeCategory === l.id
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </nav>

              <p className="mb-2 mt-4 px-2 text-sm font-semibold">General templates</p>
              <nav className="space-y-1">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveCategory(c.id)}
                    className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                      activeCategory === c.id
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </nav>
            </div>
          </ScrollArea>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              General templates <span className="text-foreground">| {activeLabel}</span>
            </p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  <ArrowUpDown className="mr-2 h-4 w-4" /> Sort by: {SORT_LABELS[sort]}
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
                <DropdownMenuSeparator />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile category chips */}
          <div className="mb-5 flex gap-2 overflow-x-auto lg:hidden">
            {[...quickLinks, ...categories.map((c) => ({ id: c.id, label: c.name }))].map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs ${
                  activeCategory === c.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {/* Promo card */}
            <article className="overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/10 via-background to-primary/5 p-5">
              <h2 className="text-lg font-bold leading-snug">
                AI-powered CRM that keeps deals moving
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Grow revenue faster with an intuitive CRM built on intelligent workflows.
              </p>
              <Button asChild size="sm" className="mt-4">
                <Link to="/crm">Try for free</Link>
              </Button>
              <div className="mt-5 h-32">
                <TemplateThumbnail seed="promo-crm" title="CRM pipeline" variant="gradient" />
              </div>
            </article>

            {filtered.map((t) => (
              <article
                key={t.id}
                className="group flex cursor-pointer flex-col rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
                onClick={() => setPreview(t)}
              >
                <div className="mb-4 h-36 rounded-md bg-muted/40 p-2">
                  <TemplateThumbnail seed={t.id} title={t.title} />
                </div>
                <h3 className="text-base font-semibold leading-snug text-foreground">{t.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">by {t.author}</p>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>

                <div className="mt-4 flex flex-wrap items-center gap-2 pt-2">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Download className="h-3.5 w-3.5" />
                    {t.downloads >= 1000 ? `${(t.downloads / 1000).toFixed(1)}K` : t.downloads}
                  </span>
                  {t.featured && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <Sparkles className="h-3 w-3" /> AI-powered
                    </Badge>
                  )}
                  <span className="ml-auto text-sm font-semibold">
                    {t.price === 0 ? 'Free' : `£${t.price.toFixed(2)}`}
                  </span>
                </div>

                <div className="mt-3 flex gap-2 border-t border-border pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreview(t);
                    }}
                  >
                    Preview
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(t);
                    }}
                  >
                    <Download className="mr-1 h-4 w-4" />
                    {t.price === 0 ? 'Use template' : 'Buy'}
                  </Button>
                </div>
              </article>
            ))}

          </div>

          {filtered.length === 0 && (
            <div className="py-20 text-center">
              <p className="font-medium">No templates match your search</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different keyword or clear the filters.
              </p>
            </div>
          )}
        </main>
      </div>

      {preview && (
        <DocumentPreviewModal
          isOpen={!!preview}
          onClose={() => setPreview(null)}
          template={preview}
          onDownload={(t) => {
            setPreview(null);
            handleDownload(t);
          }}
        />
      )}

      {checkoutTemplate && (
        <CheckoutModal
          isOpen={!!checkoutTemplate}
          onClose={() => setCheckoutTemplate(null)}
          amount={checkoutTemplate.price}
          currency={checkoutTemplate.currency}
          itemName={checkoutTemplate.title}
          onPaymentSuccess={() => {
            const t = checkoutTemplate;
            setCheckoutTemplate(null);
            if (t) runDownload(t);
          }}
        />
      )}


      <Footer />
    </div>
  );
};

export default TemplateCenter;
