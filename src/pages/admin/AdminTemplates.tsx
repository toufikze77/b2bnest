import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Copy, Save, Trash2, RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { INDUSTRIES, TEMPLATE_CATEGORIES } from '@/data/workspaceTemplates';
import {
  deleteTemplateOverride,
  loadTemplates,
  loadUsage,
  upsertTemplate,
} from '@/services/workspaceTemplateService';
import {
  TEMPLATE_TYPE_LABELS,
  TemplatePlan,
  TemplateType,
  TemplateUsage,
  WorkspaceTemplate,
} from '@/types/workspaceTemplate';

const emptyTemplate = (): WorkspaceTemplate => ({
  id: '',
  slug: '',
  name: '',
  description: '',
  longDescription: '',
  category: TEMPLATE_CATEGORIES[0].id,
  subcategory: TEMPLATE_CATEGORIES[0].subcategories[0],
  industries: [],
  templateType: 'board',
  tags: [],
  isAiPowered: false,
  aiFeatures: [],
  automations: [],
  features: [],
  whoItsFor: [],
  helpsYouManage: [],
  exampleWorkflow: [],
  plan: 'free',
  status: 'draft',
  featured: false,
  isCustom: true,
  previewImages: [],
  thumbnail: null,
  createdAt: new Date().toISOString().slice(0, 10),
  updatedAt: new Date().toISOString().slice(0, 10),
  boards: [
    {
      name: 'Main board',
      description: 'Main board',
      color: '#2563eb',
      columns: ['Item', 'Owner', 'Status', 'Due date'],
      statuses: ['Backlog', 'To do', 'In progress', 'Review', 'Done'],
      views: ['Table', 'Kanban', 'Dashboard'],
      groups: [{ name: 'Getting started', tasks: [] }],
    },
  ],
});

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export default function AdminTemplates() {
  const [templates, setTemplates] = useState<WorkspaceTemplate[]>([]);
  const [usage, setUsage] = useState<Record<string, TemplateUsage>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<WorkspaceTemplate | null>(null);

  const refresh = async () => {
    setLoading(true);
    const [list, counts] = await Promise.all([loadTemplates({ includeUnpublished: true }), loadUsage()]);
    setTemplates(list);
    setUsage(counts);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? templates.filter((t) => `${t.name} ${t.slug} ${t.category} ${t.tags.join(' ')}`.toLowerCase().includes(q))
      : templates;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [templates, search]);

  const totals = useMemo(() => {
    const t = Object.values(usage).reduce(
      (acc, u) => ({
        views: acc.views + u.views,
        previews: acc.previews + u.previews,
        useClicks: acc.useClicks + u.useClicks,
        created: acc.created + u.created,
      }),
      { views: 0, previews: 0, useClicks: 0, created: 0 },
    );
    return t;
  }, [usage]);

  const save = async (template: WorkspaceTemplate) => {
    if (!template.slug) {
      toast({ title: 'Slug required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await upsertTemplate({
        ...template,
        isAiPowered: template.aiFeatures.length > 0 ? true : template.isAiPowered,
      });
      toast({ title: 'Template saved', description: template.name });
      setEditing(null);
      await refresh();
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const setStatus = (t: WorkspaceTemplate, status: WorkspaceTemplate['status']) =>
    save({ ...t, status });

  const duplicate = (t: WorkspaceTemplate) =>
    setEditing({
      ...t,
      id: '',
      slug: `${t.slug}-copy`,
      name: `${t.name} (copy)`,
      isCustom: true,
      status: 'draft',
      createdAt: new Date().toISOString().slice(0, 10),
    });

  const resetOverride = async (t: WorkspaceTemplate) => {
    try {
      await deleteTemplateOverride(t.slug);
      toast({ title: t.isCustom ? 'Template deleted' : 'Reset to the built-in version' });
      await refresh();
    } catch (e) {
      toast({
        title: 'Action failed',
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const subcategories =
    TEMPLATE_CATEGORIES.find((c) => c.id === editing?.category)?.subcategories ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Template Centre</h1>
          <p className="text-sm text-muted-foreground">
            Manage the business template library, publishing and real usage analytics.
          </p>
        </div>
        <Button onClick={() => setEditing(emptyTemplate())}>
          <Plus className="mr-2 h-4 w-4" /> New template
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ['Templates', templates.length],
          ['Published', templates.filter((t) => t.status === 'published').length],
          ['Preview clicks', totals.previews],
          ['Use clicks', totals.useClicks],
          ['Workspaces created', totals.created],
        ].map(([label, value]) => (
          <Card key={label as string}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates"
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center gap-2 p-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading templates…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Uses</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t) => (
                    <TableRow key={t.slug}>
                      <TableCell>
                        <div className="font-medium">{t.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.slug}
                          {t.isAiPowered && ' · AI-Powered'}
                          {t.featured && ' · Featured'}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {TEMPLATE_CATEGORIES.find((c) => c.id === t.category)?.name ?? t.category}
                      </TableCell>
                      <TableCell className="text-sm">{TEMPLATE_TYPE_LABELS[t.templateType]}</TableCell>
                      <TableCell className="capitalize">{t.plan}</TableCell>
                      <TableCell>
                        <Badge variant={t.status === 'published' ? 'default' : 'secondary'}>
                          {t.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {usage[t.slug]?.created ?? 0}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setEditing(t)}>
                            Edit
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => duplicate(t)} title="Duplicate">
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setStatus(t, t.status === 'published' ? 'draft' : 'published')
                            }
                          >
                            {t.status === 'published' ? 'Unpublish' : 'Publish'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setStatus(t, 'archived')}
                            disabled={t.status === 'archived'}
                          >
                            Archive
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => resetOverride(t)}
                            title={t.isCustom ? 'Delete template' : 'Reset to built-in'}
                          >
                            {t.isCustom ? (
                              <Trash2 className="h-4 w-4 text-destructive" />
                            ) : (
                              <RotateCcw className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit template' : 'New template'}</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={editing.name}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        name: e.target.value,
                        slug: editing.slug || slugify(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input
                    value={editing.slug}
                    onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Short description</Label>
                <Textarea
                  rows={2}
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Long description</Label>
                <Textarea
                  rows={3}
                  value={editing.longDescription}
                  onChange={(e) => setEditing({ ...editing, longDescription: e.target.value })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={editing.category}
                    onValueChange={(v) =>
                      setEditing({
                        ...editing,
                        category: v,
                        subcategory:
                          TEMPLATE_CATEGORIES.find((c) => c.id === v)?.subcategories[0] ?? '',
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {TEMPLATE_CATEGORIES.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subcategory</Label>
                  <Select
                    value={editing.subcategory}
                    onValueChange={(v) => setEditing({ ...editing, subcategory: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {subcategories.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Template type</Label>
                  <Select
                    value={editing.templateType}
                    onValueChange={(v) => setEditing({ ...editing, templateType: v as TemplateType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {(Object.keys(TEMPLATE_TYPE_LABELS) as TemplateType[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {TEMPLATE_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Plan requirement</Label>
                  <Select
                    value={editing.plan}
                    onValueChange={(v) => setEditing({ ...editing, plan: v as TemplatePlan })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="included">Included in plan</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Industries (comma separated)</Label>
                  <Input
                    value={editing.industries.join(', ')}
                    placeholder={INDUSTRIES.slice(0, 3).join(', ')}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        industries: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tags (comma separated)</Label>
                  <Input
                    value={editing.tags.join(', ')}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        tags: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>AI capabilities (one per line — leave empty for non-AI templates)</Label>
                <Textarea
                  rows={3}
                  value={editing.aiFeatures.join('\n')}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      aiFeatures: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Thumbnail URL (optional)</Label>
                <Input
                  value={editing.thumbnail ?? ''}
                  onChange={(e) => setEditing({ ...editing, thumbnail: e.target.value || null })}
                />
              </div>

              <div className="space-y-2">
                <Label>Preview image URLs (one per line, optional)</Label>
                <Textarea
                  rows={2}
                  value={editing.previewImages.join('\n')}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      previewImages: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                />
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={editing.featured}
                    onCheckedChange={(v) => setEditing({ ...editing, featured: v })}
                  />
                  Featured
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={editing.isAiPowered}
                    onCheckedChange={(v) => setEditing({ ...editing, isAiPowered: v })}
                  />
                  AI-Powered badge
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={editing.status === 'published'}
                    onCheckedChange={(v) =>
                      setEditing({ ...editing, status: v ? 'published' : 'draft' })
                    }
                  />
                  Published
                </label>
              </div>

              {editing.slug && (
                <p className="text-xs text-muted-foreground">
                  Usage: {usage[editing.slug]?.previews ?? 0} previews ·{' '}
                  {usage[editing.slug]?.useClicks ?? 0} use clicks ·{' '}
                  {usage[editing.slug]?.created ?? 0} workspaces created
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => editing && save(editing)} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
