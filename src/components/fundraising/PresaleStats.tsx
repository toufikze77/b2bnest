
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

interface PresaleStatsProps {
  participants: number;
  currentRaised: string;
  progress: number;
}

const PresaleStats = ({ participants, currentRaised, progress }: PresaleStatsProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Users className="h-5 w-5 mr-2" />
          Presale Stats
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600">Participants</span>
            <span className="font-semibold">{participants.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Funds Raised</span>
            <span className="font-semibold">{currentRaised} ETH</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Success Rate</span>
            <span className="font-semibold text-green-600">{progress.toFixed(1)}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PresaleStats;
