import React from 'react';
import { Brain, Zap, Briefcase, Users, Calendar, BarChart3, Workflow, LayoutDashboard, CreditCard, Search, Sparkles, DollarSign, Globe } from 'lucide-react';

const AIInvestmentShowcase = () => {
  // Only what B2BNEST does today. Services that are planned, switched off or not built are not listed.
  const coreSolutions = [
    { icon: Users, title: 'CRM', desc: 'Keep contacts and deals in one place, with a deal pipeline and reports built from your own data.' },
    { icon: LayoutDashboard, title: 'Projects and tasks', desc: 'Plan projects and tasks with priorities and due dates, as a list, board or calendar.' },
    { icon: CreditCard, title: 'Invoices and quotes', desc: 'Create invoices and quotes, mark them sent or paid, each in its own currency.' },
    { icon: BarChart3, title: 'Money out and overview', desc: 'Track expenses, outgoings and suppliers, and see the totals on your business overview.' },
    { icon: Calendar, title: 'Notes with reminders', desc: 'Write notes with lists and checklists, and get a reminder inside B2BNEST when the time comes.' },
    { icon: Briefcase, title: 'Business templates', desc: 'Start a project, workspace or document from a ready-made template and adapt it.' },
    { icon: Workflow, title: 'Workflows', desc: 'List steps once and run them with one click. Email steps are switched on today.' },
    { icon: Brain, title: 'AI Business Advisor', desc: 'Ask business questions and get suggestions from an AI model, using your monthly AI credits.' },
    { icon: Search, title: 'Integration Hub', desc: 'Connect calendars, OneDrive and social accounts through each service\'s own sign-in page.' },
  ];

  const aiBenefits = [
    'Ask the AI Business Advisor questions about your business',
    'Generate a first draft of a template with AI',
    'Every AI request uses credits from your plan, so costs are clear',
  ];

  const replacedTools = [
    'A separate CRM for contacts and deals',
    'A separate project and task tool',
    'A separate invoicing and quotes tool',
    'Separate notes and reminders',
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-indigo-900 via-purple-900 to-pink-900">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20 mb-6">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            <span className="text-white text-sm font-medium">Business tools in one place</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            🚀 B2BNEST — Run Your Entire Business <span className="text-cyan-400">From One Platform</span>
          </h2>
          <p className="text-xl text-gray-200 max-w-3xl mx-auto">
            B2BNEST brings a CRM, projects and tasks, invoicing, notes, templates and AI tools together, so you can run more of your business from one place.
          </p>
          <p className="text-lg text-gray-300 max-w-3xl mx-auto mt-4">
            Built for start-ups, freelancers and small and medium-sized businesses.
          </p>
        </div>

        {/* Core Business Solutions */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-white mb-3">💼 Core Business Solutions</h3>
            <p className="text-gray-300">What you can use today.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coreSolutions.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-colors">
                  <Icon className="h-8 w-8 text-cyan-400 mb-3" />
                  <div className="text-white font-semibold mb-2">{s.title}</div>
                  <div className="text-gray-300 text-sm">{s.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Powered by AI + Lower SaaS Costs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
            <div className="flex items-center mb-6">
              <Brain className="h-8 w-8 text-cyan-400 mr-3" />
              <h3 className="text-2xl font-bold text-white">🧠 Powered by AI</h3>
            </div>
            <p className="text-gray-300 mb-6">Where B2BNEST uses AI today:</p>
            <ul className="space-y-3">
              {aiBenefits.map((b, i) => (
                <li key={i} className="flex items-start text-gray-200">
                  <Zap className="h-5 w-5 text-yellow-400 mr-3 mt-0.5 flex-shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
            <div className="flex items-center mb-6">
              <DollarSign className="h-8 w-8 text-green-400 mr-3" />
              <h3 className="text-2xl font-bold text-white">💰 Lower Your SaaS Costs</h3>
            </div>
            <p className="text-gray-300 mb-6">Cover these with one subscription instead of several:</p>
            <ul className="grid grid-cols-1 gap-2">
              {replacedTools.map((t, i) => (
                <li key={i} className="flex items-center text-gray-200">
                  <span className="text-green-400 mr-2">✓</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <p className="text-cyan-400 text-sm mt-6 font-medium">See the Pricing page for what each plan includes.</p>
          </div>
        </div>

        {/* Closing CTA banner */}
        <div className="text-center">
          <div className="bg-gradient-to-r from-cyan-500 to-purple-600 rounded-2xl p-10 border border-white/20">
            <Globe className="h-12 w-12 text-white mx-auto mb-4" />
            <h4 className="text-3xl md:text-4xl font-bold text-white mb-3">🌍 Build. Automate. Scale.</h4>
            <p className="text-white/90 text-lg">Your everyday business tools, in one place.</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AIInvestmentShowcase;
