import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, CalendarDays, Megaphone, Info } from 'lucide-react';
import { filterAudience, type AudienceContact, type AudienceFilter } from '@/lib/marketingAudience';

/**
 * Marketing planning workspace. Planning only: nothing here sends email, SMS or social posts.
 * Audiences are computed live from the signed-in user's own CRM contacts (existing access rules).
 */
const MarketingTab = ({ contacts }: { contacts: (AudienceContact & { id: string; name: string; company?: string | null })[] }) => {
  const [f, setF] = useState<AudienceFilter>({ status: 'all', source: 'all', reach: 'any' });
  const sources = useMemo(() => Array.from(new Set(contacts.map((c) => c.source).filter(Boolean) as string[])).sort(), [contacts]);
  const audience = useMemo(() => filterAudience(contacts, f), [contacts, f]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            Marketing is for planning. It never sends email, SMS or social posts, and it shows no opens, clicks or replies,
            because none are recorded. Your contacts stay private to you.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Users className="h-5 w-5" /> Audience builder</CardTitle>
          <CardDescription>Filter your own CRM contacts to plan who a campaign is for.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Select value={f.status} onValueChange={(status) => setF({ ...f, status })}>
              <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="lead">Leads</SelectItem>
                <SelectItem value="prospect">Prospects</SelectItem>
                <SelectItem value="customer">Customers</SelectItem>
              </SelectContent>
            </Select>
            <Select value={f.source} onValueChange={(source) => setF({ ...f, source })}>
              <SelectTrigger aria-label="Source"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {sources.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={f.reach} onValueChange={(reach) => setF({ ...f, reach: reach as AudienceFilter['reach'] })}>
              <SelectTrigger aria-label="Reachable by"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any contact details</SelectItem>
                <SelectItem value="email">Has an email address</SelectItem>
                <SelectItem value="linkedin">Has a LinkedIn profile</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm"><span className="text-2xl font-semibold">{audience.length}</span> of {contacts.length} contacts match.</p>
          <p className="text-xs text-muted-foreground">"Has an email address" means a correctly formatted address. It does not mean the address is verified or that the person has agreed to marketing.</p>
          {audience.length > 0 && (
            <ul className="divide-y rounded-md border text-sm">
              {audience.slice(0, 8).map((c) => (
                <li key={c.id} className="flex justify-between gap-2 px-3 py-2">
                  <span className="truncate font-medium">{c.name}</span>
                  <span className="truncate text-muted-foreground">{c.company || '—'}</span>
                </li>
              ))}
              {audience.length > 8 && <li className="px-3 py-2 text-muted-foreground">+ {audience.length - 8} more</li>}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Megaphone className="h-5 w-5" /> Campaign drafts</CardTitle>
            <CardDescription>Coming soon: name, objective, channel, content, status, dates and chosen contacts.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Saving campaign drafts isn't switched on yet. For now, plan the work as tasks.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><CalendarDays className="h-5 w-5" /> Content plan and follow-ups</CardTitle>
            <CardDescription>Use your existing tasks and calendar to plan content and follow-ups.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline"><Link to="/project-management">Open tasks and calendar</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MarketingTab;
