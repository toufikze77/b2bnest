import ProjectManagement from '@/components/ProjectManagement';
import { PageHeader } from '@/components/ui/page-header';
import { PageContainer } from '@/components/ui/page-container';
import { useActiveOrganization } from '@/contexts/OrganizationContext';

const ProjectManagementPage = () => {
  const { organization } = useActiveOrganization();

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[{ label: organization?.name || 'Company', to: '/dashboard' }, { label: 'Work' }, { label: 'Projects and tasks' }]}
        title="Projects and tasks"
        description="Plan work, track delivery, and keep company deadlines in one place."
      />
      <ProjectManagement />
    </PageContainer>
  );
};

export default ProjectManagementPage;
