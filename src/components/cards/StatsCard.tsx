import { Card, CardContent } from '@/components/ui/card';
import { ReactNode } from 'react';

interface StatsCardProps {
  icon: ReactNode;
  label: string;
  count: number | string;
  className?: string;
}

export default function StatsCard({ icon, label, count, className = "" }: StatsCardProps) {
  return (
    <Card className={`hover:shadow-md transition-shadow ${className}`}>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-muted">{icon}</div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{count}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}