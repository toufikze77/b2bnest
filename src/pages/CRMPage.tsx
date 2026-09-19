import React from 'react';
import CRM from '@/components/CRM';
import { PageHeader } from '@/components/ui/page-header';
import { useActiveOrganization } from '@/contexts/OrganizationContext';

const CRMPage = () => {
  const { organization } = useActiveOrganization();

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader eyebrow={`Customers / ${organization?.name || 'Company'}`} title="CRM" description="Manage contacts, opportunities and the next action for each relationship." />
        <CRM />
      </div>
    </div>
  );
};

export default CRMPage;