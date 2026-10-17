/** Custom tooltip card: title, coloured dot, formatted value and, where useful, the share of the total. */
export function TooltipCard({ title, rows }: { title: string; rows: { color: string; label: string; value: string; share?: string }[] }) {
  return (
    <div className="min-w-[10rem] rounded-control border border-border bg-card px-3 py-2 text-small shadow-[0_8px_24px_rgba(0,26,76,0.12)]">
      <p className="mb-1 font-semibold text-foreground">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2 text-foreground">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden="true" />
          <span className="text-muted-foreground">{r.label}</span>
          <span className="ml-auto pl-3 font-semibold tabular-nums">{r.value}</span>
          {r.share && <span className="tabular-nums text-muted-foreground">{r.share}</span>}
        </p>
      ))}
    </div>
  );
}

