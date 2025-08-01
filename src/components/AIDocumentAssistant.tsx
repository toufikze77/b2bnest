import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Zap, MessageSquare, Settings, TrendingUp, FileText, Users, Calculator, CreditCard, Info, HelpCircle } from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  templates?: any[];
  quickActions?: string[];
  timestamp: Date;
}

interface AIDocumentAssistantProps {
  onTemplateSelect?: (template: any) => void;
}

const AIDocumentAssistant = ({ onTemplateSelect }: AIDocumentAssistantProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [currentCategory, setCurrentCategory] = useState('General');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: "👋 Welcome to B2BNEST! I'm your AI Business Assistant. I can help you understand our platform features, pricing plans, and guide you through our CRM, project management, financial tools, and more. What would you like to know?",
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Enhanced platform knowledge base
  const platformFeatures = {
    'CRM': {
      features: [
        'Contact & Lead Management',
        'Sales Pipeline Tracking',
        'Deal Management & Forecasting',
        'Customer Communication History',
        'Email Marketing Integration',
        'Sales Analytics & Reports',
        'Customer Segmentation',
        'Automated Follow-ups'
      ],
      pricing: 'Starting at $29/month per user'
    },
    'Project Management': {
      features: [
        'Task & Project Creation',
        'Team Collaboration Tools',
        'Gantt Charts & Timeline View',
        'Resource Management',
        'Time Tracking',
        'Project Templates',
        'Progress Monitoring',
        'Team Communication'
      ],
      pricing: 'Starting at $19/month per user'
    },
    'Finance': {
      features: [
        'Invoice Generation & Management',
        'Expense Tracking',
        'Financial Reporting',
        'ROI Calculations',
        'Budget Planning',
        'Payment Processing',
        'Tax Management',
        'Financial Analytics Dashboard'
      ],
      pricing: 'Starting at $39/month per user'
    },
    'Trading': {
      features: [
        'Portfolio Management',
        'Market Analysis Tools',
        'Real-time Price Tracking',
        'Risk Assessment',
        'Trading Alerts',
        'Performance Analytics',
        'Market Research Reports',
        'Investment Tracking'
      ],
      pricing: 'Starting at $49/month per user'
    },
    'Documents': {
      features: [
        'Document Templates Library',
        'Contract Generation',
        'Legal Forms & Compliance',
        'Document Collaboration',
        'Version Control',
        'Digital Signatures',
        'Document Storage & Search',
        'Automated Workflows'
      ],
      pricing: 'Starting at $15/month per user'
    }
  };

  const subscriptionPlans = {
    'Starter': {
      price: '$49/month',
      features: ['Basic CRM (5 users)', 'Project Management', 'Document Templates', 'Email Support'],
      bestFor: 'Small teams getting started'
    },
    'Professional': {
      price: '$99/month',
      features: ['Full CRM (15 users)', 'Advanced Project Management', 'Financial Tools', 'Trading Basic', 'Phone Support'],
      bestFor: 'Growing businesses'
    },
    'Enterprise': {
      price: '$199/month',
      features: ['Unlimited CRM users', 'All Features Included', 'Advanced Trading Tools', 'Custom Integrations', 'Dedicated Support'],
      bestFor: 'Large organizations'
    },
    'Custom': {
      price: 'Contact Sales',
      features: ['Tailored Solutions', 'Custom Development', 'White-label Options', 'Premium Support'],
      bestFor: 'Specific business needs'
    }
  };

  const categories = [
    { id: 'General', name: 'Platform Overview', icon: Info, description: 'General platform information' },
    { id: 'CRM', name: 'CRM', icon: Users, description: 'Customer Relationship Management' },
    { id: 'Project Management', name: 'Projects', icon: Settings, description: 'Task & Team Management' },
    { id: 'Finance', name: 'Finance', icon: Calculator, description: 'Financial Management Tools' },
    { id: 'Trading', name: 'Trading', icon: TrendingUp, description: 'Trading & Investment Tools' },
    { id: 'Documents', name: 'Documents', icon: FileText, description: 'Document Management' },
    { id: 'Pricing', name: 'Pricing', icon: CreditCard, description: 'Plans & Subscriptions' },
    { id: 'Support', name: 'Help', icon: HelpCircle, description: 'Support & Getting Started' }
  ];

  const quickQuestions = {
    'General': [
      "What is B2BNest.online?",
      "What features are available?",
      "How do I get started?",
      "What integrations do you support?"
    ],
    'CRM': [
      "What CRM features are included?",
      "How much does CRM cost?",
      "Can I import my existing contacts?",
      "What sales analytics are available?"
    ],
    'Project Management': [
      "What project management tools do you offer?",
      "How does team collaboration work?",
      "Can I create custom project templates?",
      "What's the pricing for project management?"
    ],
    'Finance': [
      "What financial tools are available?",
      "How does invoice generation work?",
      "Can I track expenses and ROI?",
      "What's included in financial reporting?"
    ],
    'Trading': [
      "What trading features do you offer?",
      "How does portfolio management work?",
      "What market analysis tools are included?",
      "What's the cost for trading tools?"
    ],
    'Documents': [
      "What document templates are available?",
      "Can I create custom contracts?",
      "How does document collaboration work?",
      "What's the pricing for document management?"
    ],
    'Pricing': [
      "What subscription plans do you offer?",
      "What's included in each plan?",
      "Is there a free trial available?",
      "Can I upgrade or downgrade anytime?"
    ],
    'Support': [
      "How do I get help?",
      "What training resources are available?",
      "How do I contact support?",
      "What's your response time?"
    ]
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateResponse = (message: string, category: string): { response: string; quickActions: string[] } => {
    const lowerMessage = message.toLowerCase();
    
    // Pricing-related questions
    if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('plan') || category === 'Pricing') {
      if (lowerMessage.includes('crm')) {
        return {
          response: `Our CRM module starts at $29/month per user and includes: ${platformFeatures.CRM.features.join(', ')}. It's also included in our Professional ($99/month) and Enterprise ($199/month) plans with additional features.`,
          quickActions: ['Show me all pricing plans', 'What\'s included in CRM?', 'Is there a free trial?']
        };
      }
      
      const planNames = Object.keys(subscriptionPlans);
      const planDetails = planNames.map(plan => {
        const details = subscriptionPlans[plan as keyof typeof subscriptionPlans];
        return `**${plan}**: ${details.price} - ${details.bestFor}`;
      }).join('\n');
      
      return {
        response: `Here are our B2BNest.online subscription plans:\n\n${planDetails}\n\nAll plans include basic support and core platform access. Would you like details about a specific plan?`,
        quickActions: ['Tell me about Professional plan', 'What\'s in Enterprise?', 'Start free trial']
      };
    }

    // Feature-specific questions
    if (category !== 'General' && category !== 'Pricing' && category !== 'Support') {
      const categoryData = platformFeatures[category as keyof typeof platformFeatures];
      if (categoryData) {
        return {
          response: `Our ${category} module includes these powerful features:\n\n${categoryData.features.map(f => `• ${f}`).join('\n')}\n\n${categoryData.pricing}\n\nWould you like to know more about any specific feature?`,
          quickActions: [`How much does ${category} cost?`, 'Show me a demo', 'Start free trial']
        };
      }
    }

    // General platform questions
    if (lowerMessage.includes('what is') || lowerMessage.includes('about') || category === 'General') {
      return {
        response: `B2BNest.online is a comprehensive business management platform that combines:\n\n• **CRM** - Customer relationship management\n• **Project Management** - Task and team collaboration\n• **Financial Tools** - Invoicing, expense tracking, analytics\n• **Trading Tools** - Portfolio management and market analysis\n• **Document Management** - Templates, contracts, and workflows\n\nAll integrated in one powerful platform starting at just $49/month!`,
        quickActions: ['Show me pricing plans', 'What features are included?', 'How do I get started?']
      };
    }

    // Getting started questions
    if (lowerMessage.includes('start') || lowerMessage.includes('begin') || lowerMessage.includes('setup')) {
      return {
        response: `Getting started with B2BNest.online is easy:\n\n1. **Sign up** for a free 14-day trial\n2. **Choose your modules** based on your needs\n3. **Import your data** using our migration tools\n4. **Set up your team** and invite users\n5. **Get training** with our onboarding sessions\n\nOur support team will guide you through every step!`,
        quickActions: ['Start free trial', 'Book a demo', 'Contact sales']
      };
    }

    // Support questions
    if (lowerMessage.includes('support') || lowerMessage.includes('help') || category === 'Support') {
      return {
        response: `We offer comprehensive support:\n\n• **24/7 Email Support** (all plans)\n• **Phone Support** (Professional & Enterprise)\n• **Live Chat** during business hours\n• **Knowledge Base** with tutorials\n• **Video Training** sessions\n• **Dedicated Account Manager** (Enterprise)\n\nAverage response time: 2 hours for email, immediate for chat/phone.`,
        quickActions: ['Contact support now', 'View knowledge base', 'Schedule training']
      };
    }

    // Integration questions
    if (lowerMessage.includes('integrat') || lowerMessage.includes('connect')) {
      return {
        response: `B2BNest.online integrates with 100+ popular tools:\n\n• **Email**: Gmail, Outlook, Mailchimp\n• **Accounting**: QuickBooks, Xero, Sage\n• **Communication**: Slack, Microsoft Teams\n• **Storage**: Google Drive, Dropbox, OneDrive\n• **E-commerce**: Shopify, WooCommerce\n• **Custom APIs** available for Enterprise plans`,
        quickActions: ['See all integrations', 'Request custom integration', 'Technical documentation']
      };
    }

    // Default response
    return {
      response: `I'd be happy to help you learn more about B2BNest.online! I can provide information about our features, pricing, integrations, and help you get started. What specific area would you like to know more about?`,
      quickActions: quickQuestions[category as keyof typeof quickQuestions] || quickQuestions['General']
    };
  };

  const handleSendMessage = async (messageText?: string) => {
    const message = messageText || inputValue.trim();
    if (!message) return;

    const userMessage: Message = {
      id: Date.now().toString() + '_user',
      type: 'user',
      content: message,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Simulate AI thinking time
    setTimeout(() => {
      const { response, quickActions } = generateResponse(message, currentCategory);
      
      const assistantMessage: Message = {
        id: Date.now().toString() + '_assistant',
        type: 'assistant',
        content: response,
        quickActions: quickActions,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 1000);
  };

  const handleCategorySelect = (categoryId: string) => {
    setCurrentCategory(categoryId);
    const category = categories.find(c => c.id === categoryId);
    
    const welcomeMessage: Message = {
      id: Date.now().toString() + '_category',
      type: 'assistant',
      content: `Great! I'm here to help you with ${category?.name}. ${category?.description}. Here are some things I can help you with:`,
      quickActions: quickQuestions[categoryId as keyof typeof quickQuestions]?.slice(0, 3) || [],
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, welcomeMessage]);
  };

  const handleQuickQuestion = (question: string) => {
    handleSendMessage(question);
  };

  const ChatMessage = ({ message }: { message: Message }) => (
    <div className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] rounded-lg p-3 ${
        message.type === 'user' 
          ? 'bg-blue-600 text-white' 
          : 'bg-gray-100 text-gray-800'
      }`}>
        <div className="whitespace-pre-wrap text-sm">{message.content}</div>
        {message.quickActions && message.quickActions.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => handleQuickQuestion(action)}
                className="block w-full text-left text-xs bg-white/20 hover:bg-white/30 rounded px-2 py-1 transition-colors"
              >
                {action}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const TypingIndicator = () => (
    <div className="flex justify-start mb-4">
      <div className="bg-gray-100 rounded-lg p-3">
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    </div>
  );

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
      >
        <Sparkles className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 h-[650px] flex flex-col">
      <div className="flex-1 flex flex-col bg-white rounded-lg shadow-2xl border">
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white rounded-t-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-white/20 rounded-lg">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">B2BNest AI Assistant</h3>
                <div className="flex items-center gap-1 text-sm text-blue-100">
                  <Zap className="h-3 w-3" />
                  <span>Platform Expert</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-white/20 p-1 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 p-3 text-sm font-medium ${
                activeTab === 'chat' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`flex-1 p-3 text-sm font-medium ${
                activeTab === 'categories' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'
              }`}
            >
              Topics
            </button>
          </div>
          
          {activeTab === 'chat' ? (
            <>
              <div className="flex items-center gap-2 p-3 bg-gray-50 border-b">
                <div className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                  {categories.find(c => c.id === currentCategory)?.icon && 
                    React.createElement(categories.find(c => c.id === currentCategory)!.icon, { className: "h-3 w-3" })
                  }
                  {currentCategory}
                </div>
                <span className="text-xs text-gray-600">Active Topic</span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <ChatMessage key={message.id} message={message} />
                  ))}
                  
                  {isTyping && <TypingIndicator />}
                </div>
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask about features, pricing, or getting started..."
                    className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    disabled={isTyping}
                  />
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={isTyping || !inputValue.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                <h3 className="font-medium text-gray-900 mb-3">Choose a Topic</h3>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    className={`w-full p-4 rounded-lg border text-left transition-colors ${
                      currentCategory === category.id 
                        ? 'bg-blue-50 border-blue-200' 
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => {
                      handleCategorySelect(category.id);
                      setActiveTab('chat');
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <category.icon className="h-5 w-5 text-blue-600" />
                      <span className="font-medium">{category.name}</span>
                    </div>
                    <span className="text-xs text-gray-600">{category.description}</span>
                  </button>
                ))}
                
                <div className="mt-6 p-3 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Popular Questions</h4>
                  <div className="space-y-2">
                    {quickQuestions[currentCategory as keyof typeof quickQuestions]?.map((question, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          handleQuickQuestion(question);
                          setActiveTab('chat');
                        }}
                        className="w-full text-left text-xs bg-white border rounded p-2 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIDocumentAssistant;