import { Link } from 'react-router-dom';
import { Mail, MousePointerClick, PauseCircle, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WORKFLOWS_NOT_INCLUDED_MESSAGE } from '../../../supabase/functions/_shared/workflow-access.ts';

/**
 * Shown instead of the editor when the account's plan doesn't include workflows (Solo). A normal state, not an error:
 * no toast, no countdown, no pressure. Saved workflows and past runs stay; they are paused, not deleted.
 */
export function WorkflowsUpgradePanel({ via, savedCount }: { via: 'self' | 'company'; savedCount: number }) {
  return (
    <Card className="mb-6" data-testid="workflows-upgrade">
      <CardHeader>
        <CardTitle className="text-lg">{WORKFLOWS_NOT_INCLUDED_MESSAGE}</CardTitle>
        <CardDescription>
          {via === 'company'
            ? "Your company's plan doesn't include them. The account owner can change the plan."
            : "Your current plan doesn't include them. You can see what each plan includes on the Pricing page."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="grid gap-3 text-sm sm:grid-cols-3">
          <li className="flex gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />Keep emails you send often, such as a payment reminder, and send them again with one click.</li>
          <li className="flex gap-2"><MousePointerClick className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />Fill in a customer's details and check an exact preview before anything is sent.</li>
          <li className="flex gap-2"><History className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />See what happened to every email in the run history.</li>
        </ul>
        {savedCount > 0 && (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <PauseCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Your {savedCount === 1 ? 'saved workflow is' : `${savedCount} saved workflows are`} paused, not deleted. You can still open
            {savedCount === 1 ? ' it' : ' them'} and read past runs. {savedCount === 1 ? 'It runs' : 'They run'} again on Business or Scale.
          </p>
        )}
        <Button asChild variant="outline"><Link to="/pricing">See plans</Link></Button>
      </CardContent>
    </Card>
  );
}
