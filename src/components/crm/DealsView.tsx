import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data/DataTable";
import { FilterBar } from "@/components/data/FilterBar";
import { StatusBadge, statusLabel } from "@/components/data/StatusBadge";
import { formatDueDate } from "@/lib/dashboardData";
import { formatCurrency } from "@/utils/currencyUtils";
import { useUserSettings } from "@/hooks/useUserSettings";

interface Deal {
  id: string;
  title: string;
  value: number | null;
  stage: string | null;
  contact_id: string | null;
  probability: number | null;
  close_date: string | null;
  user_id: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  sort_order?: number; // <-- safe column name
}

// Sortable item component
const SortableItem = ({ id, children }: { id: string; children: React.ReactNode }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
};

interface DealsViewProps {
  deals: Deal[];
  onRefresh: () => void;
  onAddDeal?: (dealData: Partial<Deal>) => Promise<any>;
  onUpdateDeal?: (dealId: string, dealData: Partial<Deal>) => Promise<any>;
  onDeleteDeal?: (dealId: string) => Promise<void>;
}

const DealsView = ({ deals, onRefresh }: DealsViewProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [localDeals, setLocalDeals] = useState<Deal[]>([]);
  const sensors = useSensors(useSensor(PointerSensor));
  const { settings } = useUserSettings();

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

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = localDeals.findIndex((d) => d.id === active.id);
      const newIndex = localDeals.findIndex((d) => d.id === over.id);
      const newOrder = arrayMove(localDeals, oldIndex, newIndex);
      setLocalDeals(newOrder);
      persistOrder(newOrder);
    }
  };

  const [mode, setMode] = useState<"table" | "pipeline">("table");
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("all");
  const stages = Array.from(new Set(localDeals.map((d) => d.stage).filter(Boolean))) as string[];
  const shown = localDeals.filter((d) => (!q.trim() || d.title.toLowerCase().includes(q.trim().toLowerCase())) && (stage === "all" || d.stage === stage));
  const filterCount = (q.trim() ? 1 : 0) + (stage !== "all" ? 1 : 0);

  const header = (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <p className="text-sm text-muted-foreground">Your deals — records you created, not company-wide.</p>
      <div className="flex gap-1 rounded-lg border bg-muted/40 p-1" role="group" aria-label="Deals layout">
        <Button size="sm" variant={mode === "table" ? "default" : "ghost"} aria-pressed={mode === "table"} onClick={() => setMode("table")}>Table</Button>
        <Button size="sm" variant={mode === "pipeline" ? "default" : "ghost"} aria-pressed={mode === "pipeline"} onClick={() => setMode("pipeline")}>Reorder pipeline</Button>
      </div>
    </div>
  );

  if (mode === "table") {
    return (
      <div className="space-y-3">
        {header}
        <FilterBar search={q} onSearch={setQ} searchLabel="Search deals" activeCount={filterCount} onClear={() => { setQ(""); setStage("all"); }}
          selects={[{ id: "stage", label: "Stage", value: stage, onChange: setStage, options: [{ value: "all", label: "All stages" }, ...stages.map((s) => ({ value: s, label: statusLabel(s) }))] }]} />
        <DataTable
          caption="Your deals"
          rows={shown}
          rowKey={(d) => d.id}
          filtered={filterCount > 0}
          onClearFilters={() => { setQ(""); setStage("all"); }}
          empty={<p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No deals yet.</p>}
          columns={[
            { id: "title", header: "Deal", sortValue: (d) => d.title, cell: (d) => <span className="font-medium">{d.title}</span> },
            { id: "stage", header: "Stage", sortValue: (d) => d.stage, cell: (d) => <StatusBadge value={d.stage} prefix="Stage" /> },
            { id: "value", header: "Value", className: "text-right", sortValue: (d) => d.value ?? 0, cell: (d) => formatCurrency(d.value || 0, settings?.currency_code || "USD") },
            { id: "probability", header: "Probability", className: "text-right", sortValue: (d) => d.probability ?? 0, cell: (d) => (d.probability != null ? `${d.probability}%` : "—") },
            { id: "close", header: "Close date", sortValue: (d) => d.close_date, cell: (d) => <span className="whitespace-nowrap text-muted-foreground">{d.close_date ? formatDueDate(d.close_date) : "—"}</span> },
          ]}
        />
      </div>
    );
  }

  return (
    <div>
    {header}
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={localDeals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {localDeals.map((deal) => (
            <SortableItem key={deal.id} id={deal.id}>
              <div className="p-4 bg-card border rounded-lg shadow-sm cursor-move">
                <h3 className="font-semibold">{deal.title}</h3>
                <p className="text-sm text-muted-foreground">
                  Value: {formatCurrency(deal.value || 0, settings?.currency_code || "USD")} | Stage: {statusLabel(deal.stage)}
                </p>
              </div>
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
    </div>
  );
};

export default DealsView;
