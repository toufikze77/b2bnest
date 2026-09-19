import React from 'react';
import ProjectManagement from '@/components/ProjectManagement';
import { PageHeader } from '@/components/ui/page-header';
import { useActiveOrganization } from '@/contexts/OrganizationContext';

const ProjectManagementPage = () => {
  const { organization } = useActiveOrganization();

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader eyebrow={`Work / ${organization?.name || 'Company'}`} title="Projects and tasks" description="Plan work, track delivery, and keep company deadlines in one place." />
        <ProjectManagement />
      </div>
    </div>
  );
};

export default ProjectManagementPage;