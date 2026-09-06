import { Building2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useActiveOrganization } from '@/contexts/OrganizationContext';

const OrganizationSwitcher = () => {
  const { memberships, organizationId, setActiveOrganization, loading } = useActiveOrganization();

  if (loading || memberships.length < 2 || !organizationId) return null;

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <Select value={organizationId} onValueChange={setActiveOrganization}>
        <SelectTrigger className="w-[180px]" aria-label="Active company">
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
