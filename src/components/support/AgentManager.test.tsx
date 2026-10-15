import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AgentManager from './AgentManager';
import * as svc from '@/services/supportService';

vi.mock('@/services/supportService', () => ({ listCompanyMembers: vi.fn(), listAgents: vi.fn(), addAgent: vi.fn(), removeAgent: vi.fn() }));
const view = () => render(<MemoryRouter><AgentManager org="org-A" me="o" /></MemoryRouter>);

describe('AgentManager (sample data)', () => {
  it('owner-only company: shows real count and a Members & roles link, no picker', async () => {
    vi.mocked(svc.listCompanyMembers).mockResolvedValue([{ user_id: 'o', role: 'owner', name: 'Owner' }]);
    vi.mocked(svc.listAgents).mockResolvedValue([]);
    view();
    expect(await screen.findByText(/1 active member \(1 owner\/admin\)/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Members & roles/ }).getAttribute('href')).toBe('/settings?tab=members');
    expect(screen.queryByLabelText('Choose a team member')).toBeNull();
    expect(svc.listCompanyMembers).toHaveBeenCalledWith('org-A');
  });
  it('eligible member: picker shown', async () => {
    vi.mocked(svc.listCompanyMembers).mockResolvedValue([{ user_id: 'o', role: 'owner', name: 'Owner' }, { user_id: 'x', role: 'member', name: 'Sam' }]);
    vi.mocked(svc.listAgents).mockResolvedValue([]);
    view();
    expect(await screen.findByLabelText('Choose a team member')).toBeTruthy();
    expect(screen.getByText(/1 available/)).toBeTruthy();
  });
});
