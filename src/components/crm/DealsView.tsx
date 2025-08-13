// hooks/useDragAndDrop.ts
import { useState } from 'react';
import { 
  DragStartEvent, 
  DragEndEvent, 
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';

export interface DragDropConfig<T = any> {
  onItemMove?: (itemId: string, fromColumn: string, toColumn: string) => Promise<void>;
  onItemReorder?: (itemId: string, fromIndex: number, toIndex: number, columnId: string) => Promise<void>;
  onDragStart?: (item: T) => void;
  onDragEnd?: (item: T) => void;
}

export interface Column {
  id: string;
  title: string;
  color?: string;
  items: any[];
}

export const useDragAndDrop = <T = any>(config: DragDropConfig<T> = {}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<T | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    
    const item = active.data.current?.item as T;
    setActiveItem(item);
    config.onDragStart?.(item);
  };

  const handleDragOver = async (event: DragOverEvent) => {
    const { active, over } = event;
    
    if (!over) return;

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    // Handle item moving between columns
    if (activeType === 'item' && overType === 'column') {
      const activeItem = active.data.current?.item;
      const activeColumn = active.data.current?.columnId;
      const overColumn = over.data.current?.column;
      
      if (activeItem && overColumn && activeColumn !== overColumn.id) {
        await config.onItemMove?.(activeItem.id, activeColumn, overColumn.id);
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (activeItem) {
      config.onDragEnd?.(activeItem);
    }
    
    setActiveId(null);
    setActiveItem(null);

    if (!over) return;

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    // Handle final drop logic
    if (activeType === 'item') {
      if (overType === 'column') {
        const activeItem = active.data.current?.item;
        const activeColumn = active.data.current?.columnId;
        const overColumn = over.data.current?.column;
        
        if (activeItem && overColumn && activeColumn !== overColumn.id) {
          await config.onItemMove?.(activeItem.id, activeColumn, overColumn.id);
        }
      } else if (overType === 'item') {
        // Handle reordering within the same column
        const activeItem = active.data.current?.item;
        const activeColumnId = active.data.current?.columnId;
        const overItem = over.data.current?.item;
        const overColumnId = over.data.current?.columnId;
        
        if (activeItem && overItem && activeColumnId === overColumnId) {
          // You would need to pass column data to determine indices
          // This is a simplified version
          await config.onItemReorder?.(activeItem.id, 0, 1, activeColumnId);
        }
      }
    }
  };

  return {
    sensors,
    activeId,
    activeItem,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
};

// components/DragDrop/DraggableCard.tsx
import React, { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { GripVertical } from 'lucide-react';

interface DraggableCardProps {
  id: string;
  item: any;
  columnId: string;
  children: ReactNode;
  className?: string;
  showGrip?: boolean;
}

export const DraggableCard: React.FC<DraggableCardProps> = ({
  id,
  item,
  columnId,
  children,
  className = '',
  showGrip = true,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    data: {
      type: 'item',
      item,
      columnId,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`cursor-pointer hover:shadow-md transition-shadow ${
        isDragging ? 'opacity-50 rotate-2' : ''
      } ${className}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-2">
          {showGrip && (
            <div
              className="cursor-grab hover:cursor-grabbing text-gray-400 hover:text-gray-600 mt-1"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="w-4 h-4" />
            </div>
          )}
          <div className="flex-1">
            {children}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// components/DragDrop/DroppableColumn.tsx
import React, { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Badge } from '@/components/ui/badge';

interface DroppableColumnProps {
  id: string;
  title: string;
  items: any[];
  color?: string;
  children: ReactNode;
  className?: string;
  showCount?: boolean;
  subtitle?: string;
}

export const DroppableColumn: React.FC<DroppableColumnProps> = ({
  id,
  title,
  items,
  color = 'bg-gray-100 border-gray-300',
  children,
  className = '',
  showCount = true,
  subtitle,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      type: 'column',
      column: { id, title, color },
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`${color} border-2 border-dashed rounded-lg p-4 min-h-[500px] min-w-[300px] transition-colors ${
        isOver ? 'border-solid bg-opacity-50' : ''
      } ${className
