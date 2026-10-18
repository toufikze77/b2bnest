import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TabbedPageHeader, tabStripListClass, tabStripTriggerClass } from './tabbed-page-header';

function Page({ onTab }: { onTab: (v: string) => void }) {
  return (
    <MemoryRouter>
      <Tabs value="one" onValueChange={onTab}>
        <TabbedPageHeader
          breadcrumbs={[{ label: 'Acme', to: '/dashboard' }, { label: 'Things' }]}
          title="Things"
          description="One line about things."
          actions={<button type="button">New thing</button>}
          tabs={<TabsList aria-label="Thing sections" className={tabStripListClass}>
            <TabsTrigger value="one" className={tabStripTriggerClass}>One</TabsTrigger>
            <TabsTrigger value="two" className={tabStripTriggerClass}>Two</TabsTrigger>
          </TabsList>}
        />
      </Tabs>
    </MemoryRouter>
  );
}

describe('TabbedPageHeader', () => {
  it('renders breadcrumb, one h1, description, actions and the tab strip', () => {
    render(<Page onTab={() => {}} />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Things' })).toHaveClass('text-page-title');
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByRole('link', { name: 'Acme' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByText('One line about things.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New thing' })).toBeInTheDocument();
    expect(within(screen.getByRole('tablist', { name: 'Thing sections' })).getAllByRole('tab').map((t) => t.textContent)).toEqual(['One', 'Two']);
  });

  it('navy is on the tab strip only, never on the title area', () => {
    render(<Page onTab={() => {}} />);
    const navy = document.querySelectorAll('.bg-brand-navy');
    expect(navy).toHaveLength(1);
    expect(navy[0]).toContainElement(screen.getByRole('tablist'));
    for (const el of [screen.getByRole('heading', { level: 1 }), screen.getByRole('navigation', { name: 'Breadcrumb' }), screen.getByRole('button', { name: 'New thing' }), screen.getByText('One line about things.')]) {
      expect(navy[0]).not.toContainElement(el);
    }
  });

  it('the strip sits inside the content container (same box as the title), not full-bleed, rounded like a card', () => {
    render(<Page onTab={() => {}} />);
    const strip = document.querySelector('[data-tab-strip]') as HTMLElement;
    const container = strip.parentElement as HTMLElement;
    // One container holds the title area and the strip: same max width and gutters as the page body.
    expect(container).toContainElement(screen.getByRole('heading', { level: 1 }));
    for (const c of ['mx-auto', 'max-w-[1440px]', 'px-4', 'sm:px-6', 'lg:px-8']) expect(container).toHaveClass(c);
    // The strip itself adds no width tricks and no own centring box.
    for (const c of ['w-screen', '-mx-4', '-mx-6', '-mx-8', 'max-w-[1440px]']) expect(strip).not.toHaveClass(c);
    expect(strip.querySelector('.max-w-\\[1440px\\]')).toBeNull();
    expect(strip).toHaveClass('rounded-card', 'overflow-hidden', 'bg-brand-navy');
    expect(strip).toContainElement(screen.getByRole('tablist'));
  });

  it('owns no tab state: the page’s own Tabs handler gets the change', () => {
    const onTab = vi.fn();
    render(<Page onTab={onTab} />);
    const two = screen.getByRole('tab', { name: 'Two' });
    fireEvent.mouseDown(two); fireEvent.click(two);
    expect(onTab).toHaveBeenCalledWith('two');
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('data-state', 'active'); // controlled by the page
  });

  it('without tabs, renders no strip', () => {
    render(<MemoryRouter><TabbedPageHeader title="Plain" /></MemoryRouter>);
    expect(document.querySelector('.bg-brand-navy')).toBeNull();
  });
});
