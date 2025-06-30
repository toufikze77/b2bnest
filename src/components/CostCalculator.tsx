
import React, { useState } from 'react';
import { Calculator } from 'lucide-react';
import BusinessConfigurationForm from './calculator/BusinessConfigurationForm';
import CostSummaryCard from './calculator/CostSummaryCard';
import CostItemsList from './calculator/CostItemsList';
import { businessCosts, CostItem } from './calculator/businessCostsData';

const CostCalculator = () => {
  const [businessType, setBusinessType] = useState('');
  const [businessSize, setBusinessSize] = useState('');
  const [state, setState] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const handleItemToggle = (itemName: string) => {
    setSelectedItems(prev => 
      prev.includes(itemName)
        ? prev.filter(item => item !== itemName)
        : [...prev, itemName]
    );
  };

  const calculateTotal = () => {
    if (!businessType) return 0;
    
    const costs = businessCosts[businessType] || [];
    const requiredCosts = costs.filter(item => item.required).reduce((sum, item) => sum + item.cost, 0);
    const optionalCosts = costs
      .filter(item => !item.required && selectedItems.includes(item.name))
      .reduce((sum, item) => sum + item.cost, 0);
    
    return requiredCosts + optionalCosts;
  };

  const getRequiredCosts = () => {
    if (!businessType) return [];
    return businessCosts[businessType]?.filter(item => item.required) || [];
  };

  const getOptionalCosts = () => {
    if (!businessType) return [];
    return businessCosts[businessType]?.filter(item => !item.required) || [];
  };

  const requiredCost = getRequiredCosts().reduce((sum, item) => sum + item.cost, 0);
  const optionalCost = getOptionalCosts()
    .filter(item => selectedItems.includes(item.name))
    .reduce((sum, item) => sum + item.cost, 0);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Business Setup Cost Calculator</h2>
        </div>
        <p className="text-gray-600">
          Calculate the estimated costs for setting up your business structure and getting all necessary documents.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BusinessConfigurationForm
          businessType={businessType}
          businessSize={businessSize}
          state={state}
          onBusinessTypeChange={setBusinessType}
          onBusinessSizeChange={setBusinessSize}
          onStateChange={setState}
        />

        <CostSummaryCard
          totalCost={calculateTotal()}
          requiredCost={requiredCost}
          optionalCost={optionalCost}
          businessType={businessType}
        />
      </div>

      {businessType && (
        <div className="mt-8">
          <CostItemsList
            requiredItems={getRequiredCosts()}
            optionalItems={getOptionalCosts()}
            selectedItems={selectedItems}
            onItemToggle={handleItemToggle}
          />
        </div>
      )}
    </div>
  );
};

export default CostCalculator;
