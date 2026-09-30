import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { getTemplateKind, getTemplateAvailability } from './templateKind';
import { BUILT_IN_TEMPLATES } from '@/data/workspaceTemplates';
import TemplateCard from '@/components/template-centre/TemplateCard';
import { assignableRoles } from '@/components/settings/CompanyMembers';

const bySlug = (s: string) => BUILT_IN_TEMPLATES.find((t) => t.slug === s)!;

describe('template kind', () => {
  it('explicit kind wins, so a one-board workspace is a workspace', () => {
    const one = { ...bySlug('simple-project'), kind: 'workspace' as const };
    expect(one.boards).toHaveLength(1);
    expect(getTemplateKind(one)).toBe('workspace');
  });
  it('multi-board and CRM templates are workspaces; project templates are projects', () => {
    expect(getTemplateKind(bySlug('client-projects'))).toBe('workspace');
    expect(getTemplateKind(bySlug('ai-powered-crm'))).toBe('workspace');
    expect(getTemplateKind(bySlug('simple-project'))).toBe('project');
  });
});

describe('template availability', () => {
  it('marks unbuilt dashboard/automation/AI templates and empty templates unavailable', () => {
    expect(getTemplateAvailability(bySlug('kpi-tracking')).available).toBe(false);
    expect(getTemplateAvailability(bySlug('ai-sales-assistant')).available).toBe(false);
    expect(getTemplateAvailability({ ...bySlug('simple-project'), boards: [] }).available).toBe(false);
    expect(getTemplateAvailability(bySlug('simple-project')).available).toBe(true);
  });
  it('the catalogue card disables Use for unavailable templates', () => {
    const onUse = vi.fn();
    render(<TemplateCard template={bySlug('kpi-tracking')} hasPremiumAccess onPreview={() => {}} onUse={onUse} />);
    const btn = screen.getByRole('button', { name: /not available yet/i });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onUse).not.toHaveBeenCalled();
    expect(screen.getByText('Not available yet')).toBeInTheDocument();
  });
  it('the card labels a project template before creation', () => {
    render(<TemplateCard template={bySlug('simple-project')} hasPremiumAccess onPreview={() => {}} onUse={() => {}} />);
    expect(screen.getAllByText(/Project template/).length).toBeGreaterThan(0);
  });
});

describe('company role assignment (mirrors RLS)', () => {
  const m = (role: string, user_id = 'x') => ({ id: '1', user_id, role, name: 'A' });
  it('members cannot assign; admins cannot touch owners; nobody edits themselves', () => {
    expect(assignableRoles('member', m('member'), 'me')).toEqual([]);
    expect(assignableRoles('admin', m('owner'), 'me')).toEqual([]);
    expect(assignableRoles('admin', m('member'), 'me')).not.toContain('owner');
    expect(assignableRoles('owner', m('admin'), 'me')).toContain('owner');
    expect(assignableRoles('owner', m('owner', 'me'), 'me')).toEqual([]);
  });
});
