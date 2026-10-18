import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RichTextEditor } from './RichTextEditor';

const ui = '<span class="ql-ui" contenteditable="false"></span>';
const STORED = `<p>Shopping</p><ol><li data-list="ordered">${ui}First</li><li data-list="ordered">${ui}Second</li></ol>` +
  `<ol><li data-list="bullet">${ui}Apples</li><li data-list="bullet" class="ql-indent-1">${ui}Nested</li></ol>`;

describe('RichTextEditor (Quill 2)', () => {
  it('opens a saved note with its content, list types and indent levels (it used to open blank)', async () => {
    const onChange = vi.fn();
    const { container } = render(<RichTextEditor value={STORED} onChange={onChange} />);
    await waitFor(() => expect(container.querySelector('.ql-editor')!.textContent).toContain('Apples'));
    const items = Array.from(container.querySelectorAll('.ql-editor li')).map((li) => [li.textContent, li.getAttribute('data-list'), li.className]);
    expect(items).toEqual([['First', 'ordered', ''], ['Second', 'ordered', ''], ['Apples', 'bullet', ''], ['Nested', 'bullet', 'ql-indent-1']]);
    // Loading is silent: it must not report a change that could overwrite the note.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('a new value from outside (another note) replaces the content', async () => {
    const { container, rerender } = render(<RichTextEditor value="<p>One</p>" onChange={() => {}} />);
    await waitFor(() => expect(container.querySelector('.ql-editor')!.textContent).toBe('One'));
    rerender(<RichTextEditor value="<p>Two</p>" onChange={() => {}} />);
    await waitFor(() => expect(container.querySelector('.ql-editor')!.textContent).toBe('Two'));
  });

  it('editing reports the whole note, not only the new text', async () => {
    const onChange = vi.fn();
    const { container } = render(<RichTextEditor value={STORED} onChange={onChange} />);
    await waitFor(() => expect(container.querySelector('.ql-editor')!.textContent).toContain('Apples'));
    const Quill = (await import('quill')).default;
    const quill = Quill.find(container.querySelector('.ql-container')!) as { insertText: (i: number, t: string, s: string) => void };
    await act(async () => { quill.insertText(0, 'My ', 'user'); });
    const html = onChange.mock.calls.at(-1)![0] as string;
    expect(html).toContain('My Shopping');
    expect(html).toContain('data-list="bullet"');
    expect(html).toContain('Apples');
  });

  it('offers both list buttons and the indent buttons', () => {
    const { container } = render(<RichTextEditor value="" onChange={() => {}} />);
    expect(container.querySelector('button.ql-list[value="ordered"]')).not.toBeNull();
    expect(container.querySelector('button.ql-list[value="bullet"]')).not.toBeNull();
    expect(container.querySelector('button.ql-indent[value="+1"]')).not.toBeNull();
    expect(container.querySelector('button.ql-indent[value="-1"]')).not.toBeNull();
  });
});
