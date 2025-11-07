import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { hmrcService } from '@/services/hmrcService';
import { format } from 'date-fns';

type SubmissionLog = {
  id: string;
  submission_type: string;
  submission_id: string | null;
  period: string | null;
  status: string;
  submitted_at: string;
  error_message: string | null;
};

const HMRCSubmissionLogs = () => {
  const [logs, setLogs] = useState<SubmissionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await hmrcService.getSubmissionLogs();
      setLogs(data);
    } catch (error) {
      console.error('Failed to load submission logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted':
      case 'accepted':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'rejected':
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-amber-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variant = status === 'submitted' || status === 'accepted' ? 'default' :
                   status === 'rejected' || status === 'error' ? 'destructive' :
                   'secondary';
    return <Badge variant={variant}>{status}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Submission Audit Logs
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No submissions yet. Submit your first return to see logs here.
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="mt-1">
                    {getStatusIcon(log.status)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{log.submission_type}</span>
                        {log.submission_id && (
                          <Badge variant="outline" className="font-mono text-xs">
                            {log.submission_id}
                          </Badge>
                        )}
                      </div>
                      {getStatusBadge(log.status)}
                    </div>
                    {log.period && (
                      <p className="text-sm text-muted-foreground">Period: {log.period}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(log.submitted_at), 'PPpp')}
                    </p>
                    {log.error_message && (
                      <p className="text-sm text-destructive mt-2">{log.error_message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default HMRCSubmissionLogs;
