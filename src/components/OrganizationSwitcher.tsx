import { Building2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useActiveOrganization } from '@/contexts/OrganizationContext';

const OrganizationSwitcher = () => {
  const { memberships, organizationId, organization, setActiveOrganization, loading } = useActiveOrganization();

  if (loading) {
    return <div className="h-10 w-44 animate-pulse rounded-md bg-muted" aria-label="Loading active company" />;
  }

  if (memberships.length === 0) {
    return (
      <div className="flex h-10 min-w-0 max-w-52 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">No company yet</span>
      </div>
    );
  }

  if (memberships.length === 1 && organization) {
    return (
      <div className="flex h-10 min-w-0 max-w-56 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground shadow-xs">
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">{organization.name}</span>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Building2 className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
      <Select value={organizationId ?? undefined} onValueChange={setActiveOrganization}>
        <SelectTrigger className="h-10 w-[190px] max-w-[42vw] bg-surface shadow-xs" aria-label="Active company">
          <SelectValue placeholder="Choose a company" />
        </SelectTrigger>
        <SelectContent>
          {memberships.map((m) => (
            <SelectItem key={m.organizationId} value={m.organizationId}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default OrganizationSwitcher;
