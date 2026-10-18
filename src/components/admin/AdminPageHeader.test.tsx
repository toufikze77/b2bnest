import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import AdminPageHeader from './AdminPageHeader';

const at = (path: string, ui: React.ReactNode) => render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);

describe('AdminPageHeader (wraps the shared PageHeader)', () => {
  it('keeps its props: title, description and actions', () => {
    at('/admin/users', <AdminPageHeader title="User Management" description="All users" actions={<button type="button">Export</button>} />);
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('heading', { level: 1, name: 'User Management' })).toHaveClass('text-page-title');
    expect(within(header).getByText('All users')).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('adds an Admin breadcrumb linking to the admin home', () => {
    at('/admin/users', <AdminPageHeader title="User Management" />);
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin');
    expect(within(crumbs).getByText('User Management')).toBeInTheDocument();
  });

  it('on the admin home the breadcrumb is just "Admin", not a link to itself', () => {
    at('/admin', <AdminPageHeader title="Platform Overview" />);
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(crumbs.querySelector('a')).toBeNull();
    expect(within(crumbs).getByText('Admin')).toHaveAttribute('aria-current', 'page');
  });

  it('a page can pass its own breadcrumbs', () => {
    at('/admin/companies/1', <AdminPageHeader title="Acme" breadcrumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Companies', to: '/admin/companies' }, { label: 'Acme' }]} />);
    expect(screen.getByRole('link', { name: 'Companies' })).toHaveAttribute('href', '/admin/companies');
  });
});
