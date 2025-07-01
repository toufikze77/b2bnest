
import React from 'react';
import { DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CostSummaryCardProps {
  totalCost: number;
  requiredCost: number;
  optionalCost: number;
  businessType: string;
}

const CostSummaryCard = ({ totalCost, requiredCost, optionalCost, businessType }: CostSummaryCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Cost Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              £{totalCost.toLocaleString()}
            </div>
            <div className="text-sm text-blue-600">Total Estimated Cost</div>
          </div>
          
          {businessType && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Required Costs:</span>
                <span className="font-semibold">
                  £{requiredCost.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Optional Costs:</span>
                <span className="font-semibold">
                  £{optionalCost.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CostSummaryCard;
