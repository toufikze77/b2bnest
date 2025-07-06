import React from 'react';
import { Download, FileText, Target, Zap, Users, TrendingUp, Shield, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const Whitepaper = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Header />
      
      <div className="pt-20 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center p-2 bg-blue-100 rounded-full mb-6">
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-6">
              B2BNest Whitepaper
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Revolutionizing Business Automation with AI-Powered Document Intelligence
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

          {/* Key Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            <Card className="text-center">
              <CardContent className="pt-6">
                <Target className="h-8 w-8 text-blue-600 mx-auto mb-4" />
                <h3 className="font-semibold text-gray-900 mb-2">Market Focus</h3>
                <p className="text-sm text-gray-600">$50B Business Automation Market</p>
              </CardContent>
            </Card>
            
            <Card className="text-center">
              <CardContent className="pt-6">
                <Zap className="h-8 w-8 text-green-600 mx-auto mb-4" />
                <h3 className="font-semibold text-gray-900 mb-2">AI Innovation</h3>
                <p className="text-sm text-gray-600">95% Document Processing Accuracy</p>
              </CardContent>
            </Card>
            
            <Card className="text-center">
              <CardContent className="pt-6">
                <Users className="h-8 w-8 text-purple-600 mx-auto mb-4" />
                <h3 className="font-semibold text-gray-900 mb-2">User Growth</h3>
                <p className="text-sm text-gray-600">8.2K+ Active Users</p>
              </CardContent>
            </Card>
            
            <Card className="text-center">
              <CardContent className="pt-6">
                <TrendingUp className="h-8 w-8 text-orange-600 mx-auto mb-4" />
                <h3 className="font-semibold text-gray-900 mb-2">Revenue Growth</h3>
                <p className="text-sm text-gray-600">180% YoY Growth</p>
              </CardContent>
            </Card>
          </div>

          {/* Table of Contents */}
          <Card className="mb-16">
            <CardHeader>
              <CardTitle>Table of Contents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-700">1. Executive Summary</span>
                    <span className="text-gray-500 text-sm">Page 3</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-700">2. Market Analysis</span>
                    <span className="text-gray-500 text-sm">Page 7</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-700">3. Technology Stack</span>
                    <span className="text-gray-500 text-sm">Page 12</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-700">4. AI Innovation</span>
                    <span className="text-gray-500 text-sm">Page 18</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-700">5. Business Model</span>
                    <span className="text-gray-500 text-sm">Page 24</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-700">6. Token Economics</span>
                    <span className="text-gray-500 text-sm">Page 30</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-700">7. Roadmap</span>
                    <span className="text-gray-500 text-sm">Page 36</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-700">8. Team & Advisors</span>
                    <span className="text-gray-500 text-sm">Page 42</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-700">9. Risk Analysis</span>
                    <span className="text-gray-500 text-sm">Page 48</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-700">10. Legal Framework</span>
                    <span className="text-gray-500 text-sm">Page 54</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Sections Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  Technology Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  B2BNest leverages cutting-edge AI and machine learning technologies to automate 
                  complex business document processes with unprecedented accuracy and efficiency.
                </p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Advanced Natural Language Processing (NLP)</li>
                  <li>• Computer Vision for Document Analysis</li>
                  <li>• Blockchain Integration for Security</li>
                  <li>• Scalable Cloud Architecture</li>
                  <li>• Real-time Processing Capabilities</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-green-600" />
                  Market Opportunity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  The global business process automation market presents a massive opportunity 
                  for AI-driven solutions, with B2BNest positioned at the forefront.
                </p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Addressable Market</span>
                    <span className="font-semibold text-blue-600">$50B</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Serviceable Addressable Market</span>
                    <span className="font-semibold text-green-600">$8B</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Target Market Share</span>
                    <span className="font-semibold text-purple-600">2.5%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Download Section */}
          <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <CardContent className="text-center py-12">
              <FileText className="h-16 w-16 mx-auto mb-6 opacity-90" />
              <h3 className="text-2xl font-bold mb-4">Get the Complete Whitepaper</h3>
              <p className="text-blue-100 mb-8 max-w-2xl mx-auto">
                Download our comprehensive 60-page whitepaper to dive deep into our technology, 
                market analysis, tokenomics, and strategic roadmap.
              </p>
              <div className="flex justify-center gap-4">
                <Button size="lg" variant="secondary" className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Download PDF (2.3 MB)
                </Button>
                <Button size="lg" variant="outline" className="bg-transparent border-white text-white hover:bg-white hover:text-blue-600">
                  Email to Me
                </Button>
              </div>
              <p className="text-xs text-blue-200 mt-4">
                Last updated: December 2024 • Version 2.1
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Whitepaper;