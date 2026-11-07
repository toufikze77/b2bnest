// The logo on the Create invoice/quote form: the uploader finds the signed-in user itself, a new document reuses the
// latest logo_url, and a failed save keeps the form. Supabase is mocked: nothing is uploaded, written or emailed.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const st = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  uploads: [] as { bucket: string; path: string }[],
  logos: { invoices: [] as Record<string, unknown>[], quotes: [] as Record<string, unknown>[] },
  failSave: false,
  writes: 0,
}));
const toasts = vi.hoisted(() => ({ ui: vi.fn(), form: vi.fn() }));
vi.mock('@/components/ui/use-toast', () => ({ toast: toasts.ui }));
vi.mock('@/hooks/use-toast', () => ({ toast: toasts.form }));
// A stable user object, as in the app (a new object each render would reload products forever).
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: st.user }), useSignedInUser: () => st.user }));
vi.mock('@/hooks/useUserSettings', () => ({ useUserSettings: () => ({ settings: { currency_code: 'GBP' } }) }));
vi.mock('@/integrations/supabase/client', () => {
  const rowsFor = (table: string) => (table === 'invoices' || table === 'quotes' ? st.logos[table] : []);
  const list = (table: string) => {
    const result = Promise.resolve({ data: rowsFor(table), error: null });
    const chain: Record<string, unknown> = { limit: () => result, then: (a: (v: unknown) => unknown, b?: (e: unknown) => unknown) => result.then(a, b) };
    chain.order = () => chain;
    chain.eq = () => chain;
    return chain;
  };
  const done = (payload: Record<string, unknown>) => {
    st.writes += 1;
    const single = async () => (st.failSave ? { data: null, error: { code: '500', message: 'boom' } } : { data: { id: 'new', ...payload }, error: null });
    return { select: () => ({ single }), eq: () => ({ select: () => ({ single }) }) };
  };
  return {
    supabase: {
      from: (table: string) => ({
        select: () => list(table),
        insert: (rows: Record<string, unknown>[]) => done(rows[0]),
        update: (row: Record<string, unknown>) => done(row),
      }),
      storage: {
        from: (bucket: string) => ({
          upload: async (path: string) => { st.uploads.push({ bucket, path }); return { data: { path }, error: null }; },
          getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${bucket}/${path}` } }),
        }),
      },
    },
  };
});

import ImageUpload from './ImageUpload';
import QuoteInvoiceCreationSection from './QuoteInvoiceCreationSection';

beforeEach(() => {
  st.user = { id: 'u1' };
  st.uploads.length = 0;
  st.logos = { invoices: [], quotes: [] };
  st.failSave = false;
  st.writes = 0;
  toasts.ui.mockClear();
  toasts.form.mockClear();
});

const pick = (container: HTMLElement) => {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(['x'], 'logo.png', { type: 'image/png' })] } });
};
const signedOutToast = () => toasts.ui.mock.calls.some(([t]) => t?.description === 'You must be logged in to upload images.');

describe('ImageUpload', () => {
  it('uploads to the signed-in user\'s folder when no userId prop is given', async () => {
    const done = vi.fn();
    const { container } = render(<ImageUpload bucket="user-avatars" onImageUploaded={done} />);
    pick(container);
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(st.uploads).toHaveLength(1);
    expect(st.uploads[0].bucket).toBe('user-avatars');
    expect(st.uploads[0].path).toMatch(/^u1\/\d+\.png$/);
    expect(done.mock.calls[0][0]).toMatch(/^https:\/\/cdn\.test\/user-avatars\/u1\//);
    expect(signedOutToast()).toBe(false);
  });

  it('a userId prop still wins (AccountSettings passes one)', async () => {
    const done = vi.fn();
    const { container } = render(<ImageUpload bucket="user-avatars" userId="u-prop" onImageUploaded={done} />);
    pick(container);
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(st.uploads[0].path).toMatch(/^u-prop\/\d+\.png$/);
  });

  it('says "You must be logged in" only when nobody is signed in, and uploads nothing', async () => {
    st.user = null;
    const done = vi.fn();
    const { container } = render(<ImageUpload bucket="user-avatars" onImageUploaded={done} />);
    pick(container);
    await waitFor(() => expect(signedOutToast()).toBe(true));
    expect(st.uploads).toHaveLength(0);
    expect(done).not.toHaveBeenCalled();
  });
});

describe('Create form: logo prefill', () => {
  it('a new document uses the newest logo_url across invoices and quotes; Remove clears it', async () => {
    st.logos.invoices = [
      { logo_url: null, created_at: '2026-11-05T10:00:00Z' },
      { logo_url: 'https://cdn.test/inv-old.png', created_at: '2026-10-01T10:00:00Z' },
    ];
    st.logos.quotes = [{ logo_url: 'https://cdn.test/quote-new.png', created_at: '2026-11-01T10:00:00Z' }];
    render(<QuoteInvoiceCreationSection documentType="invoice" onDocumentSaved={vi.fn()} />);
    const note = await screen.findByTestId('logo-suggested');
    expect(note).toHaveTextContent('Using the logo from your latest invoice or quote.');
    expect(screen.getByAltText('Company logo used on your quotes and invoices')).toHaveAttribute('src', 'https://cdn.test/quote-new.png');
    expect(screen.getByRole('button', { name: 'Use a different logo' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.queryByTestId('logo-suggested')).toBeNull();
    expect(screen.queryByAltText('Company logo used on your quotes and invoices')).toBeNull();
    expect(st.writes).toBe(0); // nothing written to the database
  });

  it('no earlier logo: no suggestion; editing a document keeps its own logo', async () => {
    const view = render(<QuoteInvoiceCreationSection documentType="quote" onDocumentSaved={vi.fn()} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('logo-suggested')).toBeNull();
    view.unmount();
    st.logos.invoices = [{ logo_url: 'https://cdn.test/latest.png', created_at: '2026-11-05T10:00:00Z' }];
    const doc = { id: 'i1', invoice_number: 'INV-1', client_name: 'Acme', items: [], currency: 'GBP', status: 'draft', logo_url: 'https://cdn.test/own.png' };
    render(<QuoteInvoiceCreationSection documentType="invoice" onDocumentSaved={vi.fn()} editingDocument={doc} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('logo-suggested')).toBeNull();
    expect(screen.getByAltText('Company logo used on your quotes and invoices')).toHaveAttribute('src', 'https://cdn.test/own.png');
  });
});

describe('Create form: saving', () => {
  const fill = () => {
    fireEvent.change(screen.getByLabelText('Client Name *'), { target: { value: 'Acme Ltd' } });
    fireEvent.change(screen.getAllByLabelText('Description *')[0], { target: { value: 'Consulting' } });
    fireEvent.change(screen.getAllByLabelText('Rate')[0], { target: { value: '100' } });
  };

  it('a failed save stays on the form with the values kept', async () => {
    st.failSave = true;
    const saved = vi.fn();
    render(<QuoteInvoiceCreationSection documentType="invoice" onDocumentSaved={saved} />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: /Save as Draft/ }));
    await waitFor(() => expect(toasts.form).toHaveBeenCalledWith(expect.objectContaining({ description: 'Failed to save document' })));
    expect(saved).not.toHaveBeenCalled();
    expect((screen.getByLabelText('Client Name *') as HTMLInputElement).value).toBe('Acme Ltd');
    expect((screen.getAllByLabelText('Description *')[0] as HTMLInputElement).value).toBe('Consulting');
  });

  it('a successful save shows one success message, from the form', async () => {
    const saved = vi.fn();
    render(<QuoteInvoiceCreationSection documentType="invoice" onDocumentSaved={saved} />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: /Save as Draft/ }));
    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    const success = toasts.form.mock.calls.filter(([t]) => t?.title === 'Success');
    expect(success).toHaveLength(1);
    expect(success[0][0].description).toBe('Invoice created as draft.');
  });
});
