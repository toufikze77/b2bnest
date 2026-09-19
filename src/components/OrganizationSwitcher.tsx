import { Building2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useActiveOrganization } from '@/contexts/OrganizationContext';

const OrganizationSwitcher = () => {
  const { memberships, organizationId, organization, setActiveOrganization, loading } = useActiveOrganization();

  if (loading) {
    return <div className="h-9 w-40 animate-pulse rounded-md bg-muted" aria-label="Loading active company" />;
  }

  if (!organizationId || !organization) {
    return (
      <div className="flex h-9 items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 text-sm text-destructive">
        <Building2 className="h-4 w-4" aria-hidden="true" />
        <span>No company selected</span>
      </div>
    );
  }

  if (memberships.length < 2) {
    return (
      <div className="flex h-9 max-w-52 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground">
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">{organization.name}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <Select value={organizationId} onValueChange={setActiveOrganization}>
        <SelectTrigger className="w-[180px] max-w-[45vw]" aria-label="Active company">
          <SelectValue />
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
