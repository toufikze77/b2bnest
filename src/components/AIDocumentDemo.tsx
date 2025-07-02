import React, { useState, useCallback } from 'react';
import { Upload, Brain, FileText, Clock, Shield, TrendingUp, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { aiClassificationService, DocumentAnalysis } from '@/services/aiClassificationService';
import { useToast } from '@/hooks/use-toast';

const AIDocumentDemo = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('text/') && !file.name.endsWith('.txt')) {
      toast({
        title: "Demo Limitation",
        description: "For this demo, please upload text files only. Production version supports PDF, Word, and more.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setAnalysis(null);

    try {
      const text = await aiClassificationService.extractTextFromFile(file);
      const result = await aiClassificationService.classifyDocument(text, file.name);
      setAnalysis(result);
      
      toast({
        title: "Document Analyzed!",
        description: `Classified as ${result.documentType} with ${Math.round(result.classification.confidence * 100)}% confidence`,
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Error",
        description: "Failed to analyze document. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  }, [handleFile]);

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4 flex items-center justify-center">
          <Brain className="h-8 w-8 mr-3 text-blue-600" />
          AI Document Classification Demo
        </h2>
        <p className="text-lg text-gray-600 max-w-3xl mx-auto">
          Experience our license-free AI that automatically classifies documents, analyzes risk, 
          and recommends templates - all processing locally in your browser for complete data privacy.
        </p>
      </div>

      {/* ROI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">80%</div>
            <div className="text-sm text-gray-600">Time Savings</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">99%</div>
            <div className="text-sm text-gray-600">Accuracy Rate</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Shield className="h-8 w-8 text-purple-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">100%</div>
            <div className="text-sm text-gray-600">Data Privacy</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Zap className="h-8 w-8 text-orange-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">$0</div>
            <div className="text-sm text-gray-600">API Costs</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Area */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Upload className="h-5 w-5 mr-2" />
              Upload Document for Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {isProcessing ? (
                <div className="space-y-4">
                  <Brain className="h-12 w-12 text-blue-600 mx-auto animate-pulse" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Processing Document...</h3>
                    <p className="text-gray-600">AI is analyzing your document locally</p>
                    <Progress value={65} className="mt-2" />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Drop your document here
                    </h3>
                    <p className="text-gray-600">
                      Or click to browse (text files for demo)
                    </p>
                  </div>
                  <Button asChild>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        className="hidden"
                        accept=".txt,.text"
                        onChange={handleFileInput}
                      />
                      Choose File
                    </label>
                  </Button>
                </div>
              )}
            </div>

            {/* Sample Text for Demo */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">Try the Demo:</h4>
              <p className="text-sm text-gray-600 mb-2">
                Create a text file with this sample content:
              </p>
              <code className="text-xs bg-white p-2 rounded border block">
                "This employment agreement between Company XYZ and Employee establishes terms and conditions of employment, including salary, benefits, confidential information obligations, and liability limitations."
              </code>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Brain className="h-5 w-5 mr-2" />
              AI Analysis Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analysis ? (
              <div className="space-y-4">
                {/* Classification */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Document Classification</h4>
                  <div className="flex items-center space-x-2 mb-2">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      {analysis.documentType}
                    </Badge>
                    <span className="text-sm text-gray-600">
                      {Math.round(analysis.classification.confidence * 100)}% confidence
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Category: {analysis.classification.category}
                    {analysis.classification.subcategory && (
                      <span> → {analysis.classification.subcategory}</span>
                    )}
                  </div>
                </div>

                {/* Risk Analysis */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Risk Assessment</h4>
                  <Badge className={getRiskLevelColor(analysis.classification.riskLevel)}>
                    {analysis.classification.riskLevel.toUpperCase()} RISK
                  </Badge>
                </div>

                {/* Tags */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Auto-Generated Tags</h4>
                  <div className="flex flex-wrap gap-1">
                    {analysis.classification.tags.map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Key Terms */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Key Terms Identified</h4>
                  <div className="text-sm text-gray-600">
                    {analysis.keyTerms.slice(0, 5).join(', ')}...
                  </div>
                </div>

                {/* Template Recommendations */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Recommended Templates</h4>
                  <div className="space-y-1">
                    {analysis.recommendedTemplates.slice(0, 3).map((template, index) => (
                      <div key={index} className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer">
                        • {template}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Performance */}
                <div className="pt-2 border-t">
                  <div className="text-xs text-gray-500">
                    Processed in {Math.round(analysis.classification.processingTime)}ms locally
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Brain className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  Upload a document to see AI analysis results
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Benefits for Investors */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-center text-blue-900">
            Why This Creates Massive Value for Investors
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div>
              <h4 className="font-semibold text-blue-900 mb-2">Zero Ongoing Costs</h4>
              <p className="text-sm text-blue-800">
                No API fees, no per-document charges. Pure profit scaling.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-blue-900 mb-2">Complete Data Privacy</h4>
              <p className="text-sm text-blue-800">
                Enterprise customers love that sensitive documents never leave their browser.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-blue-900 mb-2">Instant ROI</h4>
              <p className="text-sm text-blue-800">
                Customers save thousands in manual processing costs immediately.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AIDocumentDemo;