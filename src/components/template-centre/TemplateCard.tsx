import React from 'react';
import { Sparkles, LayoutGrid, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import TemplateThumbnail from '@/components/template-center/TemplateThumbnail';
import { TemplateUsage, WorkspaceTemplate } from '@/types/workspaceTemplate';
import { TEMPLATE_CATEGORIES } from '@/data/workspaceTemplates';

interface Props {
  template: WorkspaceTemplate;
  usage?: TemplateUsage;
  hasPremiumAccess: boolean;
  onPreview: (t: WorkspaceTemplate) => void;
  onUse: (t: WorkspaceTemplate) => void;
}

export const planLabel = (t: WorkspaceTemplate, hasPremiumAccess: boolean) => {
  if (t.plan === 'free') return 'Free';
  if (t.plan === 'premium') return hasPremiumAccess ? 'Included' : 'Premium';
  return 'Included';
};

export const categoryName = (id: string) =>
  TEMPLATE_CATEGORIES.find((c) => c.id === id)?.name ?? 'Templates';

const TemplateCard = ({ template, usage, hasPremiumAccess, onPreview, onUse }: Props) => {
  const uses = usage?.created ?? 0;
  const plan = planLabel(template, hasPremiumAccess);

  return (
    <article
      className="group flex cursor-pointer flex-col rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
      onClick={() => onPreview(template)}
    >
      <div className="mb-4 h-36 rounded-md bg-muted/40 p-2">
        {template.thumbnail ? (
          <img
            src={template.thumbnail}
            alt={`${template.name} template preview`}
            loading="lazy"
            className="h-full w-full rounded-md object-cover"
          />
        ) : (
          <TemplateThumbnail seed={template.slug} title={template.name} />
        )}
      </div>

      <h3 className="text-base font-semibold leading-snug text-foreground">{template.name}</h3>
      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{template.description}</p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="text-[11px] font-normal">
          {categoryName(template.category)}
        </Badge>
        {template.isAiPowered && (
          <Badge className="gap-1 bg-primary/10 text-[11px] text-primary hover:bg-primary/15">
            <Sparkles className="h-3 w-3" /> AI-Powered
          </Badge>
        )}
        <Badge
          variant={plan === 'Premium' ? 'default' : 'secondary'}
          className="text-[11px]"
        >
          {plan}
        </Badge>
      </div>

      {uses > 0 && (
        <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          Used {uses} {uses === 1 ? 'time' : 'times'}
        </p>
      )}

      <div className="mt-4 flex gap-2 border-t border-border pt-3">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={(e) => {
            e.stopPropagation();
            onPreview(template);
          }}
        >
          Preview
        </Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={(e) => {
            e.stopPropagation();
            onUse(template);
          }}
        >
          <LayoutGrid className="mr-1 h-4 w-4" /> Use template
        </Button>
      </div>
    </article>
  );
};

export default TemplateCard;
