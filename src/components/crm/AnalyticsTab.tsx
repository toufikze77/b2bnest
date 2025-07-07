import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AnalyticsTabProps {
  totalRevenue: number;
}

const AnalyticsTab = ({ totalRevenue }: AnalyticsTabProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Sales Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span>Monthly Target</span>
              <span className="font-semibold">$100,000</span>
            </div>
            <div className="flex justify-between">
              <span>Current Pipeline</span>
              <span className="font-semibold">${Math.round(totalRevenue).toLocaleString()}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-green-500 h-3 rounded-full" 
                style={{ width: `${Math.min((totalRevenue / 100000) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Lead Sources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>Website</span>
              <Badge>45%</Badge>
            </div>
            <div className="flex justify-between">
              <span>Referrals</span>
              <Badge>30%</Badge>
            </div>
            <div className="flex justify-between">
              <span>Social Media</span>
              <Badge>15%</Badge>
            </div>
            <div className="flex justify-between">
              <span>Email Campaign</span>
              <Badge>10%</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsTab;