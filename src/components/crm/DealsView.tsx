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
  DragEndEvent,
  DragOverlay,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Save, X, Plus } from "lucide-react";

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
  sort_order?: number;
}

interface DealsViewProps {
  deals: Deal[];
  onRefresh: () => void;
  onAddDeal?: (dealData: Partial<Deal>) => Promise<any>;
  onUpdateDeal?: (dealId: string, dealData: Partial<Deal>) => Promise<any>;
  onDeleteDeal?: (dealId: string) => Promise<void>;
}

// Droppable column component
const DroppableColumn = ({ stage, children }: { stage: string; children: React.ReactNode }) => {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div 
      ref={setNodeRef} 
      className={`min-h-[400px] transition-colors ${isOver ? 'bg-opacity-80' : ''}`}
    >
      {children}
    </div>
  );
};

// Draggable deal card component
const DealCard = ({ deal, onEdit }: { deal: Deal; onEdit: (deal: Deal) => void }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.5 : 1,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-3 bg-white rounded-lg shadow-sm cursor-move hover:shadow-md transition-all group"
      onDoubleClick={() => onEdit(deal)}
    >
      <div className="flex items-start justify-between">
        <h4 className="font-medium text-sm mb-1 flex-1">{deal.title}</h4>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(deal);
          }}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </div>
      <p className="text-xs text-gray-600 mb-2">
        ${deal.value?.toLocaleString() || 0}
      </p>
      {deal.probability && (
        <div className="mt-1">
          <div className="w-full bg-gray-200 rounded-full h-1">
            <div 
              className="bg-blue-600 h-1 rounded-full transition-all" 
              style={{ width: `${deal.probability}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">{deal.probability}%</span>
        </div>
      )}
      {deal.close_date && (
        <div className="text-xs text-gray-500 mt-1">
          Due: {new Date(deal.close_date).toLocaleDateString()}
        </div>
      )}
    </div>
  );
};

// Edit modal component
const DealEditModal = ({ 
  deal, 
  isOpen, 
  onClose, 
  onSave 
}: { 
  deal: Deal | null; 
  isOpen: boolean; 
  onClose: () => void; 
  onSave: (deal: Deal) => void; 
}) => {
  const [editData, setEditData] = useState<Partial<Deal>>({});

  useEffect(() => {
    if (deal) {
      setEditData({
        title: deal.title,
        value: deal.value,
        probability: deal.probability,
        close_date: deal.close_date,
        notes: deal.notes,
      });
    }
  }, [deal]);

  if (!isOpen || !deal) return null;

  const handleSave = () => {
    onSave({ ...deal, ...editData });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-90vw">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Edit Deal</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Title</label>
            <Input
              value={editData.title || ''}
              onChange={(e) => setEditData({ ...editData, title: e.target.value })}
              placeholder="Deal title"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">Value ($)</label>
            <Input
              type="number"
              value={editData.value || ''}
              onChange={(e) => setEditData({ ...editData, value: parseFloat(e.target.value) || null })}
              placeholder="Deal value"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">Probability (%)</label>
            <Input
              type="number"
              min="0"
              max="100"
              value={editData.probability || ''}
              onChange={(e) => setEditData({ ...editData, probability: parseInt(e.target.value) || null })}
              placeholder="Win probability"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">Close Date</label>
            <Input
              type="date"
              value={editData.close_date ? editData.close_date.split('T')[0] : ''}
              onChange={(e) => setEditData({ ...editData, close_date: e.target.value })}
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">Notes</label>
            <Textarea
              value={editData.notes || ''}
              onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
              placeholder="Deal notes"
              rows={3}
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );
};

const DealsView = ({ deals, onRefresh }: DealsViewProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [localDeals, setLocalDeals] = useState<Deal[]>([]);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8,
    },
  }));

  useEffect(() => {
    setLocalDeals([...deals].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
  }, [deals]);

  const updateDealStage = async (dealId: string, newStage: string) => {
    if (!user?.id) return;
    
    try {
      const { error } = await supabase
        .from("crm_deals")
        .update({ stage: newStage })
        .eq('id', dealId);
        
      if (error) throw error;
      
      toast({ 
        title: "Success", 
        description: `Deal moved to ${newStage}` 
      });
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Error",
        description: error.message || "Failed to update deal stage",
        variant: "destructive",
      });
    }
  };

  const updateDeal = async (updatedDeal: Deal) => {
    if (!user?.id) return;
    
    try {
      const { error } = await supabase
        .from("crm_deals")
        .update({
          title: updatedDeal.title,
          value: updatedDeal.value,
          probability: updatedDeal.probability,
          close_date: updatedDeal.close_date,
          notes: updatedDeal.notes,
        })
        .eq('id', updatedDeal.id);
        
      if (error) throw error;
      
      // Update local state
      setLocalDeals(prev => prev.map(deal => 
        deal.id === updatedDeal.id ? updatedDeal : deal
      ));
      
      toast({ 
        title: "Success", 
        description: "Deal updated successfully" 
      });
      onRefresh();
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Error",
        description: error.message || "Failed to update deal",
        variant: "destructive",
      });
    }
  };

  const handleDragStart = (event: any) => {
    const deal = localDeals.find(d => d.id === event.active.id);
    setActiveDeal(deal || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDeal(null);
    
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    
    // Check if we're dropping on a stage (column)
    const stages = ['lead', 'qualified', 'proposal', 'negotiation', 'closed'];
    if (stages.includes(overId)) {
      const deal = localDeals.find(d => d.id === activeId);
      if (deal && deal.stage !== overId) {
        // Update deal stage
        const updatedDeal = { ...deal, stage: overId };
        setLocalDeals(prev => prev.map(d => d.id === activeId ? updatedDeal : d));
        updateDealStage(activeId, overId);
      }
    }
  };

  const handleDragOver = (event: any) => {
    // This enables dropping on columns
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

  const stageNames = {
    lead: 'Lead',
    qualified: 'Qualified',
    proposal: 'Proposal',
    negotiation: 'Negotiation',
    closed: 'Closed'
  };

  const dealsByStage = stages.reduce((acc, stage) => {
    acc[stage] = localDeals.filter(deal => deal.stage === stage);
    return acc;
  }, {} as Record<string, Deal[]>);

  return (
    <>
      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCenter} 
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {stages.map(stage => (
            <DroppableColumn key={stage} stage={stage}>
              <div className={`${stageColors[stage]} rounded-lg p-3 min-h-[400px] animate-fade-in`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">{stageNames[stage]}</h3>
                  <div className="bg-white/60 rounded px-2 py-1 text-sm font-medium">
                    {dealsByStage[stage].length}
                  </div>
                </div>
                
                <div className="space-y-2">
                  {dealsByStage[stage].map((deal) => (
                    <DealCard 
                      key={deal.id} 
                      deal={deal} 
                      onEdit={setEditingDeal}
                    />
                  ))}
                </div>
              </div>
            </DroppableColumn>
          ))}
        </div>
        
        <DragOverlay>
          {activeDeal ? (
            <DealCard deal={activeDeal} onEdit={() => {}} />
          ) : null}
        </DragOverlay>
      </DndContext>

      <DealEditModal
        deal={editingDeal}
        isOpen={!!editingDeal}
        onClose={() => setEditingDeal(null)}
        onSave={updateDeal}
      />
    </>
  );
};

export default DealsView;