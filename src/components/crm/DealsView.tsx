import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Deal {
  id: string;
  title: string;
  value: number;
  stage: 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed';
  contact: string;
  probability: number;
  closeDate: Date;
}

interface DealsViewProps {
  deals: Deal[];
}

const DealsView = ({ deals }: DealsViewProps) => {
  const stageColumns = [
    { id: 'prospecting', title: 'Prospecting', color: 'bg-gray-100' },
    { id: 'qualification', title: 'Qualification', color: 'bg-blue-100' },
    { id: 'proposal', title: 'Proposal', color: 'bg-yellow-100' },
    { id: 'negotiation', title: 'Negotiation', color: 'bg-orange-100' },
    { id: 'closed', title: 'Closed Won', color: 'bg-green-100' }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {stageColumns.map(stage => (
        <div key={stage.id} className={`${stage.color} rounded-lg p-4 min-h-[600px]`}>
          <h3 className="font-semibold mb-4 flex items-center justify-between">
            {stage.title}
            <Badge variant="secondary">
              {deals.filter(deal => deal.stage === stage.id).length}
            </Badge>
          </h3>
          <div className="space-y-3">
            {deals
              .filter(deal => deal.stage === stage.id)
              .map(deal => (
                <Card key={deal.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-2">{deal.title}</h4>
                    <p className="text-sm text-gray-600 mb-2">{deal.contact}</p>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-green-600">
                        ${deal.value.toLocaleString()}
                      </span>
                      <Badge variant="outline">{deal.probability}%</Badge>
                    </div>
                    <div className="text-xs text-gray-500">
                      Close: {deal.closeDate.toLocaleDateString()}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default DealsView;