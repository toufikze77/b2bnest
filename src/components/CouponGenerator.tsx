import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Copy, Trash2, Upload, Settings, Calendar, Percent, Gift, Tag, ShieldCheck, CheckCircle2, XCircle, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  checkCoupon, COUPON_STATUS_TEXT, couponsToCsv, generateCodes, MAX_BULK, MAX_BULK_MESSAGE, parseCouponsCsv, validateCoupon,
  type CaseStyle, type CodeCharset, type Coupon, type CouponStatus, type DiscountType, type GenerationPreset, type ImportResult,
} from '@/lib/coupons';

const DEFAULT_PRESETS: GenerationPreset[] = [
  { id: 'simple', name: 'Simple Alphanumeric', pattern: '', length: 8, groups: 1, separator: '-', charset: 'alphanumeric', caseStyle: 'upper' },
  { id: 'seasonal', name: 'Seasonal Promo', pattern: 'SPRING', length: 6, groups: 2, separator: '-', charset: 'alphanumeric', caseStyle: 'upper', prefix: 'SPRING' },
  { id: 'bogo', name: 'BOGO Flash', pattern: 'BOGO', length: 5, groups: 2, separator: '-', charset: 'alpha', caseStyle: 'upper', prefix: 'BOGO' },
  { id: 'blackfriday', name: 'Black Friday', pattern: 'BF', length: 6, groups: 3, separator: '-', charset: 'hex', caseStyle: 'upper', prefix: 'BF' },
];

const STORAGE_KEY = 'coupon_generator_state_v1';
const SAVE_DELAY_MS = 400;

type PersistedState = {
  coupons: Coupon[];
  preset: GenerationPreset;
  discountType: DiscountType;
  value: number;
  currency: string;
  minSpend?: number;
  maxUses?: number;
  perCustomerLimit?: number;
  startDate?: string;
  endDate?: string;
  description?: string;
  tagsCsv: string;
  isStackable: boolean;
  prefix: string;
  suffix: string;
  sampleQuantity: number;
};

const STATUS_STYLE: Record<CouponStatus, string> = {
  valid: 'border-success/40 bg-success/10 text-foreground',
  unknown: 'border-border bg-muted text-foreground',
  not_started: 'border-warning/40 bg-warning/10 text-foreground',
  expired: 'border-destructive/40 bg-destructive/10 text-foreground',
  used_up: 'border-destructive/40 bg-destructive/10 text-foreground',
  deactivated: 'border-destructive/40 bg-destructive/10 text-foreground',
  invalid: 'border-destructive/40 bg-destructive/10 text-foreground',
};

const CouponGenerator = () => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Generation settings
  const [preset, setPreset] = useState<GenerationPreset>(DEFAULT_PRESETS[0]);
  const [length, setLength] = useState<number>(8);
  const [groups, setGroups] = useState<number>(1);
  const [separator, setSeparator] = useState<string>('-');
  const [charset, setCharset] = useState<CodeCharset>('alphanumeric');
  const [customCharset, setCustomCharset] = useState<string>('');
  const [caseStyle, setCaseStyle] = useState<CaseStyle>('upper');
  const [prefix, setPrefix] = useState<string>('');
  const [suffix, setSuffix] = useState<string>('');
  const [sampleQuantity, setSampleQuantity] = useState<number>(10);

  // Coupon common fields
  const [discountType, setDiscountType] = useState<DiscountType>('percentage');
  const [value, setValue] = useState<number>(10);
  const [currency, setCurrency] = useState<string>('GBP');
  const [minSpend, setMinSpend] = useState<number | undefined>(undefined);
  const [maxUses, setMaxUses] = useState<number | undefined>(undefined);
  const [perCustomerLimit, setPerCustomerLimit] = useState<number | undefined>(undefined);
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);
  const [description, setDescription] = useState<string>('');
  const [tagsCsv, setTagsCsv] = useState<string>('');
  const [isStackable, setIsStackable] = useState<boolean>(false);

  // Validate tab
  const [checkCode, setCheckCode] = useState('');
  const [checkResult, setCheckResult] = useState<ReturnType<typeof checkCoupon> | null>(null);
  // Import / Export tab
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const effectivePreset = useMemo<GenerationPreset>(() => ({
    id: 'custom', name: 'Custom', pattern: '', length, groups, separator, charset, customCharset, caseStyle,
    prefix: prefix || undefined, suffix: suffix || undefined,
  }), [length, groups, separator, charset, customCharset, caseStyle, prefix, suffix]);

  // Load saved state
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: PersistedState = JSON.parse(raw);
        setCoupons(parsed.coupons || []);
        setPreset(parsed.preset || DEFAULT_PRESETS[0]);
        setLength(parsed.preset?.length ?? 8);
        setGroups(parsed.preset?.groups ?? 1);
        setSeparator(parsed.preset?.separator ?? '-');
        setCharset(parsed.preset?.charset ?? 'alphanumeric');
        setCustomCharset(parsed.preset?.customCharset ?? '');
        setCaseStyle(parsed.preset?.caseStyle ?? 'upper');
        setPrefix(parsed.prefix ?? '');
        setSuffix(parsed.suffix ?? '');
        setSampleQuantity(parsed.sampleQuantity ?? 10);
        setDiscountType(parsed.discountType ?? 'percentage');
        setValue(parsed.value ?? 10);
        setCurrency(parsed.currency ?? 'GBP');
        setMinSpend(parsed.minSpend);
        setMaxUses(parsed.maxUses);
        setPerCustomerLimit(parsed.perCustomerLimit);
        setStartDate(parsed.startDate);
        setEndDate(parsed.endDate);
        setDescription(parsed.description ?? '');
        setTagsCsv(parsed.tagsCsv ?? '');
        setIsStackable(parsed.isStackable ?? false);
      }
    } catch {
      // ignore persistence read errors
    }
    setLoaded(true);
  }, []);

  // Persist state, debounced (typing in a field no longer writes thousands of coupons on every key press).
  useEffect(() => {
    if (!loaded) return;
    const data: PersistedState = {
      coupons, preset: effectivePreset, discountType, value, currency, minSpend, maxUses, perCustomerLimit, startDate, endDate,
      description, tagsCsv, isStackable, prefix, suffix, sampleQuantity,
    };
    const t = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* storage full or blocked */ }
    }, SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [loaded, coupons, effectivePreset, discountType, value, currency, minSpend, maxUses, perCustomerLimit, startDate, endDate, description, tagsCsv, isStackable, prefix, suffix, sampleQuantity]);

  const existingCodes = useMemo(() => new Set(coupons.map(c => c.code)), [coupons]);

  const handleGenerate = (quantity: number) => {
    if (quantity > MAX_BULK) {
      toast({ title: 'Too many codes', description: MAX_BULK_MESSAGE, variant: 'destructive' });
      return;
    }
    const template: Coupon = {
      id: 'template', code: 'TEMPLATE', discountType, value, currency: discountType === 'fixed' ? currency : undefined,
      minSpend, maxUses, perCustomerLimit, startDate, endDate, description,
      tags: tagsCsv.split(',').map(t => t.trim()).filter(Boolean), isStackable, isActive: true,
    };
    const errors = validateCoupon(template).filter((e) => !e.startsWith('Code '));
    if (errors.length > 0) {
      toast({ title: 'Check the coupon details', description: errors.join('\n'), variant: 'destructive' });
      return;
    }
    const { codes, shortBy } = generateCodes(effectivePreset, quantity, existingCodes);
    const tooShort = codes.find((c) => validateCoupon({ ...template, code: c }).length > 0);
    if (tooShort !== undefined) {
      toast({ title: 'Code too short', description: 'Code must be at least 4 characters. Increase the length or the number of groups.', variant: 'destructive' });
      return;
    }
    const created = codes.map((code) => ({ ...template, id: crypto.randomUUID(), code }));
    setCoupons(prev => [...created, ...prev]);
    toast({
      title: 'Coupons generated',
      description: shortBy > 0
        ? `${created.length} created. ${shortBy} more could not be made unique with these settings: make the codes longer.`
        : `${created.length} coupon(s) created.`,
    });
  };

  const handleClear = () => {
    setCoupons([]);
    toast({ title: 'Cleared', description: 'All coupons removed from this browser.' });
  };

  const exportCSV = () => {
    if (coupons.length === 0) {
      toast({ title: 'Nothing to export', description: 'Generate or import coupons first.' });
      return;
    }
    const blob = new Blob([couponsToCsv(coupons)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'coupons.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importCSV = async (file: File) => {
    const result = parseCouponsCsv(await file.text(), existingCodes);
    setImportResult(result);
    if (result.imported.length) setCoupons(prev => [...result.imported, ...prev]);
    toast({
      title: 'Import finished',
      description: `${result.imported.length} imported, ${result.rejected.length} rejected.`,
      variant: result.imported.length === 0 && result.rejected.length > 0 ? 'destructive' : undefined,
    });
  };

  const copyCodes = async () => {
    if (coupons.length === 0) return;
    try {
      await navigator.clipboard.writeText(coupons.map(c => c.code).join('\n'));
      toast({ title: 'Copied', description: 'All coupon codes copied to the clipboard.' });
    } catch {
      toast({ title: 'Could not copy', description: 'Your browser blocked the clipboard.', variant: 'destructive' });
    }
  };

  const deactivateCoupon = (id: string) => setCoupons(prev => prev.map(c => c.id === id ? { ...c, isActive: false } : c));
  const deleteCoupon = (id: string) => setCoupons(prev => prev.filter(c => c.id !== id));
  const recordUse = (id: string) => setCoupons(prev => prev.map(c => c.id === id ? { ...c, uses: (c.uses ?? 0) + 1 } : c));

  const runCheck = () => setCheckResult(checkCoupon(checkCode, coupons));

  const samplePreview = useMemo(
    () => generateCodes(effectivePreset, Math.min(sampleQuantity, 20), new Set()).codes,
    [effectivePreset, sampleQuantity],
  );

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2"><Tag className="h-6 w-6" aria-hidden="true" /> Create Coupon</h1>
        <p className="text-muted-foreground">Generate, validate and manage coupon codes, with CSV import and export.</p>
        <p className="mt-1 text-sm text-muted-foreground" data-testid="coupon-storage-note">Coupons are saved in this browser only.</p>
      </div>

      <Tabs defaultValue="generate" className="space-y-6">
        <TabsList className="flex w-full flex-wrap justify-start gap-1 h-auto">
          <TabsTrigger value="generate">Generate</TabsTrigger>
          <TabsTrigger value="validate">Validate</TabsTrigger>
          <TabsTrigger value="manage">Manage ({coupons.length})</TabsTrigger>
          <TabsTrigger value="import-export">Import / Export</TabsTrigger>
        </TabsList>

        <TabsContent value="generate">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" aria-hidden="true" /> Generation settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cg-preset" className="mb-1 block">Preset</Label>
                    <Select value={preset.id} onValueChange={(id) => {
                      const p = DEFAULT_PRESETS.find(x => x.id === id) || DEFAULT_PRESETS[0];
                      setPreset(p); setLength(p.length); setGroups(p.groups); setSeparator(p.separator); setCharset(p.charset);
                      setCustomCharset(p.customCharset || ''); setCaseStyle(p.caseStyle); setPrefix(p.prefix || ''); setSuffix(p.suffix || '');
                    }}>
                      <SelectTrigger id="cg-preset"><SelectValue placeholder="Select preset" /></SelectTrigger>
                      <SelectContent>{DEFAULT_PRESETS.map(p => <SelectItem value={p.id} key={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="cg-quantity" className="mb-1 block">Quantity (up to {MAX_BULK.toLocaleString('en-GB')})</Label>
                    <Input id="cg-quantity" type="number" min={1} max={MAX_BULK} value={sampleQuantity} onChange={(e) => setSampleQuantity(Math.max(1, Number(e.target.value) || 1))} />
                    {sampleQuantity > MAX_BULK && <p role="alert" className="mt-1 text-sm text-destructive">{MAX_BULK_MESSAGE}</p>}
                  </div>
                  <div>
                    <Label htmlFor="cg-length" className="mb-1 block">Length per group</Label>
                    <Input id="cg-length" type="number" min={2} value={length} onChange={(e) => setLength(Math.max(2, Number(e.target.value)))} />
                  </div>
                  <div>
                    <Label htmlFor="cg-groups" className="mb-1 block">Groups</Label>
                    <Input id="cg-groups" type="number" min={1} value={groups} onChange={(e) => setGroups(Math.max(1, Number(e.target.value)))} />
                  </div>
                  <div>
                    <Label htmlFor="cg-separator" className="mb-1 block">Separator</Label>
                    <Input id="cg-separator" value={separator} maxLength={2} onChange={(e) => setSeparator(e.target.value || '-')} />
                  </div>
                  <div>
                    <Label htmlFor="cg-charset" className="mb-1 block">Character set</Label>
                    <Select value={charset} onValueChange={(v: CodeCharset) => setCharset(v)}>
                      <SelectTrigger id="cg-charset"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alphanumeric">Alphanumeric</SelectItem>
                        <SelectItem value="alpha">Alpha only</SelectItem>
                        <SelectItem value="numeric">Numeric only</SelectItem>
                        <SelectItem value="hex">Hex</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {charset === 'custom' && (
                    <div className="md:col-span-2">
                      <Label htmlFor="cg-custom" className="mb-1 block">Custom characters</Label>
                      <Input id="cg-custom" value={customCharset} onChange={(e) => setCustomCharset(e.target.value)} placeholder="e.g. ABC123XYZ" />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="cg-case" className="mb-1 block">Case</Label>
                    <Select value={caseStyle} onValueChange={(v: CaseStyle) => setCaseStyle(v)}>
                      <SelectTrigger id="cg-case"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="upper">UPPERCASE</SelectItem>
                        <SelectItem value="lower">lowercase</SelectItem>
                        <SelectItem value="mixed">MiXeD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="cg-prefix" className="mb-1 block">Prefix (optional)</Label>
                    <Input id="cg-prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="e.g. SALE" />
                  </div>
                  <div>
                    <Label htmlFor="cg-suffix" className="mb-1 block">Suffix (optional)</Label>
                    <Input id="cg-suffix" value={suffix} onChange={(e) => setSuffix(e.target.value)} placeholder="e.g. 2026" />
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium">Sample preview</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {samplePreview.map(code => (
                      <div key={code} className="text-sm font-mono bg-muted border border-border rounded px-2 py-1">{code}</div>
                    ))}
                  </div>
                </div>

                <Button onClick={() => handleGenerate(sampleQuantity)} className="flex items-center gap-2"><Gift className="h-4 w-4" aria-hidden="true" /> Generate</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Percent className="h-5 w-5" aria-hidden="true" /> Coupon details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="cg-type" className="mb-1 block">Discount type</Label>
                  <Select value={discountType} onValueChange={(v: DiscountType) => setDiscountType(v)}>
                    <SelectTrigger id="cg-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed">Fixed amount</SelectItem>
                      <SelectItem value="free_shipping">Free shipping</SelectItem>
                      <SelectItem value="bogo">Buy one get one</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {discountType !== 'free_shipping' && (
                  <div>
                    <Label htmlFor="cg-value" className="mb-1 block">Value</Label>
                    <Input id="cg-value" type="number" min={discountType === 'percentage' ? 1 : 0.01} step={discountType === 'percentage' ? 1 : 0.01} value={value} onChange={(e) => setValue(Number(e.target.value))} />
                  </div>
                )}
                {discountType === 'fixed' && (
                  <div>
                    <Label htmlFor="cg-currency" className="mb-1 block">Currency</Label>
                    <Select value={currency} onValueChange={(v) => setCurrency(v)}>
                      <SelectTrigger id="cg-currency"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GBP">GBP</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="cg-min" className="mb-1 block">Min spend (optional)</Label>
                    <Input id="cg-min" type="number" min={0} step={0.01} value={minSpend ?? ''} onChange={(e) => setMinSpend(e.target.value === '' ? undefined : Number(e.target.value))} />
                  </div>
                  <div>
                    <Label htmlFor="cg-max" className="mb-1 block">Max uses (optional)</Label>
                    <Input id="cg-max" type="number" min={1} value={maxUses ?? ''} onChange={(e) => setMaxUses(e.target.value === '' ? undefined : Number(e.target.value))} />
                  </div>
                  <div>
                    <Label htmlFor="cg-percust" className="mb-1 block">Per-customer limit (optional)</Label>
                    <Input id="cg-percust" type="number" min={1} value={perCustomerLimit ?? ''} onChange={(e) => setPerCustomerLimit(e.target.value === '' ? undefined : Number(e.target.value))} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="cg-start" className="mb-1 block">Start date</Label>
                    <Input id="cg-start" type="date" value={startDate ?? ''} onChange={(e) => setStartDate(e.target.value || undefined)} />
                  </div>
                  <div>
                    <Label htmlFor="cg-end" className="mb-1 block">End date</Label>
                    <Input id="cg-end" type="date" value={endDate ?? ''} onChange={(e) => setEndDate(e.target.value || undefined)} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="cg-tags" className="mb-1 block">Tags (comma separated)</Label>
                  <Input id="cg-tags" value={tagsCsv} onChange={(e) => setTagsCsv(e.target.value)} placeholder="e.g. spring, vip, email" />
                </div>
                <div>
                  <Label htmlFor="cg-description" className="mb-1 block">Description</Label>
                  <Textarea id="cg-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description or terms" />
                </div>
                <div className="flex items-center gap-2">
                  <input id="stackable" type="checkbox" checked={isStackable} onChange={(e) => setIsStackable(e.target.checked)}
                    className="h-4 w-4 rounded focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring" />
                  <Label htmlFor="stackable">Allow stacking with other discounts</Label>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="validate">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" aria-hidden="true" /> Check a code</CardTitle>
              <CardDescription>Type a code to check it against the coupons saved in this browser.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); runCheck(); }}>
                <div className="min-w-0 flex-1">
                  <Label htmlFor="cg-check" className="mb-1 block">Coupon code</Label>
                  <Input id="cg-check" value={checkCode} onChange={(e) => { setCheckCode(e.target.value); setCheckResult(null); }} placeholder="e.g. SPRING-AB12CD" className="font-mono" />
                </div>
                <Button type="submit" disabled={!checkCode.trim()}>Check</Button>
              </form>
              {checkResult && (
                <div role="status" data-testid="coupon-check-result" className={`rounded-md border p-4 text-sm ${STATUS_STYLE[checkResult.status]}`}>
                  <p className="flex items-center gap-2 font-medium">
                    {checkResult.status === 'valid' ? <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" /> : <XCircle className="h-4 w-4" aria-hidden="true" />}
                    {COUPON_STATUS_TEXT[checkResult.status]}
                  </p>
                  {checkResult.problems && <ul className="mt-2 list-disc pl-5">{checkResult.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
                  {checkResult.coupon && (
                    <p className="mt-2 text-muted-foreground">
                      {checkResult.coupon.code}
                      {checkResult.coupon.startDate && ` · from ${checkResult.coupon.startDate}`}
                      {checkResult.coupon.endDate && ` · until ${checkResult.coupon.endDate}`}
                      {checkResult.coupon.maxUses ? ` · used ${checkResult.coupon.uses ?? 0} of ${checkResult.coupon.maxUses}` : ''}
                    </p>
                  )}
                  {checkResult.status === 'valid' && checkResult.coupon && (
                    <Button size="sm" variant="outline" className="mt-3" onClick={() => { recordUse(checkResult.coupon!.id); setCheckResult(null); toast({ title: 'Use recorded' }); }}>
                      <Plus className="mr-1 h-4 w-4" aria-hidden="true" />Record a use
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" aria-hidden="true" /> Your coupons ({coupons.length})</CardTitle>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="outline" onClick={copyCodes} disabled={coupons.length === 0} className="flex items-center gap-2"><Copy className="h-4 w-4" aria-hidden="true" /> Copy codes</Button>
                <Button variant="destructive" onClick={handleClear} disabled={coupons.length === 0} className="flex items-center gap-2"><Trash2 className="h-4 w-4" aria-hidden="true" /> Clear all</Button>
              </div>
            </CardHeader>
            <CardContent>
              {coupons.length === 0 ? (
                <div className="text-muted-foreground text-sm">No coupons yet. Use the Generate tab, or import a CSV.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-border">
                        <th className="py-2 pr-2">Code</th>
                        <th className="py-2 pr-2">Type</th>
                        <th className="py-2 pr-2">Value</th>
                        <th className="py-2 pr-2">Limits</th>
                        <th className="py-2 pr-2">Active</th>
                        <th className="py-2 pr-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coupons.slice(0, 500).map(c => (
                        <tr key={c.id} className="border-b border-border last:border-0">
                          <td className="py-2 pr-2 font-mono">{c.code}</td>
                          <td className="py-2 pr-2">{c.discountType}</td>
                          <td className="py-2 pr-2">{c.discountType === 'percentage' ? `${c.value}%` : c.discountType === 'fixed' ? `${c.currency} ${c.value.toFixed(2)}` : c.discountType === 'free_shipping' ? '—' : 'BOGO'}</td>
                          <td className="py-2 pr-2 text-muted-foreground">
                            {c.minSpend ? `Min ${c.minSpend}` : ''} {c.maxUses ? `• Used ${c.uses ?? 0}/${c.maxUses}` : ''} {c.perCustomerLimit ? `• /Cust ${c.perCustomerLimit}` : ''}
                          </td>
                          <td className="py-2 pr-2">{c.isActive ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</td>
                          <td className="py-2 pr-2">
                            <div className="flex gap-2">
                              {c.isActive && <Button size="sm" variant="outline" onClick={() => deactivateCoupon(c.id)} className="h-8 px-2">Deactivate</Button>}
                              <Button size="sm" variant="destructive" onClick={() => deleteCoupon(c.id)} className="h-8 px-2" aria-label={`Delete ${c.code}`}>Delete</Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {coupons.length > 500 && <p className="mt-2 text-sm text-muted-foreground">Showing the first 500 of {coupons.length.toLocaleString('en-GB')}. Export CSV for the full list.</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import-export">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" aria-hidden="true" /> Import / Export</CardTitle>
              <CardDescription>Export your coupons as a CSV file, or import a CSV exported from this tool. Codes already saved are skipped.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={exportCSV} className="flex items-center gap-2"><Download className="h-4 w-4" aria-hidden="true" /> Export CSV</Button>
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} className="flex items-center gap-2"><Upload className="h-4 w-4" aria-hidden="true" /> Import CSV</Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  data-testid="coupon-import-input"
                  aria-label="Choose a CSV file to import"
                  onChange={async (e) => {
                    const input = e.currentTarget;
                    const file = input.files?.[0];
                    if (file) await importCSV(file);
                    input.value = ''; // the same file can be chosen again
                  }}
                />
              </div>
              {importResult && (
                <div role="status" data-testid="coupon-import-result" className="rounded-md border border-border p-4 text-sm">
                  <p className="font-medium">{importResult.imported.length} imported, {importResult.rejected.length} rejected.</p>
                  {importResult.rejected.length > 0 && (
                    <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                      {importResult.rejected.slice(0, 10).map((r) => <li key={`${r.line}-${r.reason}`}>Line {r.line}: {r.reason}</li>)}
                      {importResult.rejected.length > 10 && <li>…and {importResult.rejected.length - 10} more.</li>}
                    </ul>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CouponGenerator;
