import React from 'react';
import { Download, FileText, Target, Zap, Users, TrendingUp, Shield, Globe, CheckCircle, ArrowRight, Rocket, Brain, Lock, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Footer from '@/components/Footer';
import TokenSEO from '@/components/TokenSEO';

const Whitepaper = () => {
  return (
    <>
      <TokenSEO page="whitepaper" />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="pt-20 pb-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Hero Section */}
            <div className="text-center mb-16">
              <div className="inline-flex items-center justify-center p-2 bg-blue-100 rounded-full mb-6">
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
              <h1 className="text-4xl font-bold text-gray-900 mb-6">
                B2BNEST Whitepaper | Roadmap & Security Audit
              </h1>
              <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                Official B2BNEST whitepaper covering our secure blockchain token technology, B2BNEST roadmap, 
                crypto project audit details, and cross-border business solutions in the decentralized finance space.
              </p>
            <div className="flex justify-center gap-4">
              <Button size="lg" className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Download PDF
              </Button>
              <Button variant="outline" size="lg">
                Executive Summary
              </Button>
            </div>
          </div>

          {/* Executive Summary */}
          <Card className="mb-16">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-6 w-6 text-blue-600" />
                1. Executive Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 leading-relaxed">
                B2BNest is an AI-powered platform designed to streamline business operations by offering an all-in-one hub for essential tools, document templates, project management, and collaborative solutions. By combining cutting-edge artificial intelligence with professional-grade documentation and business workflows, B2BNest enables startups and enterprises to operate efficiently, stay compliant, and focus on growth.
              </p>
            </CardContent>
          </Card>

          {/* The Problem */}
          <Card className="mb-16">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-6 w-6 text-red-600" />
                2. The Problem
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 mb-4">
                Modern businesses are overwhelmed by fragmented tools, inefficient processes, and the time-consuming nature of document creation and project coordination. Key issues include:
              </p>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">•</span>
                  Manual creation of essential business documents
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">•</span>
                  Scattered project management and collaboration platforms
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">•</span>
                  Compliance risks due to outdated or incomplete documentation
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">•</span>
                  Lack of automation in small business operations
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Our Solution */}
          <Card className="mb-16">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-green-600" />
                3. Our Solution: B2BNest
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 mb-4">
                B2BNest is the one-stop AI-powered platform addressing these challenges. It integrates:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-gray-900">Smart Document Templates</h4>
                      <p className="text-sm text-gray-600">Access a library of professionally crafted, auto-updating templates.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Brain className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-gray-900">AI-Powered Analysis</h4>
                      <p className="text-sm text-gray-600">Analyze and enhance documents using machine learning and NLP.</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-purple-500 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-gray-900">Project & Task Management</h4>
                      <p className="text-sm text-gray-600">Manage your team, assign tasks, and track progress in one place.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Globe className="h-5 w-5 text-orange-500 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-gray-900">Centralized Hub</h4>
                      <p className="text-sm text-gray-600">Combine all your business operations and tools in a unified dashboard.</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Features */}
          <Card className="mb-16">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-6 w-6 text-yellow-600" />
                4. Key Features
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2">AI Document Assistant</h4>
                    <p className="text-sm text-blue-700">Review contracts, suggest edits, identify missing clauses.</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-semibold text-green-900 mb-2">Template Library</h4>
                    <p className="text-sm text-green-700">HR forms, NDAs, financial templates, operations checklists, and more.</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <h4 className="font-semibold text-purple-900 mb-2">Business Management Toolkit</h4>
                    <p className="text-sm text-purple-700">Invoicing, budgeting, task assignment, reporting.</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <h4 className="font-semibold text-orange-900 mb-2">Collaboration & Workflow</h4>
                    <p className="text-sm text-orange-700">Real-time edits, commenting, team roles, version control.</p>
                  </div>
                  <div className="p-4 bg-pink-50 rounded-lg">
                    <h4 className="font-semibold text-pink-900 mb-2">AI Insights Engine</h4>
                    <p className="text-sm text-pink-700">Receive smart suggestions based on industry standards and compliance trends.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Technology Stack */}
          <Card className="mb-16">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-6 w-6 text-blue-600" />
                5. Technology Stack
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">Front-End</h4>
                  <p className="text-sm text-blue-700">React, Tailwind CSS, TypeScript</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-2">Back-End</h4>
                  <p className="text-sm text-green-700">Node.js, Express, Python (for AI services)</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-semibold text-purple-900 mb-2">AI/NLP</h4>
                  <p className="text-sm text-purple-700">OpenAI models, custom-trained ML models</p>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <h4 className="font-semibold text-orange-900 mb-2">Database</h4>
                  <p className="text-sm text-orange-700">PostgreSQL, Redis (for caching)</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <h4 className="font-semibold text-red-900 mb-2">Security</h4>
                  <p className="text-sm text-red-700">SSL encryption, multi-factor authentication</p>
                </div>
                <div className="text-center p-4 bg-indigo-50 rounded-lg">
                  <h4 className="font-semibold text-indigo-900 mb-2">Compliance</h4>
                  <p className="text-sm text-indigo-700">GDPR-compliant architecture</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Integration */}
          <Card className="mb-16">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-6 w-6 text-purple-600" />
                6. AI Integration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 mb-6">B2BNest AI enables:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Zap className="h-5 w-5 text-yellow-500 mt-1" />
                    <div>
                      <h4 className="font-semibold text-gray-900">Smart Autofill</h4>
                      <p className="text-sm text-gray-600">Populate business documents using stored company data.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Target className="h-5 w-5 text-red-500 mt-1" />
                    <div>
                      <h4 className="font-semibold text-gray-900">Clause Detection</h4>
                      <p className="text-sm text-gray-600">Identify critical gaps in contracts and recommend language.</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-blue-500 mt-1" />
                    <div>
                      <h4 className="font-semibold text-gray-900">Regulatory Compliance Alerts</h4>
                      <p className="text-sm text-gray-600">Automatically scan documents for outdated compliance elements.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-green-500 mt-1" />
                    <div>
                      <h4 className="font-semibold text-gray-900">Smart Templates</h4>
                      <p className="text-sm text-gray-600">Templates that evolve based on AI feedback and industry data.</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Token Utility */}
          <Card className="mb-16">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-green-600" />
                7. Token Utility & Governance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 mb-6">We introduce the $B2BN token to support platform participation:</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
                  <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-3" />
                  <h4 className="font-semibold text-green-900 mb-2">Revenue Sharing</h4>
                  <p className="text-sm text-green-700">First 500 holders share 20% of quarterly platform revenue.</p>
                </div>
                <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-sky-50 rounded-xl border border-blue-200">
                  <Zap className="h-8 w-8 text-blue-600 mx-auto mb-3" />
                  <h4 className="font-semibold text-blue-900 mb-2">Premium Access</h4>
                  <p className="text-sm text-blue-700">First 100 holders get 1-year access to AI tools and premium templates.</p>
                </div>
                <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl border border-purple-200">
                  <Users className="h-8 w-8 text-purple-600 mx-auto mb-3" />
                  <h4 className="font-semibold text-purple-900 mb-2">Governance Rights</h4>
                  <p className="text-sm text-purple-700">Token holders vote on feature priorities, integrations, and roadmap decisions.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Business Model */}
          <Card className="mb-16">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-6 w-6 text-blue-600" />
                8. Business Model
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">Subscription Plans</h4>
                  <p className="text-sm text-blue-700">Tiered pricing for individuals, teams, and enterprises</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-2">Add-On Services</h4>
                  <p className="text-sm text-green-700">AI enhancements, industry-specific compliance packages</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-semibold text-purple-900 mb-2">Token Utility</h4>
                  <p className="text-sm text-purple-700">Access tiers, staking for perks, marketplace discounts</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Roadmap */}
          <Card className="mb-16">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-6 w-6 text-orange-600" />
                9. Roadmap
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-24 text-center">
                    <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">Q3 2025</div>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">Public Launch + AI Doc Assistant</h4>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-24 text-center">
                    <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">Q4 2025</div>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">$B2BN Token Pre-Sale + Governance Integration</h4>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-24 text-center">
                    <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-semibold">Q1 2026</div>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">API Release for 3rd Party Tools</h4>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-24 text-center">
                    <div className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-semibold">Q2 2026</div>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">Advanced AI Insights & Industry Expansion</h4>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Team & Security */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-6 w-6 text-purple-600" />
                  10. Team & Advisors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">
                  Led by experienced entrepreneurs, legal experts, and AI engineers, B2BNest is built by a team passionate about empowering business operations through intelligent technology.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-6 w-6 text-red-600" />
                  11. Security & Compliance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 mb-4">We follow best-in-class security protocols including:</p>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• End-to-end encryption</li>
                  <li>• Secure cloud storage</li>
                  <li>• GDPR & CCPA compliance</li>
                  <li>• Role-based access controls</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Call to Action */}
          <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <CardContent className="text-center py-12">
              <Rocket className="h-16 w-16 mx-auto mb-6 opacity-90" />
              <h3 className="text-3xl font-bold mb-4">Join the Movement</h3>
              <p className="text-blue-100 mb-8 max-w-3xl mx-auto text-lg">
                With B2BNest, business management, documentation, and team collaboration come together under one intelligent hub. Whether you're a startup founder or a scaling enterprise, B2BNest gives you the tools to succeed—smarter and faster.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4 mb-6">
                <Button size="lg" variant="secondary" className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Visit www.b2bnest.online
                </Button>
                <Button size="lg" variant="outline" className="bg-transparent border-white text-white hover:bg-white hover:text-blue-600">
                  <ArrowRight className="h-5 w-5 mr-2" />
                  Token Presale Coming Soon
                </Button>
              </div>
              <div className="flex justify-center gap-6 text-sm">
                <span>🌐 Website: www.b2bnest.online</span>
                <span>🐦 Twitter: @B2BNEST</span>
                <span>💎 Token Presale: Coming soon on PinkSale</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  </>
  );
};

export default Whitepaper;