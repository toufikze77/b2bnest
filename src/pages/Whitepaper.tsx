import React from 'react';
import { Download, FileText, Target, Zap, Users, TrendingUp, Shield, Globe, CheckCircle, ArrowRight, Rocket, Brain, Lock, Calendar, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Footer from '@/components/Footer';
import TokenSEO from '@/components/TokenSEO';
import PinkSaleCTA from '@/components/PinkSaleCTA';

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

            {/* PinkSale CTA - Top */}
            <div className="mt-12">
              <PinkSaleCTA variant="large" />
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
              <div className="space-y-4">
                <p className="text-gray-700 leading-relaxed">
                  B2BNest is an emerging AI-powered business automation platform designed to deliver comprehensive solutions for modern enterprises. With 25+ integrated business tools ranging from project management and CRM to document generation and invoicing, we're building a unified ecosystem for businesses across multiple industries. Our platform combines cutting-edge artificial intelligence with professional-grade business workflows, positioning ourselves to serve startups and growing companies looking to operate efficiently, scale seamlessly, and focus on growth.
                </p>
                <p className="text-gray-700 leading-relaxed">
                  Powered by our Ethereum-based B2BN token, the platform is designed to facilitate seamless business transactions, smart contracts, and premium feature access. We're targeting the $50B business process automation market with a solution built to save businesses 10+ hours per week while maintaining enterprise-grade reliability. Our presale and early subscriber program offers founding members exclusive benefits as we scale toward mainstream adoption.
                </p>
              </div>
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
              <p className="text-gray-700 mb-6 leading-relaxed">
                Today's businesses face an overwhelming challenge: managing operations across dozens of disconnected tools while trying to remain competitive in a fast-paced digital economy. This fragmentation leads to inefficiency, increased costs, and missed opportunities.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center mt-0.5">
                      <span className="text-red-600 font-bold">1</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">Tool Fragmentation Crisis</h4>
                      <p className="text-sm text-gray-600">Businesses use 15-20+ separate platforms for CRM, project management, invoicing, document creation, and team collaboration—wasting valuable time switching between systems.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center mt-0.5">
                      <span className="text-red-600 font-bold">2</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">Manual Process Overload</h4>
                      <p className="text-sm text-gray-600">Teams spend 10+ hours weekly on repetitive tasks like document formatting, data entry, invoice generation, and project tracking that could be automated.</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center mt-0.5">
                      <span className="text-red-600 font-bold">3</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">Compliance & Security Risks</h4>
                      <p className="text-sm text-gray-600">Outdated templates, inconsistent documentation, and lack of audit trails expose businesses to legal, financial, and regulatory compliance risks.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center mt-0.5">
                      <span className="text-red-600 font-bold">4</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">Scaling Limitations</h4>
                      <p className="text-sm text-gray-600">Traditional solutions fail to scale from startup to enterprise, forcing businesses to rebuild workflows and migrate data as they grow.</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Our Solution */}
          <Card className="mb-16">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-green-600" />
                3. Our Solution: B2BNest AI Business Platform
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 mb-6 leading-relaxed">
                B2BNest delivers a unified, AI-powered business automation platform that eliminates tool fragmentation and streamlines operations. From solo entrepreneurs to Fortune 500 companies, our comprehensive suite of 25+ integrated tools provides everything businesses need to operate efficiently, scale seamlessly, and focus on growth.
              </p>
              
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 mb-6">
                <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  Core AI-Powered Business Tools
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                      <h5 className="font-semibold text-sm">Project Management</h5>
                    </div>
                    <p className="text-xs text-gray-600">Kanban boards, task assignments, progress tracking, and team collaboration</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                      <h5 className="font-semibold text-sm">CRM System</h5>
                    </div>
                    <p className="text-xs text-gray-600">Contact management, sales pipeline, lead tracking, and analytics</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                      <h5 className="font-semibold text-sm">Quote & Invoice Generator</h5>
                    </div>
                    <p className="text-xs text-gray-600">Professional templates, auto-generated codes, payment tracking</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <h5 className="font-semibold text-sm">AI Startup Idea Generator</h5>
                    </div>
                    <p className="text-xs text-gray-600">50+ industries, budget-based recommendations, instant generation</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <h5 className="font-semibold text-sm">Business Cost Calculator</h5>
                    </div>
                    <p className="text-xs text-gray-600">Accurate estimates, structure comparisons, budget planning</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <h5 className="font-semibold text-sm">Business Resources Hub</h5>
                    </div>
                    <p className="text-xs text-gray-600">Verified service providers, competitive rates, expert guidance</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Brain className="h-6 w-6 text-purple-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">AI-Powered Intelligence</h4>
                      <p className="text-sm text-gray-600">Advanced machine learning optimizes workflows, auto-fills documents, detects compliance issues, and provides smart recommendations based on industry best practices.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Zap className="h-6 w-6 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">Automated Workflows</h4>
                      <p className="text-sm text-gray-600">Save 10+ hours per week with automated task assignments, document generation, invoice creation, and compliance checks—eliminating repetitive manual work.</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Users className="h-6 w-6 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">Team Collaboration</h4>
                      <p className="text-sm text-gray-600">Real-time editing, commenting, role-based permissions, version control, and seamless team coordination across all business functions.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Rocket className="h-6 w-6 text-green-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">Scalable Architecture</h4>
                      <p className="text-sm text-gray-600">Built on enterprise-grade infrastructure designed to scale from startup to Fortune 500 with high availability. Our architecture supports future growth to serve thousands of businesses globally.</p>
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

          {/* Business Model */}
          <Card className="mb-16">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-6 w-6 text-blue-600" />
                7. Business Model
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
                8. Roadmap
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
                    <h4 className="font-semibold text-gray-900">$B2BN Token Pre-Sale + HMRC Integration</h4>
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
                  9. Team & Advisors
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
                  10. Security & Compliance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 mb-4">B2BNest is built on enterprise-grade infrastructure with comprehensive security protocols:</p>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-blue-600" />
                      Data Protection
                    </h4>
                    <ul className="space-y-1 text-sm text-gray-600 ml-6">
                      <li>• End-to-end SSL/TLS encryption for all data in transit</li>
                      <li>• AES-256 encryption for data at rest</li>
                      <li>• Automated database backups with point-in-time recovery</li>
                      <li>• Row-level security (RLS) policies protecting user data</li>
                      <li>• Secure cloud storage with isolated buckets per tenant</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <Users className="h-4 w-4 text-purple-600" />
                      Authentication & Access Control
                    </h4>
                    <ul className="space-y-1 text-sm text-gray-600 ml-6">
                      <li>• Multi-factor authentication (MFA) support</li>
                      <li>• OAuth 2.0 integration (Google, GitHub, etc.)</li>
                      <li>• Role-based access control (RBAC) with granular permissions</li>
                      <li>• Session management with automatic timeout</li>
                      <li>• JWT token-based authentication with refresh tokens</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-green-600" />
                      Infrastructure & Compliance
                    </h4>
                    <ul className="space-y-1 text-sm text-gray-600 ml-6">
                      <li>• SOC 2 Type II certified infrastructure</li>
                      <li>• GDPR, CCPA, and HIPAA compliant architecture</li>
                      <li>• ISO 27001 security standards</li>
                      <li>• 99.9% uptime SLA with redundant systems</li>
                      <li>• Auto-scaling serverless architecture</li>
                      <li>• DDoS protection and WAF (Web Application Firewall)</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <Lock className="h-4 w-4 text-red-600" />
                      Application Security
                    </h4>
                    <ul className="space-y-1 text-sm text-gray-600 ml-6">
                      <li>• Input validation and sanitization on all endpoints</li>
                      <li>• SQL injection and XSS attack prevention</li>
                      <li>• Secure secrets management for API keys and tokens</li>
                      <li>• Regular security audits and penetration testing</li>
                      <li>• Automated vulnerability scanning</li>
                      <li>• Content Security Policy (CSP) headers</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Future Partnerships */}
          <Card className="mb-16">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="h-6 w-6 text-blue-600" />
                🔗 Future Partnerships
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 mb-6">
                B2BNEST is expanding its ecosystem through strategic collaborations with leading platforms in the crypto and blockchain space. Our future partnerships aim to enhance visibility, accessibility, and real-world utility for our community. B2BNEST plans to integrate with and be listed on major partners such as <strong>DEXView</strong>, <strong>Pinksale</strong>, <strong>Birdseye</strong>, <strong>OKX</strong>, <strong>CoinGecko</strong>, <strong>CoinMarketCap</strong>, <strong>Phantom</strong>, <strong>Alchemy Pay</strong>, <strong>Binance</strong>, and <strong>Bitget</strong>.
              </p>
              <p className="text-gray-700">
                These partnerships will strengthen our liquidity, transparency, and multi-chain presence — empowering users with seamless trading, analytics, and global payment options as we continue to grow in the decentralized finance ecosystem.
              </p>
            </CardContent>
          </Card>

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
                <Button size="lg" variant="outline" className="bg-transparent border-white text-white hover:bg-white hover:text-blue-600" asChild>
                  <a 
                    href="https://www.pinksale.finance/launchpad/ethereum/0xa3e47ea8bA047a848FF33Fa2292729327255b7B8"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ArrowRight className="h-5 w-5 mr-2" />
                    Join Token Presale
                  </a>
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

      {/* PinkSale CTA */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <PinkSaleCTA variant="large" />
      </div>

      <Footer />
    </div>
   </>
  );
};

export default Whitepaper;