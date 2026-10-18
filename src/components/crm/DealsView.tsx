import React, { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Announcements,
  closestCorners,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MoreHorizontal, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/data/DataTable";
import { FilterBar } from "@/components/data/FilterBar";
import { StatusBadge, statusLabel } from "@/components/data/StatusBadge";
import { formatDueDate, isoDay } from "@/lib/dashboardData";
import { formatMoney, isClosedStage } from "@/lib/dashboardWidgets";
import {
  BoardColumn, boardSummary, buildBoard, DealsViewMode, loadDealsView, moveDealStage, rememberStages, saveDealsView, StageSeen,
} from "@/lib/dealBoard";
import { CURRENCIES } from "@/utils/currencyUtils";
import { useAccountCurrency } from "@/hooks/useAccountCurrency";
import { crmSummary, formatByCurrency } from "@/lib/marketingAudience";
import { formatMoney as fmtMoney } from "@/lib/money";
import { useSearchParams } from "react-router-dom";
import { Label } from "@/components/ui/label";
import { usePhone } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

interface Deal {
  id: string;
  title: string;
  value: number | null;
  stage: string | null;
  contact_id: string | null;
  probability: number | null;
  currency?: string | null;
  close_date: string | null;
  user_id: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  sort_order?: number | null;
}

interface ContactRef { id: string; name: string; company: string | null }

interface DealsViewProps {
  deals: Deal[];
  contacts?: ContactRef[];
  onRefresh: () => void;
  onAddDeal?: (dealData: Partial<Deal>) => Promise<any>;
  onUpdateDeal?: (dealId: string, dealData: Partial<Deal>, opts?: { quiet?: boolean }) => Promise<any>;
  onDeleteDeal?: (dealId: string) => Promise<void>;
}

const colLabel = (c: Pick<BoardColumn, "key" | "stage">) => (c.key ? statusLabel(c.stage) : "No stage");
const money = (totals: { currency: string; amount: number }[]) =>
  totals.length ? totals.map((t) => formatMoney(t.amount, t.currency)).join(" + ") : formatMoney(0, "");

// Stage choices from the add-deal form this view had before (commit c841d1f), unchanged.
const FORM_STAGES = [
  { value: "prospecting", label: "Prospecting" },
  { value: "qualification", label: "Qualification" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "closed", label: "Closed Won" },
];
const NO_CURRENCY = "__none";
// Probability starts empty: it is optional and never defaulted (Phase 1b).
const emptyForm = (stage = "prospecting", currency = "") => ({ title: "", value: "", stage, probability: "", close_date: "", notes: "", currency: currency || NO_CURRENCY });

/** Deal card content. Missing values are left out, not guessed. */
function DealCardBody({ deal, contact }: { deal: Deal; contact?: ContactRef }) {
  const who = contact ? [contact.name, contact.company].filter(Boolean).join(" · ") : null;
  return (
    <>
      <p className="pr-10 font-semibold leading-snug text-foreground">{deal.title}</p>
      {who && <p className="mt-0.5 truncate text-small text-muted-foreground">{who}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-small">
        {deal.value != null && <span className="font-semibold tabular-nums text-foreground">{formatMoney(Number(deal.value), (deal.currency || "").toUpperCase())}</span>}
        {deal.probability != null && <span className="text-muted-foreground">{deal.probability}% likely</span>}
        {deal.close_date && <span className="text-muted-foreground">Closes {formatDueDate(deal.close_date)}</span>}
      </div>
    </>
  );
}

function SortableDeal({ deal, col, contact, moveMenu }: { deal: Deal; col: string; contact?: ContactRef; moveMenu: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id, data: { col } });
  return (
    <li className="relative" style={{ transform: CSS.Transform.toString(transform), transition }}>
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`${deal.title}. Press Space to move.`}
        className={cn(
          "min-h-touch cursor-grab touch-manipulation rounded-control border border-border bg-card p-3 shadow-[0_1px_2px_rgba(0,26,76,0.06)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring active:cursor-grabbing",
          isDragging && "opacity-40",
        )}
      >
        <DealCardBody deal={deal} contact={contact} />
      </div>
      <div className="absolute right-1.5 top-1.5">{moveMenu}</div>
    </li>
  );
}

function BoardColumnView({ col, children, onAdd, phone }: { col: BoardColumn<Deal>; children: React.ReactNode; onAdd?: () => void; phone: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${col.key}`, data: { col: col.key } });
  const headingId = `stage-${col.key.replace(/\W+/g, "-") || "none"}`;
  return (
    <section aria-labelledby={headingId} className={cn("relative flex min-h-[18rem] flex-col rounded-card border border-border bg-muted", phone ? "w-full" : "w-72 shrink-0")}>
      <header className="border-b border-border px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 id={headingId} className="truncate text-body font-bold text-foreground">{colLabel(col)}</h3>
          <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-small font-semibold tabular-nums text-foreground" aria-label={`${col.deals.length} ${col.deals.length === 1 ? "deal" : "deals"}`}>{col.deals.length}</span>
        </div>
        <p className="mt-0.5 truncate text-small text-muted-foreground"><span className="sr-only">Total value: </span>{money(col.totals)}</p>
      </header>
      <div ref={setNodeRef} className={cn("flex-1 p-2 transition-colors", isOver && "bg-primary/10")}>
        {col.deals.length === 0 ? (
          <div className="flex h-full min-h-[10rem] flex-col items-center justify-center gap-2 rounded-control border border-dashed border-border p-4 text-center">
            <p className="text-small text-muted-foreground">No deals in this stage.</p>
            {onAdd && <Button size="sm" variant="outline" className="min-h-touch bg-card md:min-h-0" onClick={onAdd}><Plus className="h-4 w-4" aria-hidden="true" />Add deal</Button>}
          </div>
        ) : children}
      </div>
    </section>
  );
}

const DealsView = ({ deals, contacts = [], onRefresh, onAddDeal, onUpdateDeal }: DealsViewProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const accountCurrency = useAccountCurrency();
  const [params, setParams] = useSearchParams();
  const phone = usePhone();
  const [localDeals, setLocalDeals] = useState<Deal[]>([]);

  useEffect(() => {
    // Sort deals by sort_order on load
    setLocalDeals([...deals].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
  }, [deals]);

  const persistOrder = async (newDeals: Deal[]) => {
    if (!user?.id) return;
    try {
      const updates = newDeals.map((deal, index) => ({
        id: deal.id,
        sort_order: index,
      }));
      // Bulk update in Supabase using individual updates
      for (const update of updates) {
        const { error } = await supabase
          .from("crm_deals")
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);
        if (error) throw error;
      }
      toast({ title: "Order Saved", description: "Pipeline order updated successfully." });
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Error",
        description: error.message || "Failed to save pipeline order",
        variant: "destructive",
      });
    }
  };

  // Table / Board, remembered per user (Table if unknown or storage is blocked).
  const [mode, setModeState] = useState<DealsViewMode>(() => loadDealsView(user?.id));
  useEffect(() => { setModeState(loadDealsView(user?.id)); }, [user?.id]);
  const setMode = (m: DealsViewMode) => { setModeState(m); saveDealsView(user?.id, m); };

  // Add / edit deal form (add form restored in Phase 1; currency + optional probability in Phase 1b).
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm());
  const [extraStage, setExtraStage] = useState<string | null>(null);
  const openForm = (data: ReturnType<typeof emptyForm>, id: string | null) => {
    setExtraStage(FORM_STAGES.some((f) => f.value === data.stage) ? null : data.stage);
    setFormData(data);
    setEditingId(id);
    setFormOpen(true);
  };
  const openAdd = (stage?: string | null) => openForm(emptyForm(stage || "prospecting", accountCurrency), null);
  const openEdit = (d: Deal) => openForm({
    title: d.title, value: d.value == null ? "" : String(d.value), stage: d.stage || "prospecting",
    probability: d.probability == null ? "" : String(d.probability), close_date: (d.close_date || "").slice(0, 10),
    notes: d.notes || "", currency: (d.currency || "").toUpperCase() || NO_CURRENCY,
  }, d.id);
  // ?deal=<id> (links from Reports, "Needs attention"): open that deal once, then drop the param.
  useEffect(() => {
    const id = params.get("deal");
    if (!id) return;
    const next = new URLSearchParams(params);
    next.delete("deal");
    setParams(next, { replace: true });
    const d = deals.find((x) => x.id === id);
    if (d) openEdit(d);
    else toast({ title: "That deal couldn't be found", description: "It may have been deleted.", variant: "destructive" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, deals]);
  const handleSaveDeal = async () => {
    if (!formData.title.trim()) {
      toast({ title: "Error", description: "Deal title is required", variant: "destructive" });
      return;
    }
    const prob = formData.probability.trim();
    if (prob !== "" && (!Number.isFinite(Number(prob)) || Number(prob) < 0 || Number(prob) > 100)) {
      toast({ title: "Error", description: "Probability must be between 0 and 100, or left blank.", variant: "destructive" });
      return;
    }
    const dealData: Partial<Deal> = {
      title: formData.title, stage: formData.stage, close_date: formData.close_date, notes: formData.notes,
      value: formData.value ? parseFloat(formData.value) : 0,
      probability: prob === "" ? null : Number(prob),
      currency: formData.currency === NO_CURRENCY ? null : formData.currency,
    };
    const result = editingId ? await onUpdateDeal?.(editingId, dealData) : await onAddDeal?.(dealData);
    if (result) {
      setFormOpen(false);
      setFormData(emptyForm());
      if (!editingId) await onRefresh?.();
    }
  };
  const currencyOptions = Array.from(new Set([...(accountCurrency ? [accountCurrency] : []), ...Object.keys(CURRENCIES), ...(formData.currency !== NO_CURRENCY ? [formData.currency] : [])]));

  const [q, setQ] = useState("");
  const [stage, setStage] = useState("all");
  const stages = Array.from(new Set(localDeals.map((d) => d.stage).filter(Boolean))) as string[];
  const probFilter = params.get("prob") === "none" ? "none" : "all";
  const setProbFilter = (v: string) => { const next = new URLSearchParams(params); if (v === "none") next.set("prob", "none"); else next.delete("prob"); setParams(next); };
  const shown = localDeals.filter((d) => (!q.trim() || d.title.toLowerCase().includes(q.trim().toLowerCase())) && (stage === "all" || d.stage === stage)
    && (probFilter === "all" || (d.probability == null && !isClosedStage(d.stage))));
  const filterCount = (q.trim() ? 1 : 0) + (stage !== "all" ? 1 : 0) + (probFilter !== "all" ? 1 : 0);
  const clearFilters = () => { setQ(""); setStage("all"); setProbFilter("all"); };
  // Arriving with ?prob=none (from the "no probability yet" link) shows the table.
  useEffect(() => { if (probFilter === "none" && mode !== "table") setModeState("table"); }, [probFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Board columns: stages seen on loaded deals, kept for this visit even when a move empties one.
  const seen = useRef<StageSeen>([]);
  seen.current = rememberStages(seen.current, localDeals);
  const columns = buildBoard(localDeals, seen.current);
  const contactById = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);
  const summary = boardSummary(localDeals, isoDay(new Date()));
  const totals = crmSummary([], localDeals);
  const [phoneCol, setPhoneCol] = useState<string | null>(null);
  const shownCol = columns.find((c) => c.key === phoneCol) ?? columns[0];

  const move = async (deal: Deal, to: BoardColumn<Deal>) => {
    if (to.stage == null || !onUpdateDeal) return;
    const fromLabel = statusLabel(deal.stage);
    const r = await moveDealStage({
      deals: localDeals, id: deal.id, to: to.stage, update: setLocalDeals,
      save: () => onUpdateDeal(deal.id, { stage: to.stage! }, { quiet: true }),
    });
    if (!r.ok) toast({ title: "Couldn't move the deal", description: `“${deal.title}” wasn't saved in ${colLabel(to)}, so it's back in ${fromLabel}. Please try again.`, variant: "destructive" });
  };

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [dragging, setDragging] = useState<Deal | null>(null);
  const colOf = (key: unknown) => columns.find((c) => c.key === key);
  const dealTitle = (id: unknown) => localDeals.find((d) => d.id === id)?.title ?? "Deal";
  const overLabel = (over: { data: { current?: Record<string, unknown> } } | null) => { const c = colOf(over?.data.current?.col); return c ? colLabel(c) : null; };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${dealTitle(active.id)}, in ${colLabel(colOf(active.data.current?.col) ?? { key: "", stage: null })}.`,
    onDragOver: ({ active, over }) => (overLabel(over) ? `${dealTitle(active.id)} is over ${overLabel(over)}.` : `${dealTitle(active.id)} is not over a stage.`),
    onDragEnd: ({ active, over }) => (overLabel(over) ? `${dealTitle(active.id)} dropped in ${overLabel(over)}.` : `${dealTitle(active.id)} was not moved.`),
    onDragCancel: ({ active }) => `Move cancelled. ${dealTitle(active.id)} was not moved.`,
  };

  const onDragStart = (e: DragStartEvent) => setDragging(localDeals.find((d) => d.id === e.active.id) ?? null);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    if (!over) return;
    const from = active.data.current?.col as string;
    const toKey = over.data.current?.col as string | undefined;
    const deal = localDeals.find((d) => d.id === active.id);
    const target = colOf(toKey);
    if (!deal || !target) return;
    if (target.key !== from) {
      if (target.stage == null) return; // "No stage" is not a drop target.
      void move(deal, target);
      return;
    }
    // Same stage: reorder, as the old "Reorder pipeline" view did (saved as sort_order).
    if (over.id === active.id || String(over.id).startsWith("col:")) return;
    const oldIndex = localDeals.findIndex((d) => d.id === active.id);
    const newIndex = localDeals.findIndex((d) => d.id === over.id);
    const newOrder = arrayMove(localDeals, oldIndex, newIndex).map((d, i) => ({ ...d, sort_order: i }));
    setLocalDeals(newOrder);
    persistOrder(newOrder);
  };

  const moveMenu = (deal: Deal, current: string) => {
    const targets = columns.filter((c) => c.key !== current && c.stage != null);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-11 w-11 md:h-8 md:w-8" aria-label={`Actions for ${deal.title}`}><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onUpdateDeal && <DropdownMenuItem onSelect={() => openEdit(deal)}><Pencil className="mr-2 h-4 w-4" aria-hidden="true" />Edit deal</DropdownMenuItem>}
          {targets.length > 0 && <><DropdownMenuSeparator /><DropdownMenuLabel>Move to stage</DropdownMenuLabel></>}
          {targets.map((c) => <DropdownMenuItem key={c.key} onSelect={() => void move(deal, c)}>{colLabel(c)}</DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const showNoProbability = () => { setMode("table"); setProbFilter("none"); };
  // Pipeline summary (Table and Board): per currency, never converted; open/closed = isClosedStage.
  const pipelineSummary = localDeals.length > 0 && (
    <section aria-label="Pipeline summary" className="space-y-2">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-card border border-border bg-card p-4">
          <p className="text-small font-semibold text-muted-foreground">Open pipeline</p>
          <p className="mt-1 break-words text-2xl font-bold tabular-nums text-foreground">{formatByCurrency(totals.openByCurrency)}</p>
          <p className="mt-0.5 text-small text-muted-foreground">Sum of the values of {totals.openDeals} open {totals.openDeals === 1 ? "deal" : "deals"} (not won or lost).</p>
        </div>
        <div className="rounded-card border border-border bg-card p-4">
          <p className="text-small font-semibold text-muted-foreground">Weighted forecast</p>
          <p className="mt-1 break-words text-2xl font-bold tabular-nums text-foreground">{totals.withProbabilityDeals ? formatByCurrency(totals.weightedByCurrency) : "—"}</p>
          <p className="mt-0.5 text-small text-muted-foreground">{totals.withProbabilityDeals === 0
            ? "Each open deal's value × its probability. No open deal has a probability yet."
            : <>Each open deal's value × its probability, only for the {totals.withProbabilityDeals} {totals.withProbabilityDeals === 1 ? "deal" : "deals"} that {totals.withProbabilityDeals === 1 ? "has" : "have"} one.</>}</p>
        </div>
        <div className="rounded-card border border-border bg-card p-4">
          <p className="text-small font-semibold text-muted-foreground">Expected to close in the next 30 days</p>
          <p className="mt-1 break-words text-2xl font-bold tabular-nums text-foreground">{money(summary.closingTotals)}</p>
          <p className="mt-0.5 text-small text-muted-foreground">{summary.closingCount} open {summary.closingCount === 1 ? "deal" : "deals"} with a close date in that window.</p>
        </div>
      </div>
      {totals.noProbabilityDeals > 0 && (
        <p className="text-small text-muted-foreground">
          {totals.noProbabilityDeals} open {totals.noProbabilityDeals === 1 ? "deal has" : "deals have"} no probability yet, so {totals.noProbabilityDeals === 1 ? "it is" : "they are"} not in the weighted forecast.{" "}
          <button type="button" onClick={showNoProbability} className="min-h-touch rounded-sm font-semibold text-link underline underline-offset-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring md:min-h-0">Show {totals.noProbabilityDeals === 1 ? "it" : "them"}</button>
        </p>
      )}
    </section>
  );

  const header = (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">Your deals — records you created, not company-wide.</p>
      <div className="flex flex-wrap items-center gap-2">
        {onAddDeal && <Button className="min-h-touch md:min-h-0" onClick={() => openAdd()}><Plus className="h-4 w-4" aria-hidden="true" />Add deal</Button>}
        <div className="flex gap-1 rounded-control border bg-muted p-1" role="group" aria-label="Deals layout">
          <Button size="sm" className="min-h-touch md:min-h-0" variant={mode === "table" ? "default" : "ghost"} aria-pressed={mode === "table"} onClick={() => setMode("table")}>Table</Button>
          <Button size="sm" className="min-h-touch md:min-h-0" variant={mode === "board" ? "default" : "ghost"} aria-pressed={mode === "board"} onClick={() => setMode("board")}>Board</Button>
        </div>
      </div>
    </div>
  );

  const field = "space-y-1.5";
  const addDialog = (
    <Dialog open={formOpen} onOpenChange={setFormOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editingId ? "Edit deal" : "Add New Deal"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className={field}><Label htmlFor="deal-title">Deal title *</Label>
            <Input id="deal-title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} /></div>
          <div className="grid grid-cols-[1fr_9rem] gap-3">
            <div className={field}><Label htmlFor="deal-value">Value</Label>
              <Input id="deal-value" type="number" inputMode="decimal" value={formData.value} onChange={(e) => setFormData({ ...formData, value: e.target.value })} /></div>
            <div className={field}><Label htmlFor="deal-currency">Currency</Label>
              <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                <SelectTrigger id="deal-currency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencyOptions.map((c) => <SelectItem key={c} value={c}>{c}{c === accountCurrency ? " (account)" : ""}</SelectItem>)}
                  <SelectItem value={NO_CURRENCY}>Not set</SelectItem>
                </SelectContent>
              </Select></div>
          </div>
          <div className={field}><Label htmlFor="deal-stage">Stage</Label>
            <Select value={formData.stage} onValueChange={(value) => setFormData({ ...formData, stage: value })}>
              <SelectTrigger id="deal-stage"><SelectValue placeholder="Select Stage" /></SelectTrigger>
              <SelectContent>
                {extraStage && <SelectItem value={extraStage}>{statusLabel(extraStage)}</SelectItem>}
                {FORM_STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select></div>
          <div className={field}><Label htmlFor="deal-probability">Probability (%)</Label>
            <Input id="deal-probability" type="number" min="0" max="100" inputMode="numeric" aria-describedby="deal-probability-help" value={formData.probability} onChange={(e) => setFormData({ ...formData, probability: e.target.value })} />
            <p id="deal-probability-help" className="text-small text-muted-foreground">Optional. Leave blank if you have not estimated it.</p></div>
          <div className={field}><Label htmlFor="deal-close">Expected close date</Label>
            <Input id="deal-close" type="date" value={formData.close_date} onChange={(e) => setFormData({ ...formData, close_date: e.target.value })} /></div>
          <div className={field}><Label htmlFor="deal-notes">Notes (optional)</Label>
            <Input id="deal-notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} /></div>
          <Button className="w-full" onClick={handleSaveDeal}>{editingId ? "Save deal" : "Add Deal"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  if (mode === "table") {
    return (
      <div className="space-y-3">
        {header}
        {pipelineSummary}
        <section aria-label="Deals table" className="space-y-3 rounded-card border border-border bg-card p-4">
          <FilterBar search={q} onSearch={setQ} searchLabel="Search deals" activeCount={filterCount} onClear={clearFilters}
            selects={[
              { id: "stage", label: "Stage", value: stage, onChange: setStage, options: [{ value: "all", label: "All stages" }, ...stages.map((s) => ({ value: s, label: statusLabel(s) }))] },
              { id: "prob", label: "Probability", value: probFilter, onChange: setProbFilter, options: [{ value: "all", label: "Any probability" }, { value: "none", label: "Open, no probability yet" }] },
            ]} />
          <DataTable
            caption="Your deals"
            rows={shown}
            rowKey={(d) => d.id}
            filtered={filterCount > 0}
            onClearFilters={clearFilters}
            empty={<div className="flex flex-col items-center gap-3 rounded-control border border-dashed p-8 text-center text-sm text-muted-foreground"><p>No deals yet.</p>{onAddDeal && <Button size="sm" variant="outline" onClick={() => openAdd()}><Plus className="h-4 w-4" aria-hidden="true" />Add deal</Button>}</div>}
            columns={[
              { id: "title", header: "Deal", sortValue: (d) => d.title, cell: (d) => <span className="font-medium">{d.title}</span> },
              { id: "stage", header: "Stage", sortValue: (d) => d.stage, cell: (d) => <StatusBadge value={d.stage} prefix="Stage" /> },
              { id: "value", header: "Value", className: "text-right", sortValue: (d) => d.value ?? 0, cell: (d) => (d.value == null ? "—" : fmtMoney(Number(d.value), d.currency)) },
              { id: "probability", header: "Probability", className: "text-right", sortValue: (d) => d.probability ?? 0, cell: (d) => (d.probability != null ? `${d.probability}%` : "—") },
              { id: "close", header: "Close date", sortValue: (d) => d.close_date, cell: (d) => <span className="whitespace-nowrap text-muted-foreground">{d.close_date ? formatDueDate(d.close_date) : "—"}</span> },
            ]}
            rowActions={onUpdateDeal ? (d) => <Button variant="ghost" size="sm" className="min-h-touch md:min-h-0" onClick={() => openEdit(d)} aria-label={`Edit ${d.title}`}><Pencil className="h-4 w-4" aria-hidden="true" />Edit</Button> : undefined}
          />
        </section>
        {addDialog}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}
      {localDeals.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border bg-card p-10 text-center">
          <p className="text-body font-semibold text-foreground">Your pipeline is empty.</p>
          <p className="text-small text-muted-foreground">Add a deal to see it on the board.</p>
          {onAddDeal && <Button className="min-h-touch md:min-h-0" onClick={() => openAdd()}><Plus className="h-4 w-4" aria-hidden="true" />Add deal</Button>}
        </div>
      ) : (
        <>
          {pipelineSummary}

          {phone && shownCol && (
            <div>
              <label htmlFor="board-stage" className="mb-1 block text-small font-semibold text-foreground">Stage</label>
              <Select value={shownCol.key || "__none"} onValueChange={(v) => setPhoneCol(v === "__none" ? "" : v)}>
                <SelectTrigger id="board-stage" className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {columns.map((c) => <SelectItem key={c.key || "__none"} value={c.key || "__none"}>{colLabel(c)} ({c.deals.length})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setDragging(null)}
            accessibility={{
              announcements,
              screenReaderInstructions: { draggable: "To move a deal, press Space to pick it up. Use the arrow keys to move it to another stage or position, then press Space to drop it, or Escape to cancel." },
            }}
          >
            <div className={cn("relative", phone ? "" : "-mx-1 flex gap-3 overflow-x-auto px-1 pb-3")} role="list" aria-label="Pipeline stages">
              {(phone ? (shownCol ? [shownCol] : []) : columns).map((col) => (
                <div role="listitem" key={col.key || "__none"} className={phone ? "" : "flex"}>
                  <BoardColumnView col={col} phone={phone} onAdd={onAddDeal && col.stage != null ? () => openAdd(col.stage) : undefined}>
                    <SortableContext items={col.deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
                      <ul className="space-y-2" aria-label={`${colLabel(col)} deals`}>
                        {col.deals.map((d) => (
                          <SortableDeal key={d.id} deal={d} col={col.key} contact={d.contact_id ? contactById.get(d.contact_id) : undefined} moveMenu={moveMenu(d, col.key)} />
                        ))}
                      </ul>
                    </SortableContext>
                  </BoardColumnView>
                </div>
              ))}
            </div>
            <DragOverlay>
              {dragging && (
                <div className="w-72 rounded-control border border-primary bg-card p-3 shadow-lg">
                  <DealCardBody deal={dragging} contact={dragging.contact_id ? contactById.get(dragging.contact_id) : undefined} />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </>
      )}
      {addDialog}
    </div>
  );
};

export default DealsView;
