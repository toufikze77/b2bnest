import fs from 'node:fs';
import path from 'node:path';
import DOMPurify from 'dompurify';
import { beforeAll, describe, expect, it } from 'vitest';
import { renderNoteHtml } from './noteHtml';

// Exactly what the editor (react-quill on Quill 2.0.3) saved in the browser for: a numbered list, a dotted list,
// and a nested mix (indent levels 0-2). Production notes have this same shape (data-list + ql-ui spans).
const ui = '<span class="ql-ui" contenteditable="false"></span>';
export const STORED_QUILL2 =
  `<p>Numbered list:</p><ol><li data-list="ordered">${ui}First</li><li data-list="ordered">${ui}Second</li><li data-list="ordered">${ui}Third</li></ol>` +
  `<p>Dotted list:</p><ol><li data-list="bullet">${ui}Apples</li><li data-list="bullet">${ui}Pears</li><li data-list="bullet">${ui}Plums</li></ol>` +
  `<p>Nested mix:</p><ol><li data-list="ordered">${ui}Step one</li><li data-list="bullet" class="ql-indent-1">${ui}sub dot a</li>` +
  `<li data-list="bullet" class="ql-indent-1">${ui}sub dot b</li><li data-list="bullet" class="ql-indent-2">${ui}deeper dot</li>` +
  `<li data-list="ordered">${ui}Step two</li><li data-list="ordered" class="ql-indent-1">${ui}sub step i</li></ol>`;
// Older editor (Quill 1) shape.
const STORED_QUILL1 = '<ul><li>One</li><li class="ql-indent-1">Two</li></ul><ol><li>Uno</li></ol>';

const render = (html: string) => { const d = document.createElement('div'); d.className = 'note-content'; d.innerHTML = renderNoteHtml(html); document.body.replaceChildren(d); return d; };
const itemsOf = (list: Element) => Array.from(list.children).map((li) => li.firstChild?.textContent?.trim());
const marker = (root: Element, text: string) => {
  const li = Array.from(root.querySelectorAll('li')).find((x) => x.firstChild?.textContent?.trim() === text)!;
  return getComputedStyle(li).listStyleType;
};

beforeAll(() => {
  const css = fs.readFileSync(path.resolve(__dirname, '../components/note-pro/note-content.css'), 'utf8');
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
});

describe('saved note HTML shown outside the editor', () => {
  it('a dotted list becomes a <ul> with disc markers; a numbered list an <ol> with decimal', () => {
    const root = render(STORED_QUILL2);
    const [numbered, dotted] = Array.from(root.children).filter((e) => e.matches('ol, ul'));
    expect(numbered.tagName).toBe('OL');
    expect(itemsOf(numbered)).toEqual(['First', 'Second', 'Third']);
    expect(dotted.tagName).toBe('UL');
    expect(itemsOf(dotted)).toEqual(['Apples', 'Pears', 'Plums']);
    expect(marker(root, 'First')).toBe('decimal');
    expect(marker(root, 'Apples')).toBe('disc');
  });

  it('nested levels become nested lists, with a marker per level', () => {
    const root = render(STORED_QUILL2);
    const mix = Array.from(root.children).filter((e) => e.matches('ol, ul'))[2];
    expect(mix.tagName).toBe('OL');
    expect(itemsOf(mix)).toEqual(['Step one', 'Step two']);
    const sub = mix.querySelector(':scope > li > ul')!;
    expect(itemsOf(sub)).toEqual(['sub dot a', 'sub dot b']);
    expect(sub.querySelector(':scope > li > ul')!.textContent).toBe('deeper dot');
    expect(mix.children[1].querySelector(':scope > ol')!.textContent).toBe('sub step i');
    expect(marker(root, 'Step one')).toBe('decimal');
    expect(marker(root, 'sub dot a')).toBe('circle');
    expect(marker(root, 'deeper dot')).toBe('square');
    expect(marker(root, 'sub step i')).toBe('lower-alpha');
  });

  it('keeps list semantics (li inside ul/ol), drops the editor-only bits, keeps the text', () => {
    const root = render(STORED_QUILL2);
    expect(root.querySelectorAll('li').length).toBe(12);
    expect(Array.from(root.querySelectorAll('li')).every((li) => li.parentElement!.matches('ul, ol'))).toBe(true);
    expect(root.querySelector('.ql-ui, [contenteditable], [class*="ql-indent"]')).toBeNull();
    expect(root.textContent).toContain('Numbered list:');
  });

  it('notes saved by the older editor still show dots and numbers', () => {
    const root = render(STORED_QUILL1);
    expect(marker(root, 'One')).toBe('disc');
    expect(marker(root, 'Uno')).toBe('decimal');
  });

  it('keeps bold, italic, underline, strike, links, code and alignment', () => {
    const html = '<p class="ql-align-center"><strong>b</strong><em>i</em><u>u</u><s>s</s><a href="https://example.com" rel="noopener noreferrer">l</a></p><pre data-language="plain">code</pre>';
    expect(renderNoteHtml(html)).toBe(html);
    // target is dropped by the sanitiser; links on a card are not clickable anyway (the card opens the note).
    expect(renderNoteHtml('<a href="https://example.com" target="_blank">l</a>')).toBe('<a href="https://example.com">l</a>');
  });

  it('is sanitised: scripts, event handlers and javascript: links are removed', () => {
    const out = renderNoteHtml('<p>ok<img src=x onerror="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)">x</a></p>');
    expect(out).not.toMatch(/onerror|<script|javascript:/);
    expect(out).toContain('ok');
  });

  it('the sanitiser itself keeps data-list (so the list type is never lost)', () => {
    expect(DOMPurify.sanitize('<ol><li data-list="bullet">a</li></ol>')).toBe('<ol><li data-list="bullet">a</li></ol>');
  });

  it('empty content renders nothing', () => {
    expect(renderNoteHtml('')).toBe('');
    expect(renderNoteHtml(null)).toBe('');
  });
});
