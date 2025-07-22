
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Lightbulb, Bug, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FeedbackRequest {
  id: string;
  user_id: string;
  type: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  admin_response: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

const FeedbackManagement = () => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { toast } = useToast();
  const [requests, setRequests] = useState<FeedbackRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<FeedbackRequest | null>(null);
  const [adminResponse, setAdminResponse] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (isAdmin && user) {
      fetchFeedbackRequests();
    }
  }, [isAdmin, user]);

  const fetchFeedbackRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('feedback_requests')
        .select(`
          *,
          profiles (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Error fetching feedback requests:', error);
      toast({
        title: "Error",
        description: "Failed to load feedback requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateRequestStatus = async (requestId: string, status: string, response?: string) => {
    try {
      const updateData: any = { status };
      if (response) {
        updateData.admin_response = response;
      }

      const { error } = await supabase
        .from('feedback_requests')
        .update(updateData)
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Request updated successfully",
      });

      fetchFeedbackRequests();
      setSelectedRequest(null);
      setAdminResponse('');
    } catch (error) {
      console.error('Error updating request:', error);
      toast({
        title: "Error",
        description: "Failed to update request",
        variant: "destructive",
      });
    }
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Access denied. Admin privileges required.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'feedback': return <MessageSquare className="h-4 w-4" />;
      case 'feature_request': return <Lightbulb className="h-4 w-4" />;
      case 'bug_report': return <Bug className="h-4 w-4" />;
      default: return <Star className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'default';
      case 'in_progress': return 'secondary';
      case 'resolved': return 'outline';
      case 'closed': return 'destructive';
      default: return 'default';
    }
  };

  const filteredRequests = statusFilter === 'all' 
    ? requests 
    : requests.filter(req => req.status === statusFilter);

  const feedbackRequests = filteredRequests.filter(req => req.type === 'feedback');
  const featureRequests = filteredRequests.filter(req => req.type === 'feature_request');
  const bugReports = filteredRequests.filter(req => req.type === 'bug_report');

  const RequestCard = ({ request }: { request: FeedbackRequest }) => (
    <Card className="mb-4 cursor-pointer hover:shadow-md transition-shadow" 
          onClick={() => setSelectedRequest(request)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {getTypeIcon(request.type)}
            {request.title}
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant={getPriorityColor(request.priority)}>
              {request.priority}
            </Badge>
            <Badge variant={getStatusColor(request.status)}>
              {request.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-gray-600 mb-2">{request.description}</p>
        <div className="flex justify-between text-sm text-gray-500">
          <span>By: {request.profiles?.full_name || 'Unknown'}</span>
          <span>{new Date(request.created_at).toLocaleDateString()}</span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Feedback Management</h2>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Requests</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{requests.length}</div>
            <div className="text-sm text-gray-500">Total Requests</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {requests.filter(r => r.status === 'resolved').length}
            </div>
            <div className="text-sm text-gray-500">Resolved</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">
              {requests.filter(r => r.status === 'in_progress').length}
            </div>
            <div className="text-sm text-gray-500">In Progress</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">
              {requests.filter(r => r.status === 'open').length}
            </div>
            <div className="text-sm text-gray-500">Open</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All ({filteredRequests.length})</TabsTrigger>
          <TabsTrigger value="feedback">Feedback ({feedbackRequests.length})</TabsTrigger>
          <TabsTrigger value="features">Features ({featureRequests.length})</TabsTrigger>
          <TabsTrigger value="bugs">Bugs ({bugReports.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {filteredRequests.map(request => (
            <RequestCard key={request.id} request={request} />
          ))}
        </TabsContent>

        <TabsContent value="feedback" className="space-y-4">
          {feedbackRequests.map(request => (
            <RequestCard key={request.id} request={request} />
          ))}
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          {featureRequests.map(request => (
            <RequestCard key={request.id} request={request} />
          ))}
        </TabsContent>

        <TabsContent value="bugs" className="space-y-4">
          {bugReports.map(request => (
            <RequestCard key={request.id} request={request} />
          ))}
        </TabsContent>
      </Tabs>

      {selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getTypeIcon(selectedRequest.type)}
                {selectedRequest.title}
              </CardTitle>
              <div className="flex gap-2">
                <Badge variant={getPriorityColor(selectedRequest.priority)}>
                  {selectedRequest.priority}
                </Badge>
                <Badge variant={getStatusColor(selectedRequest.status)}>
                  {selectedRequest.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Description</h4>
                <p className="text-gray-600">{selectedRequest.description}</p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">User Details</h4>
                <p>Name: {selectedRequest.profiles?.full_name || 'Unknown'}</p>
                <p>Email: {selectedRequest.profiles?.email || 'Unknown'}</p>
                <p>Category: {selectedRequest.category}</p>
                <p>Submitted: {new Date(selectedRequest.created_at).toLocaleString()}</p>
              </div>

              {selectedRequest.admin_response && (
                <div>
                  <h4 className="font-semibold mb-2">Admin Response</h4>
                  <p className="text-gray-600 bg-gray-50 p-3 rounded">
                    {selectedRequest.admin_response}
                  </p>
                </div>
              )}

              <div>
                <h4 className="font-semibold mb-2">Admin Response</h4>
                <Textarea
                  value={adminResponse}
                  onChange={(e) => setAdminResponse(e.target.value)}
                  placeholder="Add your response..."
                  className="mb-3"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Select
                  value={selectedRequest.status}
                  onValueChange={(status) => updateRequestStatus(selectedRequest.id, status, adminResponse)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  onClick={() => updateRequestStatus(selectedRequest.id, selectedRequest.status, adminResponse)}
                  disabled={!adminResponse.trim()}
                >
                  Update Response
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedRequest(null);
                    setAdminResponse('');
                  }}
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default FeedbackManagement;
