import React, { useRef, useState, useEffect } from 'react';
import { WorkflowNode } from '@/pages/WorkflowStudio';
import { Trash2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WorkflowCanvasProps {
  nodes: WorkflowNode[];
  selectedNode: WorkflowNode | null;
  onNodeSelect: (node: WorkflowNode) => void;
  onNodeUpdate: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  onNodeDelete: (nodeId: string) => void;
  onNodeConnect: (fromId: string, toId: string) => void;
}

const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  nodes,
  selectedNode,
  onNodeSelect,
  onNodeUpdate,
  onNodeDelete,
  onNodeConnect
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'trigger':
        return 'bg-emerald-100 border-emerald-300 text-emerald-900';
      case 'action':
        return 'bg-blue-100 border-blue-300 text-blue-900';
      case 'condition':
        return 'bg-amber-100 border-amber-300 text-amber-900';
      case 'transform':
        return 'bg-purple-100 border-purple-300 text-purple-900';
      case 'integration':
        return 'bg-pink-100 border-pink-300 text-pink-900';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-900';
    }
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'trigger':
        return '⚡';
      case 'action':
        return '⚙️';
      case 'condition':
        return '❓';
      case 'transform':
        return '🔄';
      case 'integration':
        return '🔌';
      default:
        return '📋';
    }
  };

  const handleMouseDown = (nodeId: string, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setDraggingNode(nodeId);
      setDragOffset({
        x: e.clientX - node.position.x,
        y: e.clientY - node.position.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNode) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      onNodeUpdate(draggingNode, {
        position: { x: newX, y: newY }
      });
    }
  };

  const handleMouseUp = () => {
    setDraggingNode(null);
  };

  const handleConnectStart = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConnectingFrom(nodeId);
  };

  const handleConnectEnd = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (connectingFrom && connectingFrom !== nodeId) {
      onNodeConnect(connectingFrom, nodeId);
    }
    setConnectingFrom(null);
  };

  const renderConnection = (from: WorkflowNode, toId: string) => {
    const to = nodes.find(n => n.id === toId);
    if (!to) return null;

    const fromX = from.position.x + 150;
    const fromY = from.position.y + 40;
    const toX = to.position.x;
    const toY = to.position.y + 40;

    const midX = (fromX + toX) / 2;

    return (
      <path
        key={`${from.id}-${toId}`}
        d={`M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`}
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        fill="none"
        markerEnd="url(#arrowhead)"
      />
    );
  };

  return (
    <div
      ref={canvasRef}
      className="relative w-full h-full bg-gradient-to-br from-muted/20 to-muted/40 overflow-auto"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* SVG for connections */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3, 0 6"
              fill="hsl(var(--primary))"
            />
          </marker>
        </defs>
        {nodes.map(node =>
          node.connections.map(toId => renderConnection(node, toId))
        )}
      </svg>

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(hsl(var(--border)) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px'
        }}
      />

      {/* Nodes */}
      {nodes.map(node => (
        <div
          key={node.id}
          className={`absolute w-[300px] p-4 border-2 rounded-lg shadow-lg cursor-move transition-all ${
            getNodeColor(node.type)
          } ${selectedNode?.id === node.id ? 'ring-2 ring-primary ring-offset-2' : ''}`}
          style={{
            left: node.position.x,
            top: node.position.y,
            zIndex: draggingNode === node.id ? 1000 : 1
          }}
          onMouseDown={(e) => handleMouseDown(node.id, e)}
          onClick={() => onNodeSelect(node)}
        >
          {/* Node Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{getNodeIcon(node.type)}</span>
              <div>
                <p className="font-semibold text-sm">{node.name}</p>
                <p className="text-xs opacity-70">{node.category}</p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onNodeSelect(node);
                }}
              >
                <Settings className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:bg-destructive/20"
                onClick={(e) => {
                  e.stopPropagation();
                  onNodeDelete(node.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Node Content */}
          <div className="text-xs opacity-80 mb-3 line-clamp-2">
            {node.config.description || 'Click to configure...'}
          </div>

          {/* Connection Points */}
          <div className="flex justify-between items-center">
            <div
              className="w-4 h-4 rounded-full bg-primary cursor-pointer hover:scale-125 transition-transform"
              title="Connect from here"
              onMouseDown={(e) => handleConnectStart(node.id, e)}
            />
            <div
              className="w-4 h-4 rounded-full border-2 border-primary cursor-pointer hover:scale-125 transition-transform"
              title="Connect to here"
              onMouseUp={(e) => handleConnectEnd(node.id, e)}
            />
          </div>
        </div>
      ))}

      {/* Empty State */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p className="text-xl font-semibold mb-2">Start Building Your Workflow</p>
            <p className="text-sm">Drag nodes from the sidebar to begin</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowCanvas;
