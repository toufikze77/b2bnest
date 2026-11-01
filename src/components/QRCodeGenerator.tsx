import { useState } from 'react';
import { QrCode, Download, Copy, Check, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  colourWarning, encodeEmail, encodePhone, encodeSms, encodeText, encodeVCard, encodeWhatsApp, encodeWifi, fileBase, normaliseUrl,
  renderError, renderPng, renderSvg, type Built, type QrLevel, type QrSize, type QrType,
} from '@/lib/qrContent';

const TYPES: { value: QrType; label: string }[] = [
  { value: 'url', label: 'URL' }, { value: 'text', label: 'Text' }, { value: 'email', label: 'Email' }, { value: 'phone', label: 'Phone' },
  { value: 'sms', label: 'SMS' }, { value: 'whatsapp', label: 'WhatsApp' }, { value: 'wifi', label: 'Wi-Fi' }, { value: 'vcard', label: 'Contact card' },
];

type Result = { content: string; png: string; svg: string; type: QrType };

/**
 * Phase 29: real QR codes made in the browser with the `qrcode` library (the old version drew random squares that could
 * not be scanned). The same input always gives the same code. Nothing is sent to a server.
 */
const QRCodeGenerator = () => {
  const { toast } = useToast();
  const [type, setType] = useState<QrType>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [email, setEmail] = useState({ to: '', subject: '', body: '' });
  const [phone, setPhone] = useState('');
  const [sms, setSms] = useState({ number: '', message: '' });
  const [whatsapp, setWhatsapp] = useState({ number: '', message: '' });
  const [wifi, setWifi] = useState<{ ssid: string; password: string; security: 'WPA' | 'WEP' | 'nopass'; hidden: boolean }>({ ssid: '', password: '', security: 'WPA', hidden: false });
  const [vcard, setVcard] = useState({ firstName: '', lastName: '', organisation: '', jobTitle: '', phone: '', email: '', website: '', note: '' });

  const [size, setSize] = useState<QrSize>('medium');
  const [level, setLevel] = useState<QrLevel>('M');
  const [dark, setDark] = useState('#000000');
  const [light, setLight] = useState('#ffffff');
  const [margin, setMargin] = useState(4);

  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const warning = colourWarning(dark, light);

  const build = (): Built => {
    switch (type) {
      case 'url': return normaliseUrl(url);
      case 'text': return encodeText(text);
      case 'email': return encodeEmail(email.to, email.subject, email.body);
      case 'phone': return encodePhone(phone);
      case 'sms': return encodeSms(sms.number, sms.message);
      case 'whatsapp': return encodeWhatsApp(whatsapp.number, whatsapp.message);
      case 'wifi': return encodeWifi(wifi.ssid, wifi.password, wifi.security, wifi.hidden);
      case 'vcard': return encodeVCard(vcard);
    }
  };

  const generate = async () => {
    setError(null);
    const built = build();
    if (!built.ok) { setResult(null); setError((built as Extract<Built, { ok: false }>).error); return; }
    setBusy(true);
    try {
      const opts = { level, size, margin, dark, light };
      const [png, svg] = await Promise.all([renderPng(built.value, opts), renderSvg(built.value, opts)]);
      setResult({ content: built.value, png, svg, type });
    } catch (e) {
      setResult(null);
      setError(renderError(e, level));
    } finally {
      setBusy(false);
    }
  };

  const download = (kind: 'png' | 'svg') => {
    if (!result) return;
    const link = document.createElement('a');
    let href = result.png;
    if (kind === 'svg') href = URL.createObjectURL(new Blob([result.svg], { type: 'image/svg+xml' }));
    link.href = href;
    link.download = `${fileBase(result.type)}.${kind}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (kind === 'svg') URL.revokeObjectURL(href);
  };

  const copyContent = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Copied', description: 'The text inside the QR code is on your clipboard.' });
    } catch {
      toast({ title: 'Could not copy', description: 'Your browser blocked the clipboard.', variant: 'destructive' });
    }
  };

  const field = (id: string, label: string, input: JSX.Element) => (
    <div className="space-y-1"><Label htmlFor={id}>{label}</Label>{input}</div>
  );

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">QR Code Generator</h1>
        <p className="text-muted-foreground">Make QR codes for websites, contacts, Wi-Fi and more, ready to print or share.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" aria-hidden="true" /> What the code opens</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs value={type} onValueChange={(v) => { setType(v as QrType); setError(null); }}>
              <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
                {TYPES.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
              </TabsList>
              <TabsContent value="url" className="space-y-3 pt-2">
                {field('qr-url', 'Web address', <Input id="qr-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="example.com" inputMode="url" />)}
                <p className="text-xs text-muted-foreground">https:// is added when it is missing.</p>
              </TabsContent>
              <TabsContent value="text" className="space-y-3 pt-2">
                {field('qr-text', 'Text', <Textarea id="qr-text" rows={4} value={text} onChange={(e) => setText(e.target.value)} />)}
              </TabsContent>
              <TabsContent value="email" className="space-y-3 pt-2">
                {field('qr-email-to', 'Email address', <Input id="qr-email-to" type="email" value={email.to} onChange={(e) => setEmail({ ...email, to: e.target.value })} />)}
                {field('qr-email-subject', 'Subject (optional)', <Input id="qr-email-subject" value={email.subject} onChange={(e) => setEmail({ ...email, subject: e.target.value })} />)}
                {field('qr-email-body', 'Message (optional)', <Textarea id="qr-email-body" rows={3} value={email.body} onChange={(e) => setEmail({ ...email, body: e.target.value })} />)}
              </TabsContent>
              <TabsContent value="phone" className="space-y-3 pt-2">
                {field('qr-phone', 'Phone number', <Input id="qr-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+44 7700 900123" />)}
              </TabsContent>
              <TabsContent value="sms" className="space-y-3 pt-2">
                {field('qr-sms-number', 'Phone number', <Input id="qr-sms-number" type="tel" value={sms.number} onChange={(e) => setSms({ ...sms, number: e.target.value })} placeholder="+44 7700 900123" />)}
                {field('qr-sms-message', 'Message (optional)', <Textarea id="qr-sms-message" rows={3} value={sms.message} onChange={(e) => setSms({ ...sms, message: e.target.value })} />)}
              </TabsContent>
              <TabsContent value="whatsapp" className="space-y-3 pt-2">
                {field('qr-wa-number', 'WhatsApp number (with country code)', <Input id="qr-wa-number" type="tel" value={whatsapp.number} onChange={(e) => setWhatsapp({ ...whatsapp, number: e.target.value })} placeholder="447700900123" />)}
                {field('qr-wa-message', 'Message (optional)', <Textarea id="qr-wa-message" rows={3} value={whatsapp.message} onChange={(e) => setWhatsapp({ ...whatsapp, message: e.target.value })} />)}
              </TabsContent>
              <TabsContent value="wifi" className="space-y-3 pt-2">
                {field('qr-wifi-ssid', 'Network name (SSID)', <Input id="qr-wifi-ssid" value={wifi.ssid} onChange={(e) => setWifi({ ...wifi, ssid: e.target.value })} />)}
                <div className="space-y-1">
                  <Label htmlFor="qr-wifi-security">Security</Label>
                  <Select value={wifi.security} onValueChange={(v) => setWifi({ ...wifi, security: v as 'WPA' | 'WEP' | 'nopass' })}>
                    <SelectTrigger id="qr-wifi-security"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WPA">WPA / WPA2 / WPA3</SelectItem>
                      <SelectItem value="WEP">WEP</SelectItem>
                      <SelectItem value="nopass">No password</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {wifi.security !== 'nopass' && field('qr-wifi-password', 'Password', <Input id="qr-wifi-password" value={wifi.password} onChange={(e) => setWifi({ ...wifi, password: e.target.value })} />)}
                <div className="flex items-center gap-2">
                  <input id="qr-wifi-hidden" type="checkbox" checked={wifi.hidden} onChange={(e) => setWifi({ ...wifi, hidden: e.target.checked })}
                    className="h-4 w-4 rounded focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring" />
                  <Label htmlFor="qr-wifi-hidden">Hidden network</Label>
                </div>
              </TabsContent>
              <TabsContent value="vcard" className="space-y-3 pt-2">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {field('qr-vc-first', 'First name', <Input id="qr-vc-first" value={vcard.firstName} onChange={(e) => setVcard({ ...vcard, firstName: e.target.value })} />)}
                  {field('qr-vc-last', 'Last name', <Input id="qr-vc-last" value={vcard.lastName} onChange={(e) => setVcard({ ...vcard, lastName: e.target.value })} />)}
                  {field('qr-vc-org', 'Company (optional)', <Input id="qr-vc-org" value={vcard.organisation} onChange={(e) => setVcard({ ...vcard, organisation: e.target.value })} />)}
                  {field('qr-vc-title', 'Job title (optional)', <Input id="qr-vc-title" value={vcard.jobTitle} onChange={(e) => setVcard({ ...vcard, jobTitle: e.target.value })} />)}
                  {field('qr-vc-phone', 'Phone (optional)', <Input id="qr-vc-phone" type="tel" value={vcard.phone} onChange={(e) => setVcard({ ...vcard, phone: e.target.value })} />)}
                  {field('qr-vc-email', 'Email (optional)', <Input id="qr-vc-email" type="email" value={vcard.email} onChange={(e) => setVcard({ ...vcard, email: e.target.value })} />)}
                  {field('qr-vc-web', 'Website (optional)', <Input id="qr-vc-web" value={vcard.website} onChange={(e) => setVcard({ ...vcard, website: e.target.value })} />)}
                  {field('qr-vc-note', 'Note (optional)', <Input id="qr-vc-note" value={vcard.note} onChange={(e) => setVcard({ ...vcard, note: e.target.value })} />)}
                </div>
              </TabsContent>
            </Tabs>

            <fieldset className="space-y-3 rounded-md border border-border p-4">
              <legend className="px-1 text-sm font-medium">Options</legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="qr-size">Size</Label>
                  <Select value={size} onValueChange={(v) => setSize(v as QrSize)}>
                    <SelectTrigger id="qr-size"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small (200 px)</SelectItem>
                      <SelectItem value="medium">Medium (300 px)</SelectItem>
                      <SelectItem value="large">Large (500 px)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="qr-level">Error correction</Label>
                  <Select value={level} onValueChange={(v) => setLevel(v as QrLevel)}>
                    <SelectTrigger id="qr-level"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="L">L: holds the most content</SelectItem>
                      <SelectItem value="M">M: standard (recommended)</SelectItem>
                      <SelectItem value="Q">Q: more robust</SelectItem>
                      <SelectItem value="H">H: most robust (logos, print)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {field('qr-dark', 'Code colour', <Input id="qr-dark" type="color" value={dark} onChange={(e) => setDark(e.target.value)} className="h-10 p-1" />)}
                {field('qr-light', 'Background colour', <Input id="qr-light" type="color" value={light} onChange={(e) => setLight(e.target.value)} className="h-10 p-1" />)}
                {field('qr-margin', 'Quiet border (modules)', <Input id="qr-margin" type="number" min={0} max={10} value={margin} onChange={(e) => setMargin(Math.min(10, Math.max(0, Number(e.target.value) || 0)))} />)}
              </div>
              {warning && <p role="alert" className="flex items-start gap-2 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{warning}</p>}
            </fieldset>

            {error && <p role="alert" data-testid="qr-error" className="text-sm text-destructive">{error}</p>}
            <Button onClick={generate} disabled={busy} className="w-full">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <QrCode className="mr-2 h-4 w-4" aria-hidden="true" />}
              Generate QR code
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your QR code</CardTitle>
            <CardDescription>Made in your browser. Nothing is sent to a server.</CardDescription>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-4 text-center">
                <img src={result.png} alt={`QR code for: ${result.content}`} className="mx-auto max-w-full rounded-lg border border-border" data-testid="qr-preview" />
                <p className="break-all rounded bg-muted p-2 text-left font-mono text-xs" data-testid="qr-content">{result.content}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => download('png')}><Download className="mr-2 h-4 w-4" aria-hidden="true" />Download PNG</Button>
                  <Button variant="outline" onClick={() => download('svg')}><Download className="mr-2 h-4 w-4" aria-hidden="true" />Download SVG</Button>
                  <Button variant="outline" onClick={copyContent}>
                    {copied ? <Check className="mr-2 h-4 w-4" aria-hidden="true" /> : <Copy className="mr-2 h-4 w-4" aria-hidden="true" />}Copy text
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex aspect-square max-h-72 w-full items-center justify-center rounded-lg border-2 border-dashed border-border text-center text-muted-foreground">
                <div><QrCode className="mx-auto mb-2 h-12 w-12" aria-hidden="true" /><p>Fill in the details and press Generate.</p></div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default QRCodeGenerator;
