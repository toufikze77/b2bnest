import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Crown, Check, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PlanUpgradeDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentCount: number;
}

export const PlanUpgradeDialog: React.FC<PlanUpgradeDialogProps> = ({ 
  isOpen, 
  onOpenChange, 
  currentCount 
}) => {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate('/pricing');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Crown className="h-6 w-6 text-yellow-500" />
            Upgrade Required
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-4">
              <Zap className="h-8 w-8 text-yellow-600" />
            </div>
            <p className="text-gray-600">
              You've reached your limit of <strong>10 tasks</strong> on the free plan.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Currently: {currentCount} tasks
            </p>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <h3 className="font-semibold mb-2">Upgrade to Pro Plan</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Unlimited tasks
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Advanced project management
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Team collaboration
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Priority support
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Maybe Later
            </Button>
            <Button onClick={handleUpgrade} className="flex-1">
              Upgrade Now
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};