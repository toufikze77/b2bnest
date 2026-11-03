
import React, { useState } from 'react';
import { Lightbulb, Star, TrendingUp, Shield, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GOV, LINKS_NOTE } from '@/data/ukOfficialLinks';

interface BestPractice {
  id: string;
  title: string;
  description: string;
  steps: string[];
  commonMistakes: string[];
  /** An official page, where there is one. */
  source?: { label: string; url: string };
}

const BestPracticesGuide = () => {
  const [selectedCategory, setSelectedCategory] = useState('legal');

  const bestPractices: Record<string, BestPractice[]> = {
    legal: [
      {
        id: 'document-organization',
        title: 'Organise business documents',
        description: 'Maintain a structured filing system for all business documents',
        steps: [
          'Create digital folders by document type',
          'Implement consistent naming conventions',
          'Set up automatic backup systems',
          'Create a document index spreadsheet',
          'Schedule regular document reviews'
        ],
        source: { label: 'Company and accounting records', url: GOV.companyRecords },
        commonMistakes: [
          'Not backing up important documents',
          'Inconsistent file naming',
          'Mixing personal and business documents'
        ]
      },
      {
        id: 'contract-templates',
        title: 'Standardise contract templates',
        description: 'Use consistent contract templates, checked by a solicitor',
        steps: [
          'Identify common contract types needed',
          'Work with legal counsel to create templates',
          'Include standard terms and conditions',
          'Create approval workflows',
          'Train team on proper usage'
        ],
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
        title: 'Put financial controls in place',
        description: 'Establish checks and balances to protect business finances',
        steps: [
          'Separate business and personal finances',
          'Set up approval limits for expenses',
          'Implement dual authorization for large transactions',
          'Create monthly financial review processes',
          'Establish audit trails for all transactions'
        ],
        source: { label: 'Company and accounting records', url: GOV.companyRecords },
        commonMistakes: [
          'Mixing personal and business expenses',
          'No approval process for large expenses',
          'Poor record keeping'
        ]
      },
      {
        id: 'cash-flow-management',
        title: 'Plan your cash flow',
        description: 'Maintain healthy cash flow through proper planning and monitoring',
        steps: [
          'Create 13-week cash flow forecasts',
          'Set up automated invoice reminders',
          'Agree payment terms with customers and suppliers',
          'Arrange any overdraft or borrowing before you need it',
          'Monitor key cash flow metrics weekly'
        ],
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
        title: 'Write down your core processes',
        description: 'Create clear, repeatable processes for key business functions',
        steps: [
          'Identify critical business processes',
          'Map out each process step-by-step',
          'Create visual flowcharts',
          'Document roles and responsibilities',
          'Regularly review and update processes'
        ],
        commonMistakes: [
          'Making processes too complex',
          'Not involving actual process users',
          'Failing to keep documentation updated'
        ]
      },
      {
        id: 'quality-control',
        title: 'Set up quality checks',
        description: 'Implement systems to maintain consistent quality in products and services',
        steps: [
          'Define quality standards and metrics',
          'Create inspection checklists',
          'Implement feedback collection systems',
          'Train staff on quality procedures',
          'Establish corrective action processes'
        ],
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
        title: 'Build systems that can grow',
        description: 'Create systems that can grow with your business',
        steps: [
          'Assess current system limitations',
          'Plan how each system will cope with more work',
          'Choose tools that can grow with you',
          'Create standard operating procedures',
          'Plan for resource scaling'
        ],
        commonMistakes: [
          'Building systems that can\'t scale',
          'Not planning for growth',
          'Over-engineering early systems'
        ]
      },
      {
        id: 'performance-metrics',
        title: 'Track a few key measures',
        description: 'Monitor the metrics that matter most to your business',
        steps: [
          'Identify key business drivers',
          'Define specific, measurable KPIs',
          'Set up automated reporting',
          'Create performance dashboards',
          'Schedule regular performance reviews'
        ],
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



  const currentPractices = bestPractices[selectedCategory] || [];

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Business good practice guide</h2>
        </div>
        <p className="text-gray-600">
          Practical habits many small businesses use. General guidance only: adapt it to your business.
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
                    </div>
                    <p className="text-gray-600">{practice.description}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Steps:</h4>
                        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                          {practice.steps.map((step, index) => (
                            <li key={index}>{step}</li>
                          ))}
                        </ol>
                      </div>

                      {practice.source && (
                        <a href={practice.source.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">{practice.source.label} (GOV.UK)</a>
                      )}
                      <div>
                        <h4 className="font-medium text-foreground mb-2">Common mistakes to avoid:</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
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
      <p className="mt-6 text-xs text-muted-foreground">General guidance, not legal, tax or financial advice. {LINKS_NOTE}</p>
    </div>
  );
};

export default BestPracticesGuide;
