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

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={localDeals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {localDeals.map((deal) => (
            <SortableItem key={deal.id} id={deal.id}>
              <div className="p-4 bg-white rounded shadow cursor-move">
                <h3 className="font-semibold">{deal.title}</h3>
                <p className="text-sm text-gray-500">
                  Value: ${deal.value || 0} | Stage: {deal.stage}
                </p>
              </div>
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

export default DealsView;
