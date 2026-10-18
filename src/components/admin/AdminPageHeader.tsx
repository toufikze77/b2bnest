import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Crumb, PageHeader } from '@/components/ui/page-header';

/**
 * Admin page header: the app's shared PageHeader (same title size, breadcrumb, description, action placement and
 * spacing as every other page), with an "Admin" breadcrumb. Pages can pass their own breadcrumbs (e.g. a detail page).
 */
export default function AdminPageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
}) {
  const { pathname } = useLocation();
  const onAdminHome = pathname === '/admin' || pathname === '/admin/';
  const crumbs = breadcrumbs ?? (onAdminHome ? [{ label: 'Admin' }] : [{ label: 'Admin', to: '/admin' }, { label: title }]);
  return <PageHeader breadcrumbs={crumbs} title={title} description={description} actions={actions} />;
}
