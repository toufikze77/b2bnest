import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { MessageSquare, Filter, Search, Eye } from 'lucide-react';

interface FeedbackRequest {
  id: string;
  user_id: string;
  type: 'feedback' | 'feature_request';
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'completed' | 'closed';
  admin_response: string | null;
  created_at: string;
  updated_at: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

const FeedbackManagement = () => {
  const [requests, setRequests] = useState<FeedbackRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    type: 'all',
    status: 'all',
    priority: 'all'
  });
  const [search, setSearch] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<FeedbackRequest | null>(null);
  const [adminResponse, setAdminResponse] = useState('');
  const [newStatus, setNewStatus] = useState('');

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
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

      // Handle the case where profiles might be null and ensure proper typing
      const processedData = data?.map(item => ({
        ...item,
        type: item.type as 'feedback' | 'feature_request',
        priority: item.priority as 'low' | 'medium' | 'high',
        status: item.status as 'open' | 'in_progress' | 'completed' | 'closed',
        profiles: item.profiles || { full_name: 'Unknown User', email: 'unknown@example.com' }
      })) || [];

      setRequests(processedData as FeedbackRequest[]);
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast({
        title: "Error",
        description: "Failed to load feedback requests.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRequest = async (requestId: string, updates: Partial<FeedbackRequest>) => {
    try {
      const { error } = await supabase
        .from('feedback_requests')
        .update(updates)
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Request updated successfully.",
      });

      fetchRequests();
      setSelectedRequest(null);
      setAdminResponse('');
      setNewStatus('');
    } catch (error) {
      console.error('Error updating request:', error);
      toast({
        title: "Error",
        description: "Failed to update request.",
        variant: "destructive"
      });
    }
  };

  const filteredRequests = requests.filter(request => {
    const matchesType = filter.type === 'all' || request.type === filter.type;
    const matchesStatus = filter.status === 'all' || request.status === filter.status;
    const matchesPriority = filter.priority === 'all' || request.priority === filter.priority;
    const matchesSearch = search === '' || 
      request.title.toLowerCase().includes(search.toLowerCase()) ||
      request.description.toLowerCase().includes(search.toLowerCase()) ||
      request.profiles.full_name.toLowerCase().includes(search.toLowerCase());

    return matchesType && matchesStatus && matchesPriority && matchesSearch;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'destructive';
      case 'in_progress': return 'secondary';
      case 'completed': return 'default';
      case 'closed': return 'outline';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Feedback & Feature Requests
          </CardTitle>
          <CardDescription>
            Manage user feedback and feature requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              <Input
                placeholder="Search requests..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
              />
            </div>
            
            <Select value={filter.type} onValueChange={(value) => setFilter({...filter, type: value})}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="feedback">Feedback</SelectItem>
                <SelectItem value="feature_request">Feature Request</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filter.status} onValueChange={(value) => setFilter({...filter, status: value})}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filter.priority} onValueChange={(value) => setFilter({...filter, priority: value})}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Requests Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <Badge variant={request.type === 'feedback' ? 'secondary' : 'default'}>
                        {request.type === 'feedback' ? 'Feedback' : 'Feature'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{request.title}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{request.profiles.full_name}</div>
                        <div className="text-sm text-muted-foreground">{request.profiles.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{request.category}</TableCell>
                    <TableCell>
                      <Badge variant={getPriorityColor(request.priority)}>
                        {request.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(request.status)}>
                        {request.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(request.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedRequest(request);
                              setAdminResponse(request.admin_response || '');
                              setNewStatus(request.status);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>{selectedRequest?.title}</DialogTitle>
                            <DialogDescription>
                              {selectedRequest?.type === 'feedback' ? 'User Feedback' : 'Feature Request'} • 
                              Category: {selectedRequest?.category}
                            </DialogDescription>
                          </DialogHeader>
                          
                          {selectedRequest && (
                            <div className="space-y-4">
                              <div>
                                <h4 className="font-medium mb-2">Description</h4>
                                <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                                  {selectedRequest.description}
                                </p>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium">Status</label>
                                  <Select value={newStatus} onValueChange={setNewStatus}>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="open">Open</SelectItem>
                                      <SelectItem value="in_progress">In Progress</SelectItem>
                                      <SelectItem value="completed">Completed</SelectItem>
                                      <SelectItem value="closed">Closed</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Priority</label>
                                  <Badge variant={getPriorityColor(selectedRequest.priority)}>
                                    {selectedRequest.priority}
                                  </Badge>
                                </div>
                              </div>

                              <div>
                                <label className="text-sm font-medium">Admin Response</label>
                                <Textarea
                                  value={adminResponse}
                                  onChange={(e) => setAdminResponse(e.target.value)}
                                  placeholder="Add your response..."
                                  className="mt-1"
                                />
                              </div>

                              <Button 
                                onClick={() => handleUpdateRequest(selectedRequest.id, {
                                  status: newStatus as any,
                                  admin_response: adminResponse
                                })}
                                className="w-full"
                              >
                                Update Request
                              </Button>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredRequests.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No requests found matching your filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FeedbackManagement;