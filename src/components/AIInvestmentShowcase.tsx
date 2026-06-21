import React from 'react';
import { Brain, Zap, Rocket, Briefcase, Users, Megaphone, Headphones, Calendar, BarChart3, Package, Workflow, LayoutDashboard, CreditCard, Search, Sparkles, DollarSign, Globe } from 'lucide-react';

const AIInvestmentShowcase = () => {
  const coreSolutions = [
    { icon: Briefcase, title: 'Professional Web Development', desc: 'High-performance, modern, scalable websites and business platforms built for growth and conversion.' },
    { icon: Users, title: 'HR Management System', desc: 'Manage employees, attendance, payroll, and onboarding from one dashboard.' },
    { icon: Megaphone, title: 'Marketing Campaign Manager', desc: 'Create, monitor, and optimize campaigns with AI-powered insights and automation.' },
    { icon: Headphones, title: 'Customer Support Portal', desc: 'Professional service with ticket management, live support, and communication tools.' },
    { icon: Calendar, title: 'Event Management Platform', desc: 'Plan and run business events, webinars, launches, and conferences with ease.' },
    { icon: BarChart3, title: 'Financial Dashboard', desc: 'Track revenue, expenses, performance, and financial analytics in real time.' },
    { icon: Package, title: 'Inventory Control System', desc: 'Manage stock levels, suppliers, and inventory movement efficiently.' },
    { icon: Workflow, title: 'Workflow Automation Suite', desc: 'Automate repetitive tasks, approvals, and notifications with AI-powered flows.' },
    { icon: LayoutDashboard, title: 'Resource Planning Dashboard', desc: 'Allocate resources, manage projects, teams, and deadlines from one platform.' },
    { icon: CreditCard, title: 'Merchant Integration Service', desc: 'Connect payment gateways, merchant services, and eCommerce systems seamlessly.' },
    { icon: Search, title: 'SEO & Analytics Optimization', desc: 'Improve visibility, monitor traffic, and optimize performance using AI-driven insights.' },
  ];

  const aiBenefits = [
    'Automate repetitive processes',
    'Improve operational efficiency',
    'Optimize workflows and project management',
    'Enhance decision-making with smart analytics',
    'Reduce manual workload and save time',
  ];

  const replacedTools = [
    'Project management software',
    'HR systems',
    'Automation platforms',
    'Marketing tools',
    'Analytics software',
    'Collaboration tools',
    'Customer support systems',
    'Business templates & document services',
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-indigo-900 via-purple-900 to-pink-900">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20 mb-6">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            <span className="text-white text-sm font-medium">The AI-Powered All-in-One Business Platform</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            🚀 B2BNEST — Run Your Entire Business <span className="text-cyan-400">From One Platform</span>
          </h2>
          <p className="text-xl text-gray-200 max-w-3xl mx-auto">
            B2BNEST brings powerful AI tools, business management systems, automation, and professional services into one centralized platform.
            Why pay for multiple expensive SaaS subscriptions when you can manage everything from a single intelligent ecosystem?
          </p>
          <p className="text-lg text-gray-300 max-w-3xl mx-auto mt-4">
            Whether you're a startup, entrepreneur, SME, freelancer, or enterprise — streamline operations, boost productivity, automate workflows, and scale faster.
          </p>
        </div>

        {/* Core Business Solutions */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-white mb-3">💼 Core Business Solutions</h3>
            <p className="text-gray-300">Everything you need to operate, automate, and grow.</p>
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
            <p className="text-gray-300 mb-6">B2BNEST integrates artificial intelligence to help businesses:</p>
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
            <p className="text-gray-300 mb-6">Replace multiple subscriptions with one powerful platform. No need to separately pay for:</p>
            <ul className="grid grid-cols-1 gap-2">
              {replacedTools.map((t, i) => (
                <li key={i} className="flex items-center text-gray-200">
                  <span className="text-green-400 mr-2">✓</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <p className="text-cyan-400 text-sm mt-6 font-medium">B2BNEST combines everything into one smart business ecosystem.</p>
          </div>
        </div>

        {/* Closing CTA banner */}
        <div className="text-center">
          <div className="bg-gradient-to-r from-cyan-500 to-purple-600 rounded-2xl p-10 border border-white/20">
            <Globe className="h-12 w-12 text-white mx-auto mb-4" />
            <h4 className="text-3xl md:text-4xl font-bold text-white mb-3">🌍 Build. Automate. Scale.</h4>
            <p className="text-white/90 text-lg">One intelligent ecosystem for modern businesses.</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AIInvestmentShowcase;
