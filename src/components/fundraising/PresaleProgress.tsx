
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface PresaleProgressProps {
  currentRaised: string;
  hardCap: string;
  softCap: string;
  progress: number;
}

const PresaleProgress = ({ currentRaised, hardCap, softCap, progress }: PresaleProgressProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Presale Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <span>Raised: {currentRaised} ETH</span>
            <span>Hard Cap: {hardCap} ETH</span>
          </div>
          <Progress value={progress} className="h-3" />
          <div className="flex justify-between text-sm text-gray-600">
            <span>Soft Cap: {softCap} ETH</span>
            <span>{progress.toFixed(1)}% Complete</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PresaleProgress;
