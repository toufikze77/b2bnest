import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Brain,
  MessageSquare,
  FileText,
  BarChart3,
  Camera,
  KanbanSquare,
  Briefcase,
  Sparkles,
  PartyPopper,
  ArrowLeft,
  ArrowRight,
  X,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';

export const TOUR_EVENT = 'b2bnest:start-tour';
const storageKey = (userId: string) => `b2bnest_welcome_tour_${userId}`;

/** Fires the tour from anywhere in the app (e.g. a "Replay tour" button). */
export const startWelcomeTour = () => window.dispatchEvent(new Event(TOUR_EVENT));

interface TourStep {
  icon: typeof Brain;
  title: string;
  body: string;
  cta?: { label: string; to: string };
  accent: string;
}

const STEPS: TourStep[] = [
  {
    icon: PartyPopper,
    title: 'Welcome to B2BNest! 🎉',
    body: "Let's take a quick tour of the platform. We'll show you the features that save our members 20+ hours every week.",
    accent: 'from-primary/20 to-primary/5',
  },
  {
    icon: Brain,
    title: 'AI Studio — your business brain 🧠',
    body: 'A full suite of AI tools in one place: business advisor, document generator, image creation and analytics. Think of it as ChatGPT built specifically for your business.',
    cta: { label: 'Open AI Studio', to: '/ai-studio' },
    accent: 'from-violet-500/20 to-violet-500/5',
  },
  {
    icon: MessageSquare,
    title: 'AI Assistant — your 24/7 helper 💬',
    body: 'Ask questions about your business in plain English. The assistant works with your own data to give instant insights and recommendations.',
    cta: { label: 'Try the assistant', to: '/ai-workspace' },
    accent: 'from-sky-500/20 to-sky-500/5',
  },
  {
    icon: FileText,
    title: 'Smart invoicing 📋',
    body: 'Create branded invoices and quotes in seconds, pick from five professional templates, and track what has been paid — all from Business Finance.',
    cta: { label: 'Create an invoice', to: '/business-tools' },
    accent: 'from-emerald-500/20 to-emerald-500/5',
  },
  {
    icon: BarChart3,
    title: 'Business overview & analytics 📊',
    body: 'One unified view of revenue, clients, projects and cash flow across your whole account — so nothing lives in a silo.',
    cta: { label: 'View overview', to: '/business-overview' },
    accent: 'from-amber-500/20 to-amber-500/5',
  },
  {
    icon: Camera,
    title: 'Expenses & receipts 📸',
    body: 'Log expenses, categorise spend and keep receipts against every transaction so month-end reconciliation takes minutes, not evenings.',
    cta: { label: 'Track expenses', to: '/business-tools' },
    accent: 'from-rose-500/20 to-rose-500/5',
  },
  {
    icon: KanbanSquare,
    title: 'Projects, CRM & lead scoring 🎯',
    body: 'Run projects on Kanban boards with timelines and goals, and capture leads with automatic lead scoring so you chase your best prospects first.',
    cta: { label: 'Open projects', to: '/project-management' },
    accent: 'from-indigo-500/20 to-indigo-500/5',
  },
  {
    icon: Briefcase,
    title: 'UK payroll & HMRC 💼',
    body: 'PAYE payroll with UK tax and NI rates, payslips and HMRC-ready submissions — with checks that flag anomalies before you file.',
    cta: { label: 'See payroll', to: '/business-tools' },
    accent: 'from-teal-500/20 to-teal-500/5',
  },
  {
    icon: Sparkles,
    title: "You're all set! ✨",
    body: 'That is the quick tour. Bring your existing contacts, projects and documents across from the Onboarding & Migration hub whenever you are ready.',
    cta: { label: 'Import my data', to: '/onboarding' },
    accent: 'from-primary/20 to-primary/5',
  },
];

const WelcomeTour = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Auto-open once per new account.
  useEffect(() => {
    if (!user) return;
    if (localStorage.getItem(storageKey(user.id))) return;
    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, [user]);

  // Manual replay from anywhere.
  useEffect(() => {
    const handler = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(TOUR_EVENT, handler);
    return () => window.removeEventListener(TOUR_EVENT, handler);
  }, []);

  const finish = useCallback(() => {
    if (user) localStorage.setItem(storageKey(user.id), new Date().toISOString());
    setOpen(false);
    setStep(0);
  }, [user]);

  if (!user) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && finish()}>
      <DialogContent className="max-w-lg overflow-hidden p-0" hideCloseButton>
        <div className={`bg-gradient-to-br ${current.accent} px-6 pb-5 pt-6`}>
          <div className="flex items-start justify-between">
            <div className="rounded-xl bg-background/80 p-3 shadow-sm">
              <Icon className="h-7 w-7 text-primary" />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={finish}
              aria-label="Skip the tour"
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="mt-4 text-2xl font-bold text-foreground">{current.title}</h2>
        </div>

        <div className="space-y-5 px-6 pb-6 pt-4">
          <p className="text-sm leading-relaxed text-muted-foreground">{current.body}</p>

          {current.cta && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                finish();
                navigate(current.cta!.to);
              }}
            >
              {current.cta.label}
            </Button>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Step {step + 1} of {STEPS.length}
              </span>
              <button type="button" onClick={finish} className="underline-offset-2 hover:underline">
                Skip tour
              </button>
            </div>
            <Progress value={((step + 1) / STEPS.length) * 100} className="h-1.5" />
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <Button onClick={() => (isLast ? finish() : setStep((s) => s + 1))}>
              {isLast ? "Let's get started" : 'Next'}
              {!isLast && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WelcomeTour;
