export const priorityColors: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
  urgent: 'bg-red-600',
  normal: 'bg-blue-500',
};

export const statusColors: Record<string, string> = {
  'todo': 'bg-gray-100 text-gray-800 border-gray-200',
  'in-progress': 'bg-blue-100 text-blue-800 border-blue-200',
  'done': 'bg-green-100 text-green-800 border-green-200',
  'blocked': 'bg-red-100 text-red-800 border-red-200',
};

export const projectStatusColors: Record<string, string> = {
  'active': 'bg-green-100 text-green-800 border-green-200',
  'completed': 'bg-blue-100 text-blue-800 border-blue-200',
  'on-hold': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'cancelled': 'bg-red-100 text-red-800 border-red-200',
};