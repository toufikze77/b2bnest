
export interface CostItem {
  name: string;
  cost: number;
  required: boolean;
  category: string;
}

export const businessCosts: Record<string, CostItem[]> = {
  llc: [
    { name: 'State Filing Fee', cost: 150, required: true, category: 'Legal' },
    { name: 'Registered Agent Service', cost: 100, required: true, category: 'Legal' },
    { name: 'Operating Agreement', cost: 200, required: false, category: 'Legal' },
    { name: 'EIN Application', cost: 0, required: true, category: 'Tax' },
    { name: 'Business License', cost: 75, required: true, category: 'Legal' },
    { name: 'Professional Liability Insurance', cost: 500, required: false, category: 'Insurance' },
  ],
  corporation: [
    { name: 'State Filing Fee', cost: 300, required: true, category: 'Legal' },
    { name: 'Registered Agent Service', cost: 150, required: true, category: 'Legal' },
    { name: 'Corporate Bylaws', cost: 300, required: true, category: 'Legal' },
    { name: 'Stock Certificates', cost: 100, required: true, category: 'Legal' },
    { name: 'Board Resolutions', cost: 150, required: true, category: 'Legal' },
    { name: 'Directors & Officers Insurance', cost: 1200, required: false, category: 'Insurance' },
  ],
  partnership: [
    { name: 'Partnership Agreement', cost: 250, required: true, category: 'Legal' },
    { name: 'Business License', cost: 75, required: true, category: 'Legal' },
    { name: 'EIN Application', cost: 0, required: true, category: 'Tax' },
    { name: 'Partnership Insurance', cost: 400, required: false, category: 'Insurance' },
  ],
  soleprop: [
    { name: 'Business License', cost: 50, required: true, category: 'Legal' },
    { name: 'DBA Filing', cost: 40, required: false, category: 'Legal' },
    { name: 'Business Insurance', cost: 300, required: false, category: 'Insurance' },
  ]
};
