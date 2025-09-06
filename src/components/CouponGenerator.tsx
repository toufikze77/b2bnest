import React, { useEffect, useMemo, useState } from 'react';
import { Download, Copy, Check, Trash2, RefreshCw, Upload, Settings, Calendar, Percent, Gift, Tag, Save, Share2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

type CodeCharset = 'alphanumeric' | 'alpha' | 'numeric' | 'hex' | 'custom';
type DiscountType = 'percentage' | 'fixed' | 'free_shipping' | 'bogo';
type CaseStyle = 'upper' | 'lower' | 'mixed';

type Coupon = {
  id: string;
  code: string;
  discountType: DiscountType;
  value: number; // percentage or fixed currency value
  currency?: string;
  minSpend?: number;
  maxUses?: number; // overall uses across all customers
  perCustomerLimit?: number;
  startDate?: string;
  endDate?: string;
  description?: string;
  tags: string[];
  isStackable: boolean;
  isActive: boolean;
  metadata?: Record<string, string>;
};

type GenerationPreset = {
  id: string;
  name: string;
  pattern: string; // e.g. SPRING-{8:alnum}-{NN}
  length: number;
  groups: number;
  separator: string;
  charset: CodeCharset;
  customCharset?: string;
  caseStyle: CaseStyle;
  prefix?: string;
  suffix?: string;
};

const DEFAULT_PRESETS: GenerationPreset[] = [
  { id: 'simple', name: 'Simple Alphanumeric', pattern: '', length: 8, groups: 1, separator: '-', charset: 'alphanumeric', caseStyle: 'upper' },
  { id: 'seasonal', name: 'Seasonal Promo', pattern: 'SPRING', length: 6, groups: 2, separator: '-', charset: 'alphanumeric', caseStyle: 'upper', prefix: 'SPRING' },
  { id: 'bogo', name: 'BOGO Flash', pattern: 'BOGO', length: 5, groups: 2, separator: '-', charset: 'alpha', caseStyle: 'upper', prefix: 'BOGO' },
  { id: 'blackfriday', name: 'Black Friday', pattern: 'BF', length: 6, groups: 3, separator: '-', charset: 'hex', caseStyle: 'upper', prefix: 'BF' },
];

const STORAGE_KEY = 'coupon_generator_state_v1';

const buildCharset = (charset: CodeCharset, customCharset?: string): string => {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const numeric = '0123456789';
  const hex = '0123456789ABCDEF';
  switch (charset) {
    case 'alpha':
      return alpha;
    case 'numeric':
      return numeric;
    case 'hex':
      return hex;
    case 'custom':
      return customCharset && customCharset.length > 0 ? customCharset : 'ABCDEF0123456789';
    default:
      return alpha + numeric;
  }
};

const applyCase = (input: string, style: CaseStyle): string => {
  if (style === 'upper') return input.toUpperCase();
  if (style === 'lower') return input.toLowerCase();
  return input;
};

const generateToken = (length: number, charset: string): string => {
  let result = '';
  const randomValues = new Uint32Array(length);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
      const index = randomValues[i] % charset.length;
      result += charset[index];
    }
  } else {
    for (let i = 0; i < length; i++) {
      const index = Math.floor(Math.random() * charset.length);
      result += charset[index];
    }
  }
  return result;
};

const generateCode = (
  preset: GenerationPreset,
  ensureUnique: (candidate: string) => boolean
): string => {
  const charset = buildCharset(preset.charset, preset.customCharset);
  const parts: string[] = [];
  for (let g = 0; g < preset.groups; g++) {
    let token = generateToken(preset.length, charset);
    token = applyCase(token, preset.caseStyle);
    parts.push(token);
  }
  let code = parts.join(preset.separator);
  if (preset.prefix) code = `${preset.prefix}${preset.separator}${code}`;
  if (preset.suffix) code = `${code}${preset.separator}${preset.suffix}`;

  // Retry if collision
  let attempts = 0;
  while (!ensureUnique(code) && attempts < 5) {
    attempts += 1;
    const retryParts: string[] = [];
    for (let g = 0; g < preset.groups; g++) {
      let token = generateToken(preset.length, charset);
      token = applyCase(token, preset.caseStyle);
      retryParts.push(token);
    }
    code = retryParts.join(preset.separator);
    if (preset.prefix) code = `${preset.prefix}${preset.separator}${code}`;
    if (preset.suffix) code = `${code}${preset.separator}${preset.suffix}`;
  }
  return code;
};

const validateCoupon = (coupon: Coupon): string[] => {
  const errors: string[] = [];
  if (!coupon.code || coupon.code.length < 4) errors.push('Code must be at least 4 characters.');
  if (coupon.discountType === 'percentage' && (coupon.value <= 0 || coupon.value > 100)) errors.push('Percentage must be between 1 and 100.');
  if (coupon.discountType === 'fixed' && coupon.value <= 0) errors.push('Fixed amount must be greater than 0.');
  if (coupon.minSpend && coupon.minSpend < 0) errors.push('Minimum spend cannot be negative.');
  if (coupon.maxUses && coupon.maxUses <= 0) errors.push('Max uses must be greater than 0.');
  if (coupon.perCustomerLimit && coupon.perCustomerLimit <= 0) errors.push('Per-customer limit must be greater than 0.');
  if (coupon.startDate && coupon.endDate && new Date(coupon.startDate) > new Date(coupon.endDate)) errors.push('Start date must be before end date.');
  return errors;
};

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

const CouponGenerator = () => {
  const { toast } = useToast();

  const [coupons, setCoupons] = useState<Coupon[]>([]);

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
  const [currency, setCurrency] = useState<string>('USD');
  const [minSpend, setMinSpend] = useState<number | undefined>(undefined);
  const [maxUses, setMaxUses] = useState<number | undefined>(undefined);
  const [perCustomerLimit, setPerCustomerLimit] = useState<number | undefined>(undefined);
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);
  const [description, setDescription] = useState<string>('');
  const [tagsCsv, setTagsCsv] = useState<string>('');
  const [isStackable, setIsStackable] = useState<boolean>(false);

  // Derived current preset from manual overrides
  const effectivePreset = useMemo<GenerationPreset>(() => ({
    id: 'custom',
    name: 'Custom',
    pattern: '',
    length,
    groups,
    separator,
    charset,
    customCharset,
    caseStyle,
    prefix: prefix || undefined,
    suffix: suffix || undefined,
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
        setCurrency(parsed.currency ?? 'USD');
        setMinSpend(parsed.minSpend);
        setMaxUses(parsed.maxUses);
        setPerCustomerLimit(parsed.perCustomerLimit);
        setStartDate(parsed.startDate);
        setEndDate(parsed.endDate);
        setDescription(parsed.description ?? '');
        setTagsCsv(parsed.tagsCsv ?? '');
        setIsStackable(parsed.isStackable ?? false);
      }
    } catch {}
  }, []);

  // Persist state
  useEffect(() => {
    const data: PersistedState = {
      coupons,
      preset: effectivePreset,
      discountType,
      value,
      currency,
      minSpend,
      maxUses,
      perCustomerLimit,
      startDate,
      endDate,
      description,
      tagsCsv,
      isStackable,
      prefix,
      suffix,
      sampleQuantity,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }, [coupons, effectivePreset, discountType, value, currency, minSpend, maxUses, perCustomerLimit, startDate, endDate, description, tagsCsv, isStackable, prefix, suffix, sampleQuantity]);

  const existingCodes = useMemo(() => new Set(coupons.map(c => c.code)), [coupons]);

  const ensureUnique = (candidate: string) => !existingCodes.has(candidate);

  const handleGenerate = (quantity: number) => {
    const created: Coupon[] = [];
    for (let i = 0; i < quantity; i++) {
      const code = generateCode(effectivePreset, ensureUnique);
      const coupon: Coupon = {
        id: crypto.randomUUID(),
        code,
        discountType,
        value,
        currency: discountType === 'fixed' ? currency : undefined,
        minSpend,
        maxUses,
        perCustomerLimit,
        startDate,
        endDate,
        description,
        tags: tagsCsv.split(',').map(t => t.trim()).filter(Boolean),
        isStackable,
        isActive: true,
      };
      const errors = validateCoupon(coupon);
      if (errors.length > 0) {
        toast({ title: 'Validation error', description: errors.join('\n'), variant: 'destructive' });
        return;
      }
      created.push(coupon);
    }
    setCoupons(prev => [...created, ...prev]);
    toast({ title: 'Coupons generated', description: `${quantity} coupon(s) created.` });
  };

  const handleClear = () => {
    setCoupons([]);
    toast({ title: 'Cleared', description: 'All generated coupons removed.' });
  };

  const exportCSV = () => {
    if (coupons.length === 0) return;
    const headers = ['id','code','discountType','value','currency','minSpend','maxUses','perCustomerLimit','startDate','endDate','description','tags','isStackable','isActive'];
    const rows = coupons.map(c => [
      c.id,
      c.code,
      c.discountType,
      c.value,
      c.currency ?? '',
      c.minSpend ?? '',
      c.maxUses ?? '',
      c.perCustomerLimit ?? '',
      c.startDate ?? '',
      c.endDate ?? '',
      (c.description ?? '').replace(/\n/g, ' '),
      c.tags.join('|'),
      c.isStackable ? 'true' : 'false',
      c.isActive ? 'true' : 'false',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(String).map(v => v.includes(',') ? `"${v}"` : v).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
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
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length <= 1) return;
    const headers = lines[0].split(',').map(h => h.trim());
    const dataLines = lines.slice(1);
    const imported: Coupon[] = dataLines.map((line) => {
      // Handle quoted commas
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          values.push(current);
          current = '';
        } else {
          current += ch;
        }
      }
      values.push(current);

      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => obj[h] = (values[idx] ?? '').replace(/^\"|\"$/g, ''));
      const tags = (obj['tags'] || '').split('|').map(t => t.trim()).filter(Boolean);
      const coupon: Coupon = {
        id: obj['id'] || crypto.randomUUID(),
        code: obj['code'] || '',
        discountType: (obj['discountType'] as DiscountType) || 'percentage',
        value: Number(obj['value'] || 0),
        currency: obj['currency'] || undefined,
        minSpend: obj['minSpend'] ? Number(obj['minSpend']) : undefined,
        maxUses: obj['maxUses'] ? Number(obj['maxUses']) : undefined,
        perCustomerLimit: obj['perCustomerLimit'] ? Number(obj['perCustomerLimit']) : undefined,
        startDate: obj['startDate'] || undefined,
        endDate: obj['endDate'] || undefined,
        description: obj['description'] || undefined,
        tags,
        isStackable: obj['isStackable'] === 'true',
        isActive: obj['isActive'] !== 'false',
      };
      return coupon;
    });
    setCoupons(prev => [...imported, ...prev]);
    toast({ title: 'Imported', description: `${imported.length} coupon(s) imported.` });
  };

  const copyCodes = async () => {
    const text = coupons.map(c => c.code).join('\n');
    await navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: 'All coupon codes copied to clipboard.' });
  };

  const deactivateCoupon = (id: string) => {
    setCoupons(prev => prev.map(c => c.id === id ? { ...c, isActive: false } : c));
  };

  const deleteCoupon = (id: string) => {
    setCoupons(prev => prev.filter(c => c.id !== id));
  };

  const samplePreview = useMemo(() => {
    const codes: string[] = [];
    const set = new Set<string>();
    for (let i = 0; i < Math.min(sampleQuantity, 20); i++) {
      let candidate = generateCode(effectivePreset, (x) => !set.has(x));
      while (set.has(candidate)) {
        candidate = generateCode(effectivePreset, (x) => !set.has(x));
      }
      set.add(candidate);
      codes.push(candidate);
    }
    return codes;
  }, [effectivePreset, sampleQuantity]);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2"><Tag className="h-6 w-6"/> Create Coupon</h1>
        <p className="text-gray-600">Generate, validate, and manage bulk coupon codes with export/import.</p>
        <div className="mt-2 flex gap-2 flex-wrap">
          <Badge variant="secondary">Validation</Badge>
          <Badge variant="secondary">Bulk generation</Badge>
          <Badge variant="secondary">CSV import/export</Badge>
          <Badge variant="secondary">Unique codes</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5"/> Generation Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="mb-1 block">Preset</Label>
                <Select value={preset.id} onValueChange={(id) => {
                  const p = DEFAULT_PRESETS.find(x => x.id === id) || DEFAULT_PRESETS[0];
                  setPreset(p);
                  setLength(p.length);
                  setGroups(p.groups);
                  setSeparator(p.separator);
                  setCharset(p.charset);
                  setCustomCharset(p.customCharset || '');
                  setCaseStyle(p.caseStyle);
                  setPrefix(p.prefix || '');
                  setSuffix(p.suffix || '');
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_PRESETS.map(p => (
                      <SelectItem value={p.id} key={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block">Quantity</Label>
                <Input type="number" min={1} value={sampleQuantity} onChange={(e) => setSampleQuantity(Math.max(1, Number(e.target.value)))} />
              </div>
              <div>
                <Label className="mb-1 block">Length per group</Label>
                <Input type="number" min={2} value={length} onChange={(e) => setLength(Math.max(2, Number(e.target.value)))} />
              </div>
              <div>
                <Label className="mb-1 block">Groups</Label>
                <Input type="number" min={1} value={groups} onChange={(e) => setGroups(Math.max(1, Number(e.target.value)))} />
              </div>
              <div>
                <Label className="mb-1 block">Separator</Label>
                <Input value={separator} maxLength={2} onChange={(e) => setSeparator(e.target.value || '-')} />
              </div>
              <div>
                <Label className="mb-1 block">Character set</Label>
                <Select value={charset} onValueChange={(v: CodeCharset) => setCharset(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                  <Label className="mb-1 block">Custom characters</Label>
                  <Input value={customCharset} onChange={(e) => setCustomCharset(e.target.value)} placeholder="e.g. ABC123XYZ" />
                </div>
              )}
              <div>
                <Label className="mb-1 block">Case</Label>
                <Select value={caseStyle} onValueChange={(v: CaseStyle) => setCaseStyle(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upper">UPPERCASE</SelectItem>
                    <SelectItem value="lower">lowercase</SelectItem>
                    <SelectItem value="mixed">MiXeD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block">Prefix (optional)</Label>
                <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="e.g. SALE" />
              </div>
              <div>
                <Label className="mb-1 block">Suffix (optional)</Label>
                <Input value={suffix} onChange={(e) => setSuffix(e.target.value)} placeholder="e.g. 2025" />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Sample preview</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {samplePreview.map(code => (
                  <div key={code} className="text-sm font-mono bg-gray-50 border rounded px-2 py-1">{code}</div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => handleGenerate(sampleQuantity)} className="flex items-center gap-2"><Gift className="h-4 w-4"/> Generate</Button>
              <Button variant="outline" onClick={copyCodes} className="flex items-center gap-2"><Copy className="h-4 w-4"/> Copy codes</Button>
              <Button variant="outline" onClick={exportCSV} className="flex items-center gap-2"><Download className="h-4 w-4"/> Export CSV</Button>
              <label className="inline-flex items-center">
                <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files && importCSV(e.target.files[0])} />
                <span className="inline-flex">
                  <Button type="button" variant="outline" className="flex items-center gap-2"><Upload className="h-4 w-4"/> Import CSV</Button>
                </span>
              </label>
              <Button variant="destructive" onClick={handleClear} className="flex items-center gap-2"><Trash2 className="h-4 w-4"/> Clear</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Percent className="h-5 w-5"/> Coupon Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-1 block">Discount type</Label>
              <Select value={discountType} onValueChange={(v: DiscountType) => setDiscountType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
                <Label className="mb-1 block">Value</Label>
                <Input type="number" min={discountType === 'percentage' ? 1 : 0.01} step={discountType === 'percentage' ? 1 : 0.01} value={value} onChange={(e) => setValue(Number(e.target.value))} />
              </div>
            )}
            {discountType === 'fixed' && (
              <div>
                <Label className="mb-1 block">Currency</Label>
                <Select value={currency} onValueChange={(v) => setCurrency(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block">Min spend (optional)</Label>
                <Input type="number" min={0} step={0.01} value={minSpend ?? ''} onChange={(e) => setMinSpend(e.target.value === '' ? undefined : Number(e.target.value))} />
              </div>
              <div>
                <Label className="mb-1 block">Max uses (optional)</Label>
                <Input type="number" min={1} value={maxUses ?? ''} onChange={(e) => setMaxUses(e.target.value === '' ? undefined : Number(e.target.value))} />
              </div>
              <div>
                <Label className="mb-1 block">Per-customer limit (optional)</Label>
                <Input type="number" min={1} value={perCustomerLimit ?? ''} onChange={(e) => setPerCustomerLimit(e.target.value === '' ? undefined : Number(e.target.value))} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block">Start date</Label>
                <Input type="date" value={startDate ?? ''} onChange={(e) => setStartDate(e.target.value || undefined)} />
              </div>
              <div>
                <Label className="mb-1 block">End date</Label>
                <Input type="date" value={endDate ?? ''} onChange={(e) => setEndDate(e.target.value || undefined)} />
              </div>
            </div>
            <div>
              <Label className="mb-1 block">Tags (comma separated)</Label>
              <Input value={tagsCsv} onChange={(e) => setTagsCsv(e.target.value)} placeholder="e.g. spring, vip, email" />
            </div>
            <div>
              <Label className="mb-1 block">Description</Label>
              <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description or terms" />
            </div>
            <div className="flex items-center gap-2">
              <input id="stackable" type="checkbox" checked={isStackable} onChange={(e) => setIsStackable(e.target.checked)} className="h-4 w-4" />
              <Label htmlFor="stackable">Allow stacking with other discounts</Label>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5"/> Generated Coupons ({coupons.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {coupons.length === 0 ? (
              <div className="text-gray-500 text-sm">No coupons yet. Use Generate above.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-2">Code</th>
                      <th className="py-2 pr-2">Type</th>
                      <th className="py-2 pr-2">Value</th>
                      <th className="py-2 pr-2">Limits</th>
                      <th className="py-2 pr-2">Active</th>
                      <th className="py-2 pr-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.map(c => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="py-2 pr-2 font-mono">{c.code}</td>
                        <td className="py-2 pr-2">{c.discountType}</td>
                        <td className="py-2 pr-2">{c.discountType === 'percentage' ? `${c.value}%` : c.discountType === 'fixed' ? `${c.currency} ${c.value.toFixed(2)}` : c.discountType === 'free_shipping' ? '—' : 'BOGO'}</td>
                        <td className="py-2 pr-2 text-gray-600">
                          {c.minSpend ? `Min ${c.minSpend}` : ''} {c.maxUses ? `• Max ${c.maxUses}` : ''} {c.perCustomerLimit ? `• /Cust ${c.perCustomerLimit}` : ''}
                        </td>
                        <td className="py-2 pr-2">{c.isActive ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</td>
                        <td className="py-2 pr-2">
                          <div className="flex gap-2">
                            {c.isActive && (
                              <Button size="sm" variant="outline" onClick={() => deactivateCoupon(c.id)} className="h-8 px-2">Deactivate</Button>
                            )}
                            <Button size="sm" variant="destructive" onClick={() => deleteCoupon(c.id)} className="h-8 px-2">Delete</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CouponGenerator;

