
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CostItem } from './businessCostsData';

interface CostItemsListProps {
  requiredItems: CostItem[];
  optionalItems: CostItem[];
  selectedItems: string[];
  onItemToggle: (itemName: string) => void;
}

const CostItemsList = ({ requiredItems, optionalItems, selectedItems, onItemToggle }: CostItemsListProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Required Documents & Fees</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {requiredItems.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div>
                  <div className="font-medium">{item.name}</div>
                  <Badge variant="destructive" className="mt-1">Required</Badge>
                </div>
                <div className="font-bold text-red-600">
                  {item.cost === 0 ? 'Free' : `$${item.cost}`}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Optional Add-ons</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {optionalItems.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(item.name)}
                    onChange={() => onItemToggle(item.name)}
                    className="rounded"
                  />
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <Badge variant="outline" className="mt-1">{item.category}</Badge>
                  </div>
                </div>
                <div className="font-bold text-gray-600">
                  ${item.cost}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CostItemsList;
