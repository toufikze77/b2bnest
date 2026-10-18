import DOMPurify from 'dompurify';

/**
 * Saved note HTML -> safe HTML with real list structure, for showing a note outside the editor.
 *
 * Quill 2 (the editor) stores every list as a flat <ol> and marks each item instead:
 *   <ol><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span>Apples</li>
 *       <li data-list="ordered" class="ql-indent-1">…</li></ol>
 * Without Quill's editor CSS a browser numbers all of them. This rebuilds them as nested <ul> / <ol>
 * (bullets become <ul>, numbers <ol>, each indent level a nested list), so markers are right and screen
 * readers hear bullet lists as bullet lists. Notes saved by the older editor (plain <ul>/<ol>) pass through.
 * Nothing is written back: stored notes are not changed.
 */
export function renderNoteHtml(html: string | null | undefined): string {
  if (!html) return '';
  const clean = DOMPurify.sanitize(html, { FORBID_ATTR: ['contenteditable'], RETURN_DOM_FRAGMENT: true });
  for (const list of Array.from(clean.querySelectorAll('ol, ul'))) {
    if (list.querySelector(':scope > li[data-list]')) rebuildList(list);
  }
  const box = document.createElement('div');
  box.appendChild(clean);
  return box.innerHTML;
}

const indentOf = (li: Element) => Number(/(?:^|\s)ql-indent-(\d)(?:\s|$)/.exec(li.className)?.[1] ?? 0);
const tagFor = (kind: string | null) => (kind === 'ordered' ? 'OL' : 'UL');

function rebuildList(source: Element) {
  const doc = source.ownerDocument;
  const roots: Element[] = [];
  // Open lists from the outermost level inwards.
  const stack: { level: number; list: Element }[] = [];
  const top = () => stack[stack.length - 1];
  const open = (tag: string, level: number) => {
    const list = doc.createElement(tag);
    const parent = top();
    if (parent) {
      let host = parent.list.lastElementChild;
      if (!host) { host = doc.createElement('li'); host.setAttribute('data-empty', ''); parent.list.appendChild(host); }
      host.appendChild(list);
    } else {
      roots.push(list);
    }
    stack.push({ level, list });
  };

  for (const li of Array.from(source.children)) {
    if (li.tagName !== 'LI') continue;
    const kind = li.getAttribute('data-list');
    const level = indentOf(li);
    const tag = tagFor(kind);
    while (stack.length && top().level > level) stack.pop();
    if (stack.length && top().level === level && top().list.tagName !== tag) stack.pop();
    // Open the missing levels (normally just one); a jump of two indents gets an empty item in between.
    while (!stack.length || top().level < level) open(tag, stack.length ? top().level + 1 : 0);
    li.querySelector(':scope > .ql-ui')?.remove();
    li.classList.remove(`ql-indent-${level}`);
    if (!li.getAttribute('class')) li.removeAttribute('class');
    if (kind === 'checked' || kind === 'unchecked') top().list.setAttribute('data-checklist', '');
    top().list.appendChild(li);
  }
  source.replaceWith(...roots);
}
