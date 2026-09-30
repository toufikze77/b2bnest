import { useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useActiveOrganization } from '@/contexts/OrganizationContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { parseAiTemplate, toWorkspaceTemplate, type AiTemplate } from '@/lib/aiTemplateSchema';
import { ConfigState, ERROR_TEXT, generateTemplate, loadAiConfig, type Brief } from '@/services/aiTemplateService';
import type { WorkspaceTemplate } from '@/types/workspaceTemplate';
import AiTemplateEditor from './AiTemplateEditor';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Hands the edited template to the existing create dialog (separate explicit click). */
  onCreate: (t: WorkspaceTemplate) => void;
}

const newKey = () => crypto.randomUUID();

const AiTemplateDialog = ({ open, onClose, onCreate }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organizationId, organization } = useActiveOrganization();
  const { ai_credits_remaining, loading: subLoading } = useSubscription();
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [brief, setBrief] = useState<Brief>({ businessPurpose: '', desiredBoards: '', taskStructure: '', kind: 'auto' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<AiTemplate | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftErrors, setDraftErrors] = useState<string[]>([]);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!open) return;
    setConfig(null);
    loadAiConfig().then(setConfig);
  }, [open]);

  const enabled = config?.state === 'ready' && config.config.paid_generation_enabled && config.config.customer_price_credits != null;
  const price = config?.state === 'ready' ? config.config.customer_price_credits : null;
  const enough = price != null && ai_credits_remaining >= price;
  const briefOk = brief.businessPurpose.trim().length >= 10;

  const generate = async () => {
    if (inFlight.current || !organizationId) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    // One click = one request key; a double-click or network retry reuses it.
    const res = await generateTemplate(organizationId, newKey(), brief);
    inFlight.current = false;
    setBusy(false);
    if (!res.ok) {
      setError(ERROR_TEXT[res.error ?? ''] ?? 'Something went wrong. Nothing was charged.');
      return;
    }
    const parsed = parseAiTemplate(res.template);
    if (!parsed.ok) { setError(ERROR_TEXT.invalid_output); return; }
    setDraft(parsed.template);
    setDraftId(res.templateId ?? null);
    setDraftErrors([]);
  };

  const edit = (next: AiTemplate) => {
    setDraft(next);
    const r = parseAiTemplate(next);
    setDraftErrors('errors' in r ? r.errors : []);
  };

  const create = () => {
    if (!draft) return;
    const r = parseAiTemplate(draft);
    if ('errors' in r) { setDraftErrors(r.errors); return; }
    onCreate(toWorkspaceTemplate((r as { template: AiTemplate }).template, draftId ?? crypto.randomUUID()));
  };

  const close = () => { setDraft(null); setError(null); onClose(); };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Create a template with AI</DialogTitle>
          <DialogDescription>Describe your business and we'll draft boards and tasks you can edit before anything is created.</DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-1 gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm sm:grid-cols-3">
          <div><dt className="text-muted-foreground">Company</dt><dd className="font-medium">{organization?.name ?? 'No company selected'}</dd></div>
          <div><dt className="text-muted-foreground">Cost</dt><dd className="font-medium">{price != null ? `${price} AI credit${price === 1 ? '' : 's'}` : '—'}</dd></div>
          <div><dt className="text-muted-foreground">Your credits</dt><dd className="font-medium">{subLoading ? '…' : ai_credits_remaining}</dd></div>
        </dl>
        <p className="text-sm text-muted-foreground">
          You're only charged when a valid template is produced. If the AI fails or times out, nothing is charged.
          Each click on "Generate" is a new request: generating again costs another credit.
          Editing the preview, saving it and creating a workspace from it are free.
        </p>

        {config === null ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking availability…</div>
        ) : !enabled ? (
          <div role="status" className="rounded-md border border-border p-4 text-sm">
            <p className="font-medium">AI template creation isn't switched on yet.</p>
            <p className="mt-1 text-muted-foreground">You can start from a blank project or pick a ready-made template instead.</p>
          </div>
        ) : draft ? (
          <AiTemplateEditor value={draft} onChange={edit} errors={draftErrors} />
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="ai-purpose">What does your business need to manage?</Label>
              <Textarea id="ai-purpose" maxLength={600} value={brief.businessPurpose} onChange={(e) => setBrief({ ...brief, businessPurpose: e.target.value })} placeholder="e.g. A hair salon managing bookings, stylists' rotas and product stock" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ai-boards">Boards you'd like (optional)</Label>
              <Textarea id="ai-boards" maxLength={400} rows={2} value={brief.desiredBoards} onChange={(e) => setBrief({ ...brief, desiredBoards: e.target.value })} placeholder="e.g. Bookings, Stock, Staff" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ai-tasks">How should tasks be organised? (optional)</Label>
              <Textarea id="ai-tasks" maxLength={400} rows={2} value={brief.taskStructure} onChange={(e) => setBrief({ ...brief, taskStructure: e.target.value })} placeholder="e.g. Grouped by week, with a checklist for each new client" />
            </div>
            <RadioGroup value={brief.kind} onValueChange={(v) => setBrief({ ...brief, kind: v as Brief['kind'] })} className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2"><RadioGroupItem value="auto" /> Let AI decide</label>
              <label className="flex items-center gap-2"><RadioGroupItem value="project" /> One project</label>
              <label className="flex items-center gap-2"><RadioGroupItem value="workspace" /> Workspace with boards</label>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">Only what you type here is sent to the AI. None of your company records are shared.</p>
          </div>
        )}

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {enabled && !draft && !enough && !subLoading && (
          <p role="status" className="text-sm">Not enough credits. You can still start from a blank project for free.</p>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => { close(); navigate('/projects?action=create-project'); }}>Start blank instead</Button>
          {draft ? (
            <Button onClick={create} disabled={draftErrors.length > 0}>
              Create {draft.kind === 'workspace' ? 'workspace' : 'project'}
            </Button>
          ) : (
            <Button onClick={generate} disabled={!enabled || !enough || !briefOk || busy || !organizationId || !user}>
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</> : price != null ? `Generate (${price} credit${price === 1 ? '' : 's'})` : 'Generate'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AiTemplateDialog;
