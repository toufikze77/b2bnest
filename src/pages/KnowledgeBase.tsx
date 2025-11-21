import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Book, Search, FileText, Wrench, DollarSign, Users, 
  Zap, Building2, Globe, Lock, TrendingUp, ExternalLink
} from 'lucide-react';
import { Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead';

const KnowledgeBase = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: Book,
      color: 'bg-blue-500',
      articles: [
        { title: 'Creating Your Account', description: 'Step-by-step guide to sign up and set up your profile', readTime: '3 min' },
        { title: 'Dashboard Overview', description: 'Understanding your B2BNEST dashboard and key features', readTime: '5 min' },
        { title: 'First Project Setup', description: 'How to create and manage your first project', readTime: '7 min' },
        { title: 'Inviting Team Members', description: 'Collaborate with your team on B2BNEST', readTime: '4 min' }
      ]
    },
    {
      id: 'business-tools',
      title: 'Business Tools',
      icon: Wrench,
      color: 'bg-green-500',
      articles: [
        { title: 'Invoice Generator Guide', description: 'Create professional invoices in minutes', readTime: '6 min' },
        { title: 'CRM System Tutorial', description: 'Managing contacts, deals, and sales pipeline', readTime: '10 min' },
        { title: 'Project Management', description: 'Using tasks, timelines, and collaboration tools', readTime: '8 min' },
        { title: 'Document Templates', description: 'Access and customize 100+ business templates', readTime: '5 min' },
        { title: 'Time Tracking', description: 'Track billable hours and generate reports', readTime: '4 min' }
      ]
    },
    {
      id: 'integrations',
      title: 'Integrations',
      icon: Zap,
      color: 'bg-purple-500',
      articles: [
        { title: 'Google Calendar Integration', description: 'Sync events and automate scheduling', readTime: '5 min' },
        { title: 'iCloud Calendar Setup', description: 'Connect your Apple calendar to B2BNEST', readTime: '4 min' },
        { title: 'Outlook 365 Integration', description: 'Microsoft calendar and email integration', readTime: '6 min' },
        { title: 'OneDrive Connection', description: 'Access and manage your OneDrive files', readTime: '5 min' },
        { title: 'Social Media Automation', description: 'Connect Twitter, LinkedIn, and Facebook', readTime: '8 min' },
        { title: 'HMRC Integration', description: 'UK tax submissions and compliance', readTime: '12 min' }
      ]
    },
    {
      id: 'financial-tools',
      title: 'Financial Tools',
      icon: DollarSign,
      color: 'bg-yellow-500',
      articles: [
        { title: 'Cash Flow Tracking', description: 'Monitor income and expenses in real-time', readTime: '7 min' },
        { title: 'ROI Calculator', description: 'Calculate return on investment for projects', readTime: '5 min' },
        { title: 'Expense Management', description: 'Track and categorize business expenses', readTime: '6 min' },
        { title: 'HMRC VAT Returns', description: 'Submit VAT returns directly to HMRC', readTime: '10 min' },
        { title: 'Payroll Management', description: 'UK payroll processing and RTI submissions', readTime: '15 min' }
      ]
    },
    {
      id: 'workflows',
      title: 'Workflow Automation',
      icon: Zap,
      color: 'bg-indigo-500',
      articles: [
        { title: 'Creating Your First Workflow', description: 'Visual workflow builder tutorial', readTime: '8 min' },
        { title: 'Workflow Triggers', description: 'Understanding events that start workflows', readTime: '6 min' },
        { title: 'Email Automation', description: 'Automate email sending with workflows', readTime: '7 min' },
        { title: 'Social Media Scheduling', description: 'Auto-post to Twitter, LinkedIn, Facebook', readTime: '9 min' },
        { title: 'Advanced Workflows', description: 'Complex automation with conditions and loops', readTime: '12 min' }
      ]
    },
    {
      id: 'security',
      title: 'Security & Privacy',
      icon: Lock,
      color: 'bg-red-500',
      articles: [
        { title: 'Account Security', description: 'Enable 2FA and secure your account', readTime: '4 min' },
        { title: 'Data Privacy', description: 'How we protect your information', readTime: '6 min' },
        { title: 'GDPR Compliance', description: 'Understanding data protection rights', readTime: '8 min' },
        { title: 'OAuth Security', description: 'Secure third-party integrations', readTime: '5 min' }
      ]
    }
  ];

  const popularArticles = [
    { title: 'How to Connect Google Calendar', category: 'Integrations', views: '15.2k', link: '/knowledge-base/integrations' },
    { title: 'Creating Professional Invoices', category: 'Business Tools', views: '12.8k', link: '/knowledge-base/business-tools' },
    { title: 'HMRC Integration Setup Guide', category: 'Financial', views: '10.5k', link: '/knowledge-base/financial-tools' },
    { title: 'Workflow Automation Basics', category: 'Workflows', views: '9.3k', link: '/knowledge-base/workflows' },
    { title: 'CRM System Complete Guide', category: 'Business Tools', views: '8.7k', link: '/knowledge-base/business-tools' }
  ];

  const filteredCategories = categories.map(category => ({
    ...category,
    articles: category.articles.filter(article =>
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.articles.length > 0 || searchQuery === '');

  return (
    <>
      <SEOHead 
        title="Knowledge Base | B2BNEST Documentation & Guides"
        description="Comprehensive guides, tutorials, and documentation for all B2BNEST features including business tools, integrations, workflows, and financial management."
        keywords="knowledge base, documentation, guides, tutorials, help articles, how-to, user manual"
      />
      
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-4 py-12">
          {/* Header */}
          <div className="text-center mb-12">
            <Book className="h-16 w-16 mx-auto mb-4 text-primary" />
            <h1 className="text-4xl font-bold mb-4">Knowledge Base</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Everything you need to know about using B2BNEST
            </p>

            {/* Search */}
            <div className="max-w-2xl mx-auto relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
              <Input
                type="text"
                placeholder="Search articles, guides, and tutorials..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-14 text-lg"
              />
            </div>
          </div>

          {/* Popular Articles */}
          {!searchQuery && (
            <Card className="mb-12">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Popular Articles
                </CardTitle>
                <CardDescription>Most viewed guides this month</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {popularArticles.map((article, index) => (
                    <Link 
                      key={index}
                      to={article.link}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <h4 className="font-medium">{article.title}</h4>
                          <p className="text-sm text-muted-foreground">{article.category}</p>
                        </div>
                      </div>
                      <Badge variant="secondary">{article.views} views</Badge>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Categories */}
          <Tabs defaultValue={categories[0].id} className="w-full">
            <TabsList className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 h-auto">
              {filteredCategories.map((category) => (
                <TabsTrigger 
                  key={category.id} 
                  value={category.id}
                  className="flex flex-col items-center gap-2 py-3"
                >
                  <category.icon className="h-5 w-5" />
                  <span className="text-xs">{category.title}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {filteredCategories.map((category) => (
              <TabsContent key={category.id} value={category.id} className="mt-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg ${category.color}`}>
                        <category.icon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <CardTitle>{category.title}</CardTitle>
                        <CardDescription>{category.articles.length} articles available</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-4">
                      {category.articles.map((article, index) => (
                        <Card key={index} className="hover:shadow-md transition-shadow cursor-pointer">
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <CardTitle className="text-lg">{article.title}</CardTitle>
                              <Badge variant="outline">{article.readTime}</Badge>
                            </div>
                            <CardDescription>{article.description}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <Button asChild variant="ghost" className="w-full justify-start">
                              <Link to={`/knowledge-base/${category.id}`}>
                                Read Article
                                <ExternalLink className="ml-2 h-4 w-4" />
                              </Link>
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>

          {/* Need More Help */}
          <Card className="mt-12 bg-primary/5 border-primary/20">
            <CardContent className="text-center py-8">
              <h3 className="text-2xl font-bold mb-4">Can't Find What You're Looking For?</h3>
              <p className="text-muted-foreground mb-6">
                Our support team is ready to help you with any questions
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                <Button asChild size="lg">
                  <Link to="/help">Visit Help Center</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/contact">Contact Support</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default KnowledgeBase;
