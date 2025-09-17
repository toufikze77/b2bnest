import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  FileText,
  Building,
  Users,
  Calculator,
  RefreshCw,
  Bell,
  Filter
} from 'lucide-react';
import { format, isAfter, isBefore, addDays } from 'date-fns';

type Obligation = {
  id: string;
  type: 'VAT' | 'PAYE' | 'Corporation Tax' | 'Self Assessment';
  description: string;
  dueDate: string;
  status: 'outstanding' | 'fulfilled' | 'overdue';
  periodStart?: string;
  periodEnd?: string;
  received?: string;
};

const HMRCObligations = () => {
  const [obligations] = useState<Obligation[]>([
    {
      id: '1',
      type: 'VAT',
      description: 'VAT Return for period ending 31/12/2024',
      dueDate: '2025-02-07',
      status: 'outstanding',
      periodStart: '2024-10-01',
      periodEnd: '2024-12-31'
    },
    {
      id: '2',
      type: 'PAYE',
      description: 'Real Time Information (RTI) submission',
      dueDate: '2024-10-19',
      status: 'fulfilled',
      periodStart: '2024-09-01',
      periodEnd: '2024-09-30',
      received: '2024-10-15'
    },
    {
      id: '3',
      type: 'Corporation Tax',
      description: 'Corporation Tax return for year ending 31/03/2024',
      dueDate: '2024-12-31',
      status: 'outstanding',
      periodStart: '2023-04-01',
      periodEnd: '2024-03-31'
    },
    {
      id: '4',
      type: 'Self Assessment',
      description: 'Self Assessment return 2023-24',
      dueDate: '2025-01-31',
      status: 'outstanding',
      periodStart: '2023-04-06',
      periodEnd: '2024-04-05'
    },
    {
      id: '5',
      type: 'VAT',
      description: 'VAT Return for period ending 30/09/2024',
      dueDate: '2024-11-07',
      status: 'overdue',
      periodStart: '2024-07-01',
      periodEnd: '2024-09-30'
    }
  ]);

  const [filter, setFilter] = useState<'all' | 'outstanding' | 'overdue' | 'fulfilled'>('all');

  const getStatusColor = (status: Obligation['status']) => {
    switch (status) {
      case 'fulfilled': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getStatusIcon = (status: Obligation['status']) => {
    switch (status) {
      case 'fulfilled': return <CheckCircle className="h-4 w-4" />;
      case 'overdue': return <AlertTriangle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getTypeIcon = (type: Obligation['type']) => {
    switch (type) {
      case 'VAT': return <FileText className="h-4 w-4" />;
      case 'PAYE': return <Users className="h-4 w-4" />;
      case 'Corporation Tax': return <Building className="h-4 w-4" />;
      case 'Self Assessment': return <Calculator className="h-4 w-4" />;
      default: return <Calendar className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: Obligation['type']) => {
    switch (type) {
      case 'VAT': return 'bg-blue-100 text-blue-800';
      case 'PAYE': return 'bg-green-100 text-green-800';
      case 'Corporation Tax': return 'bg-purple-100 text-purple-800';
      case 'Self Assessment': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDaysUntilDue = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const filteredObligations = obligations.filter(obligation => {
    if (filter === 'all') return true;
    return obligation.status === filter;
  });

  const outstandingCount = obligations.filter(o => o.status === 'outstanding').length;
  const overdueCount = obligations.filter(o => o.status === 'overdue').length;
  const upcomingCount = obligations.filter(o => {
    const daysUntil = getDaysUntilDue(o.dueDate);
    return o.status === 'outstanding' && daysUntil <= 30 && daysUntil >= 0;
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">HMRC Obligations</h2>
          <p className="text-gray-600">Track all your tax and compliance deadlines</p>
        </div>
        <Button variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh from HMRC
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{outstandingCount}</p>
                <p className="text-sm text-gray-600">Outstanding</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{overdueCount}</p>
                <p className="text-sm text-gray-600">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{upcomingCount}</p>
                <p className="text-sm text-gray-600">Due in 30 days</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{obligations.filter(o => o.status === 'fulfilled').length}</p>
                <p className="text-sm text-gray-600">Fulfilled</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {overdueCount > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Overdue Obligations</AlertTitle>
          <AlertDescription>
            You have {overdueCount} overdue obligation{overdueCount !== 1 ? 's' : ''}. 
            Late submissions may result in penalties. Please submit immediately.
          </AlertDescription>
        </Alert>
      )}

      {upcomingCount > 0 && (
        <Alert>
          <Bell className="h-4 w-4" />
          <AlertTitle>Upcoming Deadlines</AlertTitle>
          <AlertDescription>
            You have {upcomingCount} obligation{upcomingCount !== 1 ? 's' : ''} due in the next 30 days. 
            Plan your submissions to avoid last-minute issues.
          </AlertDescription>
        </Alert>
      )}

      {/* Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button 
          variant={filter === 'all' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setFilter('all')}
        >
          <Filter className="h-4 w-4 mr-1" />
          All ({obligations.length})
        </Button>
        <Button 
          variant={filter === 'outstanding' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setFilter('outstanding')}
        >
          Outstanding ({outstandingCount})
        </Button>
        <Button 
          variant={filter === 'overdue' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setFilter('overdue')}
        >
          Overdue ({overdueCount})
        </Button>
        <Button 
          variant={filter === 'fulfilled' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setFilter('fulfilled')}
        >
          Fulfilled ({obligations.filter(o => o.status === 'fulfilled').length})
        </Button>
      </div>

      {/* Obligations List */}
      <div className="grid gap-4">
        {filteredObligations.map((obligation) => {
          const daysUntilDue = getDaysUntilDue(obligation.dueDate);
          
          return (
            <Card key={obligation.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge className={`${getTypeColor(obligation.type)} text-xs`}>
                        {getTypeIcon(obligation.type)}
                        <span className="ml-1">{obligation.type}</span>
                      </Badge>
                      <Badge className={getStatusColor(obligation.status)}>
                        {getStatusIcon(obligation.status)}
                        <span className="ml-1 capitalize">{obligation.status}</span>
                      </Badge>
                      {obligation.status === 'outstanding' && daysUntilDue <= 7 && daysUntilDue >= 0 && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Due in {daysUntilDue} day{daysUntilDue !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    
                    <h3 className="text-lg font-semibold mb-2">{obligation.description}</h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Due Date</p>
                        <p className="font-medium">{format(new Date(obligation.dueDate), 'dd MMM yyyy')}</p>
                      </div>
                      {obligation.periodStart && obligation.periodEnd && (
                        <div>
                          <p className="text-gray-600">Period</p>
                          <p className="font-medium">
                            {format(new Date(obligation.periodStart), 'dd MMM')} - {format(new Date(obligation.periodEnd), 'dd MMM yyyy')}
                          </p>
                        </div>
                      )}
                      {obligation.received && (
                        <div>
                          <p className="text-gray-600">Received</p>
                          <p className="font-medium">{format(new Date(obligation.received), 'dd MMM yyyy')}</p>
                        </div>
                      )}
                      {obligation.status === 'outstanding' && (
                        <div>
                          <p className="text-gray-600">Days Until Due</p>
                          <p className={`font-medium ${daysUntilDue < 0 ? 'text-red-600' : daysUntilDue <= 7 ? 'text-amber-600' : 'text-gray-900'}`}>
                            {daysUntilDue < 0 ? `${Math.abs(daysUntilDue)} days overdue` : `${daysUntilDue} days`}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {obligation.status === 'outstanding' && (
                      <Button size="sm">
                        Submit Return
                      </Button>
                    )}
                    {obligation.status === 'overdue' && (
                      <Button size="sm" variant="destructive">
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Submit Now
                      </Button>
                    )}
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredObligations.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No {filter === 'all' ? '' : filter} obligations</h3>
              <p className="text-gray-600">
                {filter === 'all' 
                  ? 'No obligations found.'
                  : `You have no ${filter} obligations at this time.`
                }
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default HMRCObligations;