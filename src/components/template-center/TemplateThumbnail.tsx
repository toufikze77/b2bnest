import React from 'react';

const PALETTES: string[][] = [
  ['bg-blue-500', 'bg-emerald-500', 'bg-amber-400', 'bg-rose-500'],
  ['bg-violet-500', 'bg-sky-500', 'bg-lime-500', 'bg-orange-400'],
  ['bg-teal-500', 'bg-indigo-500', 'bg-pink-500', 'bg-yellow-400'],
  ['bg-emerald-600', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-red-400'],
];

interface TemplateThumbnailProps {
  seed: string;
  title: string;
  variant?: 'board' | 'gradient';
}

/** Monday-style faux board preview generated from the template id (no image assets needed). */
const TemplateThumbnail = ({ seed, title, variant = 'board' }: TemplateThumbnailProps) => {
  const hash = Array.from(seed).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const palette = PALETTES[hash % PALETTES.length];
  const rows = 6;

  if (variant === 'gradient') {
    return (
      <div className="h-full w-full rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 p-3">
        <div className="h-full w-full rounded bg-white/95 p-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="mb-1.5 flex items-center gap-1.5">
              <div className="h-1.5 flex-1 rounded-full bg-muted" />
              <div className="h-2.5 w-2.5 rounded-full border border-border" />
              <div className={`h-2.5 w-8 rounded-sm ${palette[i % palette.length]}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden rounded-md border border-border bg-background p-2">
      <div className="mb-2 h-1.5 w-20 rounded-full bg-muted-foreground/30" aria-hidden />
      <div className="space-y-1.5" aria-hidden>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-1">
            <div className={`h-2 w-1 rounded-sm ${palette[r % palette.length]}`} />
            <div className="h-2 flex-1 rounded-sm bg-muted" />
            <div className={`h-2 w-6 rounded-sm ${palette[(r + 1) % palette.length]} opacity-80`} />
            <div className={`h-2 w-4 rounded-sm ${palette[(r + 2) % palette.length]} opacity-60`} />
            <div className="h-2 w-5 rounded-sm bg-muted" />
          </div>
        ))}
      </div>
      <span className="sr-only">{title} template preview</span>
    </div>
  );
};

export default TemplateThumbnail;
