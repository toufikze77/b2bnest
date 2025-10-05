import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Calculator, 
  CheckSquare, 
  Shield, 
  Lightbulb, 
  Zap, 
  Building2, 
  FileText, 
  KanbanSquare, 
  Users, 
  ArrowRight,
  Sparkles,
  Target
} from "lucide-react";

const BusinessToolsSection = () => {
  const featuredTools = [
    {
      icon: KanbanSquare,
      title: "Project Management",
      description: "Organize tasks, track progress, and collaborate with your team",
      features: ["Kanban & List views", "Task assignments", "Progress tracking"],
      color: "bg-teal-500",
      popular: true
    },
    {
      icon: Users,
      title: "CRM System",
      description: "Manage leads, contacts, and sales pipeline efficiently",
      features: ["Contact management", "Sales pipeline", "Lead tracking"],
      color: "bg-pink-500",
      popular: true
    },
    {
      icon: Lightbulb,
      title: "Startup Idea Generator",
      description: "Get AI-powered business ideas tailored to your interests and budget",
      features: ["50+ industries", "Budget-based ideas", "Instant generation"],
      color: "bg-green-500",
      popular: false
    },
    {
      icon: FileText,
      title: "Quote & Invoice",
      description: "Create professional quotes and invoices with auto-generated codes",
      features: ["Professional templates", "Auto-generated codes", "Track payments"],
      color: "bg-indigo-500",
      popular: false
    },
    {
      icon: Calculator,
      title: "Cost Calculator",
      description: "Calculate setup costs for your business structure",
      features: ["Accurate estimates", "Compare structures", "Budget planning"],
      color: "bg-blue-500",
      popular: false
    },
    {
      icon: Building2,
      title: "Business Resources",
      description: "Access trusted service providers and business partnerships",
      features: ["Verified providers", "Competitive rates", "Expert guidance"],
      color: "bg-orange-500",
      popular: false
    }
  ];

  const additionalTools = [
    { icon: CheckSquare, title: "Setup Checklist", count: "25+ Steps" },
    { icon: Shield, title: "Compliance Checker", count: "Industry Specific" },
    { icon: Zap, title: "Integrations", count: "10+ Services" }
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-6 w-6 text-primary" />
            <Badge variant="secondary" className="text-sm font-medium">
              All-in-One Business Suite
            </Badge>
          </div>
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Powerful Business Tools
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Everything you need to start, manage, and grow your business in one integrated platform. 
            From project management to CRM, we've got you covered.
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-green-500" />
              <span>Save 10+ hours/week</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <span>Team collaboration</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-purple-500" />
              <span>Automated workflows</span>
            </div>
          </div>
        </div>

        {/* Featured Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {featuredTools.map((tool, index) => {
            const Icon = tool.icon;
            return (
              <Card key={index} className="group hover:shadow-xl transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm relative overflow-hidden">
                {tool.popular && (
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-orange-500 text-white">Most Popular</Badge>
                  </div>
                )}
                <CardHeader className="pb-4">
                  <div className="flex items-start gap-4">
                    <div className={`${tool.color} p-3 rounded-xl shadow-lg group-hover:scale-110 transition-transform`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2 group-hover:text-primary transition-colors">
                        {tool.title}
                      </CardTitle>
                      <CardDescription className="text-gray-600 text-base">
                        {tool.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 mb-4">
                    {tool.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                        {feature}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Additional Tools */}
        <div className="bg-gradient-to-br from-white/80 to-purple-50/80 backdrop-blur-sm rounded-2xl p-8 mb-8 border border-purple-100/50 shadow-lg">
          <h3 className="text-3xl font-bold text-center mb-2 text-gray-900">
            ✨ Plus Many More Tools
          </h3>
          <p className="text-center text-gray-600 mb-8">Discover additional features to supercharge your business</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 justify-items-center max-w-3xl mx-auto">
            {additionalTools.map((tool, index) => {
              const Icon = tool.icon;
              const colors = [
                "from-slate-700 to-slate-800",
                "from-gray-700 to-gray-800", 
                "from-zinc-700 to-zinc-800",
                "from-stone-700 to-stone-800",
                "from-neutral-700 to-neutral-800"
              ];
              const shadowColors = [
                "shadow-slate-300",
                "shadow-gray-300",
                "shadow-zinc-300", 
                "shadow-stone-300",
                "shadow-neutral-300"
              ];
              return (
                <div key={index} className="text-center w-full max-w-[200px]">
                  <div className={`bg-gradient-to-br ${colors[index % colors.length]} p-4 rounded-2xl mb-3 ${shadowColors[index % shadowColors.length]} shadow-lg h-16 w-16 mx-auto flex items-center justify-center`}>
                    <Icon className="h-7 w-7 text-white drop-shadow-sm" />
                  </div>
                  <h4 className="font-semibold text-sm text-gray-900 mb-1">{tool.title}</h4>
                  <p className="text-xs text-gray-500">{tool.count}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link to="/business-tools">
            <Button size="lg" className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all">
              Explore All Business Tools
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <p className="text-sm text-gray-500 mt-4">
            Free to use • No credit card required • Start in minutes
          </p>
        </div>
      </div>
    </section>
  );
};

export default BusinessToolsSection;