// Phase 29: the one back control on Business Tools pages never leaves the website.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }));

import PageBackBar from './PageBackBar';

const show = (props: Partial<Parameters<typeof PageBackBar>[0]> = {}) =>
  render(<MemoryRouter><PageBackBar title="Time Tracker" {...props} /></MemoryRouter>);

describe('PageBackBar', () => {
  beforeEach(() => { navigate.mockReset(); window.history.replaceState(null, ''); });

  it('goes back one step when the app has history behind this page (history.state.idx > 0)', () => {
    window.history.replaceState({ idx: 2, key: 'k' }, '');
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(navigate).toHaveBeenCalledWith(-1);
  });

  it('goes to the fallback when there is no app history (opened by link / new tab), never out of the site', () => {
    window.history.replaceState({ idx: 0, key: 'k' }, '');
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(navigate).toHaveBeenCalledWith('/business-tools');
    navigate.mockReset();
    window.history.replaceState(null, '');
    show({ fallbackTo: '/lead-generation/forms' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Go back' })[1]);
    expect(navigate).toHaveBeenCalledWith('/lead-generation/forms');
  });

  it('renders the breadcrumb (Business tools › Time Tracker) and an accessible, visible "Back"', () => {
    show();
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(crumbs).toHaveTextContent('Business tools');
    expect(crumbs).toHaveTextContent('Time Tracker');
    expect(screen.getByRole('link', { name: 'Business tools' })).toHaveAttribute('href', '/business-tools');
    expect(screen.getByText('Time Tracker')).toHaveAttribute('aria-current', 'page');
    const back = screen.getByRole('button', { name: 'Go back' });
    expect(back).toHaveTextContent('Back');
  });

  it('custom crumbs', () => {
    show({ crumbs: [{ label: 'Money' }, { label: 'Business tools', to: '/business-tools' }] });
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent('Money');
  });
});
