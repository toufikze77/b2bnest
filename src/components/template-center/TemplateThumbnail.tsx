import React from 'react';

const PALETTES: string[][] = [
  ['bg-[#0073ea]', 'bg-[#00c875]', 'bg-[#fdab3d]', 'bg-[#e2445c]', 'bg-[#a25ddc]'],
  ['bg-[#a25ddc]', 'bg-[#0086c0]', 'bg-[#9cd326]', 'bg-[#ff642e]', 'bg-[#00c875]'],
  ['bg-[#00c875]', 'bg-[#579bfc]', 'bg-[#ff158a]', 'bg-[#ffcb00]', 'bg-[#0073ea]'],
  ['bg-[#037f4c]', 'bg-[#66ccff]', 'bg-[#bb3354]', 'bg-[#fdab3d]', 'bg-[#579bfc]'],
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

  if (variant === 'gradient') {
    return (
      <div className="h-full w-full overflow-hidden rounded-md bg-gradient-to-br from-[#5034ff] to-[#a25ddc] p-3">
        <div className="h-full w-full overflow-hidden rounded bg-white p-2 shadow-sm">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="mb-1.5 flex items-center gap-1.5">
              <div className="h-1.5 flex-1 rounded-full bg-slate-200" />
              <div className="h-2.5 w-2.5 rounded-full border border-slate-300" />
              <div className={`h-2.5 w-8 rounded-sm ${palette[i % palette.length]}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Two groups of rows, like a real monday board
  const groups = [
    { color: palette[0], rows: 3 },
    { color: palette[1], rows: 3 },
  ];

  return (
    <div className="h-full w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      {/* board title bar */}
      <div className="flex items-center gap-1.5 border-b border-slate-100 px-2 py-1.5" aria-hidden>
        <div className="h-1.5 w-16 rounded-full bg-slate-300" />
        <div className="ml-auto h-1.5 w-5 rounded-full bg-slate-200" />
        <div className="h-1.5 w-3 rounded-full bg-slate-200" />
      </div>

      <div className="space-y-1.5 p-2" aria-hidden>
        {groups.map((g, gi) => (
          <div key={gi} className="space-y-[3px]">
            {/* group label */}
            <div className="flex items-center gap-1 pl-1">
              <div className={`h-1.5 w-1.5 rounded-full ${g.color}`} />
              <div className={`h-1.5 w-10 rounded-full ${g.color} opacity-40`} />
            </div>
            {Array.from({ length: g.rows }).map((_, r) => {
              const idx = gi * 3 + r;
              return (
                <div key={r} className="flex items-center gap-1">
                  <div className={`h-3 w-[3px] rounded-sm ${g.color}`} />
                  <div className="h-2.5 w-2.5 shrink-0 rounded-[2px] border border-slate-300" />
                  <div className="h-1.5 flex-1 rounded-full bg-slate-200" />
                  <div className={`h-2.5 w-9 rounded-[3px] ${palette[(idx + 1) % palette.length]}`} />
                  <div className={`h-2.5 w-6 rounded-[3px] ${palette[(idx + 3) % palette.length]}`} />
                  <div className="h-2.5 w-2.5 rounded-full bg-slate-200" />
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <span className="sr-only">{title} template preview</span>
    </div>
  );
};

export default TemplateThumbnail;
