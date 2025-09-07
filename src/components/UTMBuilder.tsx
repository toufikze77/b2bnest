import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Link2, Copy, Check } from 'lucide-react';

const UTMBuilder = () => {
  const [baseUrl, setBaseUrl] = useState<string>('https://example.com/landing');
  const [source, setSource] = useState<string>('newsletter');
  const [medium, setMedium] = useState<string>('email');
  const [campaign, setCampaign] = useState<string>('spring_sale');
  const [term, setTerm] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const builtUrl = useMemo(() => {
    const url = new URL(baseUrl, baseUrl.startsWith('http') ? undefined : 'https://');
    if (source) url.searchParams.set('utm_source', source);
    if (medium) url.searchParams.set('utm_medium', medium);
    if (campaign) url.searchParams.set('utm_campaign', campaign);
    if (term) url.searchParams.set('utm_term', term);
    if (content) url.searchParams.set('utm_content', content);
    return url.toString();
  }, [baseUrl, source, medium, campaign, term, content]);

  const copy = async () => {
    await navigator.clipboard.writeText(builtUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2"><Link2 className="h-6 w-6"/> UTM Builder</h1>
        <div className="flex gap-2 flex-wrap">
          <Badge>Campaign links</Badge>
          <Badge variant="secondary">Copy & share</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Parameters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label className="mb-1 block">Base URL</Label>
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block">utm_source</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block">utm_medium</Label>
            <Input value={medium} onChange={(e) => setMedium(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block">utm_campaign</Label>
            <Input value={campaign} onChange={(e) => setCampaign(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block">utm_term</Label>
            <Input value={term} onChange={(e) => setTerm(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block">utm_content</Label>
            <Input value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1 block">Result</Label>
            <div className="border rounded p-3 font-mono text-sm bg-gray-50 break-all">{builtUrl}</div>
            <div className="mt-2">
              <Button variant="outline" onClick={copy} className="flex items-center gap-2">{copied ? <Check className="h-4 w-4"/> : <Copy className="h-4 w-4"/>} Copy</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UTMBuilder;

