import React from 'react';
import { ArrowLeft, Brain, Target, DollarSign, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Footer from '@/components/Footer';
import AIDocumentDemo from '@/components/AIDocumentDemo';

const AIShowcase = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link to="/">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          <Badge className="bg-green-100 text-green-800">
            License-Free AI Technology
          </Badge>
        </div>

        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            AI-Powered Document Intelligence
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Revolutionary browser-based AI that transforms document management with zero licensing costs, 
            complete data privacy, and instant ROI for businesses of all sizes.
          </p>
        </div>

        {/* Value Proposition for Investors */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="bg-white shadow-lg">
            <CardHeader className="text-center">
              <Target className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <CardTitle className="text-xl">Market Differentiation</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600 mb-4">
                Only B2B platform offering enterprise-grade AI document processing without external dependencies
              </p>
              <div className="text-2xl font-bold text-blue-600">100%</div>
              <div className="text-sm text-gray-500">Unique positioning</div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-lg">
            <CardHeader className="text-center">
              <DollarSign className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <CardTitle className="text-xl">Cost Advantage</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600 mb-4">
                Zero ongoing AI licensing costs means 95%+ gross margins on AI features
              </p>
              <div className="text-2xl font-bold text-green-600">$0</div>
              <div className="text-sm text-gray-500">Per document processed</div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-lg">
            <CardHeader className="text-center">
              <Shield className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <CardTitle className="text-xl">Enterprise Appeal</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600 mb-4">
                Complete data privacy with local processing attracts security-conscious enterprises
              </p>
              <div className="text-2xl font-bold text-purple-600">90%</div>
              <div className="text-sm text-gray-500">Faster enterprise sales</div>
            </CardContent>
          </Card>
        </div>

        {/* Interactive Demo */}
        <AIDocumentDemo />

        {/* Business Impact Metrics */}
        <Card className="mt-12 bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
          <CardHeader>
            <CardTitle className="text-center text-2xl text-indigo-900">
              Measurable Business Impact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-indigo-600 mb-2">80%</div>
                <div className="text-sm font-semibold text-indigo-900">Time Savings</div>
                <div className="text-xs text-indigo-700">Document filing & categorization</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">$50K</div>
                <div className="text-sm font-semibold text-indigo-900">Annual Savings</div>
                <div className="text-xs text-indigo-700">Per 100-employee company</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600 mb-2">99%</div>
                <div className="text-sm font-semibold text-indigo-900">Accuracy Rate</div>
                <div className="text-xs text-indigo-700">Document classification</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600 mb-2">300%</div>
                <div className="text-sm font-semibold text-indigo-900">Template Usage</div>
                <div className="text-xs text-indigo-700">With AI recommendations</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Technical Advantages */}
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Brain className="h-6 w-6 mr-2 text-blue-600" />
                Technical Innovation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span><strong>WebGPU Acceleration:</strong> Leverages user's hardware for lightning-fast processing</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span><strong>Edge Computing:</strong> All AI processing happens locally in browser</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span><strong>Transformer Models:</strong> State-of-the-art language understanding</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span><strong>Progressive Enhancement:</strong> Works on any device, optimizes for capable hardware</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="h-6 w-6 mr-2 text-green-600" />
                Competitive Advantages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">•</span>
                  <span><strong>No Vendor Lock-in:</strong> Independent of OpenAI, Anthropic, or other AI providers</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">•</span>
                  <span><strong>Unlimited Scale:</strong> Processing capacity grows with user base</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">•</span>
                  <span><strong>Instant ROI:</strong> Customers see immediate value without ramp-up costs</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">•</span>
                  <span><strong>Future-Proof:</strong> Can integrate newer models as they become available</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Call to Action for Investors */}
        <Card className="mt-12 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <CardContent className="p-8 text-center">
            <h3 className="text-2xl font-bold mb-4">
              Ready to invest in the future of B2B document management?
            </h3>
            <p className="text-lg mb-6 opacity-90">
              This AI technology gives B2BNest an unbeatable competitive advantage with zero ongoing costs and maximum enterprise appeal.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/fundraising">
                <Button size="lg" variant="secondary" className="bg-white text-blue-600 hover:bg-gray-100">
                  View Investment Opportunity
                </Button>
              </Link>
              <Link to="/contact">
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                  Schedule Investor Call
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
};

export default AIShowcase;