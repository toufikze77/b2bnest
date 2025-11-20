import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, Play, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

interface Execution {
  id: string;
  status: 'success' | 'failed' | 'running' | 'pending';
  started_at: string;
  finished_at?: string;
  duration: number;
  trigger: string;
  nodes_executed: number;
  nodes_total: number;
  error?: string;
}

interface ExecutionHistoryProps {
  workflowId?: string;
}

const ExecutionHistory: React.FC<ExecutionHistoryProps> = ({ workflowId }) => {
  const [executions, setExecutions] = useState<Execution[]>([
    {
      id: '1',
      status: 'success',
      started_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      finished_at: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
      duration: 45000,
      trigger: 'Manual',
      nodes_executed: 5,
      nodes_total: 5
    },
    {
      id: '2',
      status: 'failed',
      started_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      finished_at: new Date(Date.now() - 1000 * 60 * 29).toISOString(),
      duration: 15000,
      trigger: 'Webhook',
      nodes_executed: 3,
      nodes_total: 5,
      error: 'HTTP Request failed: Connection timeout'
    },
    {
      id: '3',
      status: 'success',
      started_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      finished_at: new Date(Date.now() - 1000 * 60 * 59).toISOString(),
      duration: 60000,
      trigger: 'Schedule',
      nodes_executed: 5,
      nodes_total: 5
    }
  ]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'running':
        return <Play className="h-5 w-5 text-blue-600 animate-pulse" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-amber-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'running':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'pending':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    
    return date.toLocaleString();
  };

  const totalExecutions = executions.length;
  const successfulExecutions = executions.filter(e => e.status === 'success').length;
  const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Executions</CardDescription>
            <CardTitle className="text-3xl">{totalExecutions}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Success Rate</CardDescription>
            <CardTitle className="text-3xl text-emerald-600">{successRate}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Avg. Duration</CardDescription>
            <CardTitle className="text-3xl">
              {formatDuration(
                executions.reduce((sum, e) => sum + e.duration, 0) / executions.length || 0
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Execution List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Execution History</CardTitle>
              <CardDescription>Recent workflow executions</CardDescription>
            </div>
            <Button variant="outline" size="sm">
              Clear History
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {executions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No executions yet</p>
                  <p className="text-sm">Run your workflow to see execution history</p>
                </div>
              ) : (
                executions.map((execution) => (
                  <Card key={execution.id} className="border-2">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <div className="mt-1">
                          {getStatusIcon(execution.status)}
                        </div>
                        
                        <div className="flex-1 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className={getStatusColor(execution.status)}>
                                  {execution.status}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  via {execution.trigger}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {formatDateTime(execution.started_at)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">
                                {formatDuration(execution.duration)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {execution.nodes_executed}/{execution.nodes_total} nodes
                              </p>
                            </div>
                          </div>

                          {execution.error && (
                            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-red-900">Error</p>
                                <p className="text-xs text-red-700">{execution.error}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExecutionHistory;
