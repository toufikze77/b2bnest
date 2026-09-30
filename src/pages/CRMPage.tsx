import CRM from '@/components/CRM';
import { PageHeader } from '@/components/ui/page-header';
import { PageContainer } from '@/components/ui/page-container';
import { useActiveOrganization } from '@/contexts/OrganizationContext';

const CRMPage = () => {
  const { organization } = useActiveOrganization();

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[{ label: organization?.name || 'Company', to: '/dashboard' }, { label: 'Customers' }, { label: 'CRM' }]}
        title="CRM"
        description="Manage contacts, opportunities and the next action for each relationship."
      />
      <CRM />
    </PageContainer>
  );
};

export default CRMPage;
