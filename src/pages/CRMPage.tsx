import React from 'react';
import { ArrowLeft, Users, Sparkles, Activity, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import CRM from '@/components/CRM';
import Footer from '@/components/Footer';

const StatPill = ({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend?: string;
}) => (
  <div className="glass-panel px-5 py-4 min-w-[160px] flex flex-col gap-1 hover:border-[color:var(--border-strong)] transition-all">
    <span className="text-xs uppercase tracking-[0.14em] text-dim">{label}</span>
    <div className="flex items-baseline gap-2">
      <span className="display-font text-2xl font-semibold">{value}</span>
      {trend && (
        <span className="text-[11px] text-[#73ffb8] flex items-center gap-0.5">
          <ArrowUpRight className="w-3 h-3" />
          {trend}
        </span>
      )}
    </div>
  </div>
);

const CRMPage = () => {
  const navigate = useNavigate();

  return (
    <div className="workspace-midnight">
      {/* Sticky glass header */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-[rgba(7,7,26,0.6)] border-b border-[color:var(--border-soft)]">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="text-soft hover:text-[color:var(--text-hi)] hover:bg-white/5"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="h-6 w-px bg-[color:var(--border-soft)]" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6366f1] to-[#4f46e5] flex items-center justify-center glow-ring">
                <Users className="w-4 h-4 text-white" />
              </div>
              <span className="display-font font-semibold tracking-tight">CRM Workspace</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 accent-chip px-3 py-1.5 rounded-full text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#73ffb8] pulse-dot" />
            Live pipeline
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-6 pt-10 pb-8">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 accent-chip px-3 py-1 rounded-full text-xs mb-5">
              <Sparkles className="w-3 h-3" />
              Customer intelligence, beautifully organized
            </div>
            <h1 className="display-font text-5xl md:text-6xl font-semibold leading-[1.02] tracking-tight">
              Your pipeline,
              <br />
              <span className="bg-gradient-to-r from-[#a5b4fc] via-[#818cf8] to-[#6366f1] bg-clip-text text-transparent">
                in perfect motion.
              </span>
            </h1>
            <p className="text-soft mt-5 text-lg leading-relaxed max-w-xl">
              Track every contact, deal, and conversation in one focused command center —
              inspired by the tools that the world's fastest revenue teams use.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatPill label="Contacts" value="—" trend="live" />
            <StatPill label="Open deals" value="—" />
            <StatPill label="Pipeline" value="$—" />
          </div>
        </div>
      </section>

      {/* Main content surface */}
      <main className="container mx-auto px-6 pb-16">
        <div className="glass-panel-strong p-2 sm:p-4 md:p-6 overflow-hidden">
          <div className="rounded-xl bg-[rgba(7,7,26,0.45)] p-2 sm:p-4 [&_*]:!border-[color:var(--border-soft)]/60">
            <div className="crm-skin">
              <CRM />
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-dim">
          <Activity className="w-3 h-3" />
          Synced with your team — secured by row-level access
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default CRMPage;
