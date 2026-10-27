import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface PlanUpgradeDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentCount: number;
}

/** The quick to-do list holds 10 tasks for everyone. Projects has no such limit. (Name kept for existing imports.) */
export const PlanUpgradeDialog: React.FC<PlanUpgradeDialogProps> = ({ isOpen, onOpenChange, currentCount }) => {
  const navigate = useNavigate();
  const openProjects = () => {
    onOpenChange(false);
    navigate('/project-management?create=task');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">The quick list is full</DialogTitle>
          <DialogDescription>
            The quick to-do list holds <strong>10 tasks</strong> (you have {currentCount}). Finish or delete one, or add the task in Projects, which has no limit.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Close</Button>
          <Button onClick={openProjects} className="flex-1">Open Projects</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
