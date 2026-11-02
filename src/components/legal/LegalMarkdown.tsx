import { Fragment } from 'react';
import { type Inline, parseMarkdown } from '@/lib/legalMarkdown';

/**
 * Phase 30: shows an AI-drafted document. Built only from React text nodes (no dangerouslySetInnerHTML, no HTML
 * parsing), so markup in the text is shown as text. [Placeholders] are highlighted so they are easy to find and fill.
 */
function Inlines({ inlines }: { inlines: Inline[] }) {
  return (
    <>
      {inlines.map((i, n) => {
        let node: React.ReactNode = i.text;
        if (i.placeholder) {
          node = (
            <mark data-placeholder className="rounded bg-amber-200 px-0.5 text-amber-950 dark:bg-amber-400/30 dark:text-amber-100">
              {i.text}
            </mark>
          );
        }
        if (i.italic) node = <em>{node}</em>;
        if (i.bold) node = <strong>{node}</strong>;
        return <Fragment key={n}>{node}</Fragment>;
      })}
    </>
  );
}

const HEADING_CLASS = ['', 'text-2xl font-bold', 'text-xl font-semibold mt-6', 'text-lg font-semibold mt-4', 'font-semibold mt-3'];

export default function LegalMarkdown({ markdown }: { markdown: string }) {
  const blocks = parseMarkdown(markdown);
  return (
    <div className="space-y-2 text-sm leading-relaxed text-foreground" data-testid="legal-markdown">
      {blocks.map((b, n) => {
        switch (b.type) {
          case 'heading': {
            const H = (`h${Math.min(b.level + 1, 6)}`) as 'h2';
            return <H key={n} className={HEADING_CLASS[b.level]}><Inlines inlines={b.inlines} /></H>;
          }
          case 'clause':
            return (
              <p key={n} className="flex gap-2" style={{ paddingLeft: `${b.depth * 1.25}rem` }}>
                <span className="shrink-0 tabular-nums font-medium">{b.number}</span>
                <span><Inlines inlines={b.inlines} /></span>
              </p>
            );
          case 'bullet':
            return <p key={n} className="flex gap-2 pl-2"><span aria-hidden>•</span><span><Inlines inlines={b.inlines} /></span></p>;
          case 'quote':
            return <blockquote key={n} className="border-l-4 border-border pl-3 text-muted-foreground"><Inlines inlines={b.inlines} /></blockquote>;
          case 'table':
            return (
              <div key={n} className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  {b.header && (
                    <thead>
                      <tr>{b.header.map((c, i) => <th key={i} scope="col" className="border border-border bg-muted px-2 py-1 font-semibold"><Inlines inlines={c} /></th>)}</tr>
                    </thead>
                  )}
                  <tbody>
                    {b.rows.map((r, ri) => (
                      <tr key={ri}>{r.map((c, i) => <td key={i} className="border border-border px-2 py-1 align-top"><Inlines inlines={c} /></td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'rule':
            return <hr key={n} className="border-border" />;
          default:
            return <p key={n}><Inlines inlines={b.inlines} /></p>;
        }
      })}
    </div>
  );
}
