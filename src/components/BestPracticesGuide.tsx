
import React, { useState } from 'react';
import { Lightbulb, Star, BookOpen, TrendingUp, Shield, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface BestPractice {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  impact: 'low' | 'medium' | 'high';
  timeToImplement: string;
  steps: string[];
  resources: string[];
  commonMistakes: string[];
}

const BestPracticesGuide = () => {
  const [selectedCategory, setSelectedCategory] = useState('legal');

  const bestPractices: Record<string, BestPractice[]> = {
    legal: [
      {
        id: 'document-organization',
        title: 'Organize Legal Documents Systematically',
        description: 'Maintain a structured filing system for all business documents',
        category: 'Document Management',
        difficulty: 'beginner',
        impact: 'high',
        timeToImplement: '2-3 hours',
        steps: [
          'Create digital folders by document type',
          'Implement consistent naming conventions',
          'Set up automatic backup systems',
          'Create a document index spreadsheet',
          'Schedule regular document reviews'
        ],
        resources: ['Document Organization Template', 'Digital Filing Best Practices'],
        commonMistakes: [
          'Not backing up important documents',
          'Inconsistent file naming',
          'Mixing personal and business documents'
        ]
      },
      {
        id: 'contract-templates',
        title: 'Standardize Contract Templates',
        description: 'Create consistent, legally-sound contract templates',
        category: 'Contracts',
        difficulty: 'intermediate',
        impact: 'high',
        timeToImplement: '1-2 weeks',
        steps: [
          'Identify common contract types needed',
          'Work with legal counsel to create templates',
          'Include standard terms and conditions',
          'Create approval workflows',
          'Train team on proper usage'
        ],
        resources: ['Contract Template Library', 'Legal Review Checklist'],
        commonMistakes: [
          'Using outdated or generic templates',
          'Not customizing for specific industries',
          'Forgetting to update templates regularly'
        ]
      }
    ],
    financial: [
      {
        id: 'financial-controls',
        title: 'Implement Strong Financial Controls',
        description: 'Establish checks and balances to protect business finances',
        category: 'Financial Management',
        difficulty: 'intermediate',
        impact: 'high',
        timeToImplement: '1 week',
        steps: [
          'Separate business and personal finances',
          'Set up approval limits for expenses',
          'Implement dual authorization for large transactions',
          'Create monthly financial review processes',
          'Establish audit trails for all transactions'
        ],
        resources: ['Financial Controls Checklist', 'Approval Workflow Templates'],
        commonMistakes: [
          'Mixing personal and business expenses',
          'No approval process for large expenses',
          'Poor record keeping'
        ]
      },
      {
        id: 'cash-flow-management',
        title: 'Master Cash Flow Management',
        description: 'Maintain healthy cash flow through proper planning and monitoring',
        category: 'Cash Flow',
        difficulty: 'intermediate',
        impact: 'high',
        timeToImplement: '3-5 days',
        steps: [
          'Create 13-week cash flow forecasts',
          'Set up automated invoice reminders',
          'Negotiate favorable payment terms',
          'Establish line of credit before you need it',
          'Monitor key cash flow metrics weekly'
        ],
        resources: ['Cash Flow Template', 'Payment Terms Guide'],
        commonMistakes: [
          'Not forecasting cash flow',
          'Waiting too long to follow up on payments',
          'Over-investing in inventory'
        ]
      }
    ],
    operations: [
      {
        id: 'process-documentation',
        title: 'Document Core Business Processes',
        description: 'Create clear, repeatable processes for key business functions',
        category: 'Process Management',
        difficulty: 'beginner',
        impact: 'medium',
        timeToImplement: '2-3 weeks',
        steps: [
          'Identify critical business processes',
          'Map out each process step-by-step',
          'Create visual flowcharts',
          'Document roles and responsibilities',
          'Regularly review and update processes'
        ],
        resources: ['Process Documentation Template', 'Flowchart Tools'],
        commonMistakes: [
          'Making processes too complex',
          'Not involving actual process users',
          'Failing to keep documentation updated'
        ]
      },
      {
        id: 'quality-control',
        title: 'Establish Quality Control Systems',
        description: 'Implement systems to maintain consistent quality in products/services',
        category: 'Quality Management',
        difficulty: 'intermediate',
        impact: 'high',
        timeToImplement: '2-4 weeks',
        steps: [
          'Define quality standards and metrics',
          'Create inspection checklists',
          'Implement feedback collection systems',
          'Train staff on quality procedures',
          'Establish corrective action processes'
        ],
        resources: ['Quality Control Checklist', 'Customer Feedback Forms'],
        commonMistakes: [
          'Not defining clear quality standards',
          'Inconsistent quality checks',
          'Ignoring customer feedback'
        ]
      }
    ],
    growth: [
      {
        id: 'scalable-systems',
        title: 'Build Scalable Business Systems',
        description: 'Create systems that can grow with your business',
        category: 'Growth Planning',
        difficulty: 'advanced',
        impact: 'high',
        timeToImplement: '4-6 weeks',
        steps: [
          'Assess current system limitations',
          'Design scalable architecture',
          'Implement cloud-based solutions',
          'Create standard operating procedures',
          'Plan for resource scaling'
        ],
        resources: ['Scalability Assessment', 'Systems Architecture Guide'],
        commonMistakes: [
          'Building systems that can\'t scale',
          'Not planning for growth',
          'Over-engineering early systems'
        ]
      },
      {
        id: 'performance-metrics',
        title: 'Track Key Performance Indicators',
        description: 'Monitor the metrics that matter most to your business',
        category: 'Performance Management',
        difficulty: 'intermediate',
        impact: 'high',
        timeToImplement: '1-2 weeks',
        steps: [
          'Identify key business drivers',
          'Define specific, measurable KPIs',
          'Set up automated reporting',
          'Create performance dashboards',
          'Schedule regular performance reviews'
        ],
        resources: ['KPI Template', 'Dashboard Examples'],
        commonMistakes: [
          'Tracking too many metrics',
          'Not acting on metric insights',
          'Choosing vanity metrics over actionable ones'
        ]
      }
    ]
  };

  const categories = [
    { id: 'legal', name: 'Legal & Compliance', icon: Shield },
    { id: 'financial', name: 'Financial Management', icon: TrendingUp },
    { id: 'operations', name: 'Operations', icon: Users },
    { id: 'growth', name: 'Growth & Scaling', icon: Star }
  ];

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'low': return 'bg-gray-100 text-gray-800';
      case 'medium': return 'bg-blue-100 text-blue-800';
      case 'high': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const currentPractices = bestPractices[selectedCategory] || [];

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Business Best Practices Guide</h2>
        </div>
        <p className="text-gray-600">
          Learn proven strategies and best practices to build a successful, compliant, and scalable business.
        </p>
      </div>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <TabsTrigger key={category.id} value={category.id} className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{category.name}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {categories.map((category) => (
          <TabsContent key={category.id} value={category.id} className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {currentPractices.map((practice) => (
                <Card key={practice.id} className="h-full">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <CardTitle className="text-lg">{practice.title}</CardTitle>
                      <div className="flex gap-2">
                        <Badge className={getDifficultyColor(practice.difficulty)}>
                          {practice.difficulty}
                        </Badge>
                        <Badge className={getImpactColor(practice.impact)}>
                          {practice.impact} impact
                        </Badge>
                      </div>
                    </div>
                    <p className="text-gray-600">{practice.description}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>⏱️ {practice.timeToImplement}</span>
                      <span>📁 {practice.category}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Implementation Steps:</h4>
                        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                          {practice.steps.map((step, index) => (
                            <li key={index}>{step}</li>
                          ))}
                        </ol>
                      </div>

                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Resources:</h4>
                        <div className="flex flex-wrap gap-1">
                          {practice.resources.map((resource, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              <BookOpen className="h-3 w-3 mr-1" />
                              {resource}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium text-red-700 mb-2">Common Mistakes to Avoid:</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-red-600">
                          {practice.commonMistakes.map((mistake, index) => (
                            <li key={index}>{mistake}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default BestPracticesGuide;
