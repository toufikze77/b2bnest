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

  // Group deals by stage
  const stages = ['lead', 'qualified', 'proposal', 'negotiation', 'closed'];
  const stageColors = {
    lead: 'bg-gray-100',
    qualified: 'bg-blue-100', 
    proposal: 'bg-yellow-100',
    negotiation: 'bg-purple-100',
    closed: 'bg-green-100'
  };

  const dealsByStage = stages.reduce((acc, stage) => {
    acc[stage] = localDeals.filter(deal => deal.stage === stage);
    return acc;
  }, {} as Record<string, Deal[]>);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {stages.map(stage => (
        <div 
          key={stage} 
          className={`${stageColors[stage]} rounded-lg p-3 min-h-[400px] animate-fade-in`}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold capitalize">{stage}</h3>
            <div className="bg-white/60 rounded px-2 py-1 text-sm font-medium">
              {dealsByStage[stage].length}
            </div>
          </div>
          
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={dealsByStage[stage].map((d) => d.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {dealsByStage[stage].map((deal) => (
                  <SortableItem key={deal.id} id={deal.id}>
                    <div className="p-3 bg-white rounded-lg shadow-sm cursor-move hover:shadow-md transition-shadow">
                      <h4 className="font-medium text-sm mb-1">{deal.title}</h4>
                      <p className="text-xs text-gray-600">
                        ${deal.value || 0}
                      </p>
                      {deal.probability && (
                        <div className="mt-1">
                          <div className="w-full bg-gray-200 rounded-full h-1">
                            <div 
                              className="bg-blue-600 h-1 rounded-full" 
                              style={{ width: `${deal.probability}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-500">{deal.probability}%</span>
                        </div>
                      )}
                    </div>
                  </SortableItem>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      ))}
    </div>
  );
};

export default DealsView;
