
import { useState, useEffect } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  Users, 
  Shield, 
  Clock, 
  CheckCircle, 
  Star,
  Kanban,
  Target,
  UserCheck,
  BarChart3,
  Calendar,
  MessageSquare,
  Briefcase,
  TrendingUp,
  Layers,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const projectShowcases = [
  {
    id: 1,
    title: "Project Management Hub",
    description: "Comprehensive project management platform with kanban boards, gantt charts, team collaboration, and automated workflows.",
    icon: Kanban,
    features: ["Kanban Boards", "Gantt Charts", "Team Collaboration", "Automated Workflows"],
    image: "photo-1611224923853-80b023f02d71",
    techStack: ["React", "Supabase", "Real-time Sync", "Drag & Drop"],
    liveUrl: "https://project-management-demo.lovableproject.com",
    category: "Project Management"
  },
  {
    id: 2,
    title: "CRM Sales Pipeline",
    description: "Advanced CRM system for managing leads, deals, customer relationships, and sales performance analytics.",
    icon: Target,
    features: ["Lead Management", "Sales Pipeline", "Customer Analytics", "Revenue Forecasting"],
    image: "photo-1460925895917-afdab827c52f",
    techStack: ["React", "Supabase", "Analytics", "Email Integration"],
    liveUrl: "https://crm-sales-demo.lovableproject.com",
    category: "CRM & Sales"
  },
  {
    id: 3,
    title: "HR Management System",
    description: "Complete HR solution for employee management, recruitment, performance tracking, and payroll processing.",
    icon: UserCheck,
    features: ["Employee Records", "Recruitment Portal", "Performance Reviews", "Payroll Integration"],
    image: "photo-1521737711867-e3b97375f902",
    techStack: ["React", "Supabase", "File Storage", "Notification System"],
    liveUrl: "https://hr-management-demo.lovableproject.com",
    category: "Human Resources"
  },
  {
    id: 4,
    title: "Marketing Campaign Manager",
    description: "Integrated marketing platform for campaign management, social media scheduling, and performance analytics.",
    icon: TrendingUp,
    features: ["Campaign Planning", "Social Media Scheduler", "Analytics Dashboard", "Content Calendar"],
    image: "photo-1432888622747-4eb9a8efeb07",
    techStack: ["React", "Supabase", "Social APIs", "Chart Libraries"],
    liveUrl: "https://marketing-manager-demo.lovableproject.com",
    category: "Marketing"
  },
  {
    id: 5,
    title: "Customer Support Portal",
    description: "Comprehensive support system with ticketing, knowledge base, live chat, and customer satisfaction tracking.",
    icon: MessageSquare,
    features: ["Ticket Management", "Knowledge Base", "Live Chat", "Customer Ratings"],
    image: "photo-1553484771-371a605b060b",
    techStack: ["React", "Supabase", "Real-time Chat", "Search Engine"],
    liveUrl: "https://support-portal-demo.lovableproject.com",
    category: "Customer Support"
  },
  {
    id: 6,
    title: "Event Management Platform",
    description: "Full-featured event planning system with registration, scheduling, attendee management, and analytics.",
    icon: Calendar,
    features: ["Event Registration", "Schedule Management", "Attendee Tracking", "Event Analytics"],
    image: "photo-1505236858219-8359eb29e329",
    techStack: ["React", "Supabase", "Payment Processing", "QR Codes"],
    liveUrl: "https://event-management-demo.lovableproject.com",
    category: "Event Management"
  },
  {
    id: 7,
    title: "Financial Dashboard",
    description: "Advanced financial management with budget tracking, expense monitoring, financial reporting, and forecasting.",
    icon: BarChart3,
    features: ["Budget Tracking", "Expense Management", "Financial Reports", "Forecasting Tools"],
    image: "photo-1554224155-6726b3ff858f",
    techStack: ["React", "Supabase", "Chart.js", "Export Tools"],
    liveUrl: "https://financial-dashboard-demo.lovableproject.com",
    category: "Finance"
  },
  {
    id: 8,
    title: "Inventory Control System",
    description: "Smart inventory management with real-time tracking, automated reordering, and supplier management.",
    icon: Layers,
    features: ["Real-time Tracking", "Auto Reordering", "Supplier Management", "Barcode Scanning"],
    image: "photo-1586528116311-ad8dd3c8310d",
    techStack: ["React", "Supabase", "Barcode API", "Automation"],
    liveUrl: "https://inventory-control-demo.lovableproject.com",
    category: "Inventory"
  },
  {
    id: 9,
    title: "Workflow Automation Suite",
    description: "Powerful automation platform for creating custom workflows, integrations, and business process automation.",
    icon: Zap,
    features: ["Workflow Builder", "API Integrations", "Process Automation", "Custom Triggers"],
    image: "photo-1518186285589-2f7649de83e0",
    techStack: ["React", "Supabase", "Webhook API", "Flow Builder"],
    liveUrl: "https://workflow-automation-demo.lovableproject.com",
    category: "Automation"
  },
  {
    id: 10,
    title: "Resource Planning Dashboard",
    description: "Enterprise resource planning with resource allocation, capacity planning, and performance optimization.",
    icon: Briefcase,
    features: ["Resource Allocation", "Capacity Planning", "Performance Metrics", "Optimization Tools"],
    image: "photo-1507003211169-0a1dd7228f2d",
    techStack: ["React", "Supabase", "Advanced Analytics", "Planning Tools"],
    liveUrl: "https://resource-planning-demo.lovableproject.com",
    category: "Enterprise Planning"
  }
];

const ProvisionalServicesSlideshow = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % projectShowcases.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % projectShowcases.length);
    setIsAutoPlaying(false);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + projectShowcases.length) % projectShowcases.length);
    setIsAutoPlaying(false);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    setIsAutoPlaying(false);
  };

  const currentProject = projectShowcases[currentSlide];
  const IconComponent = currentProject.icon;

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Professional Web Development Services - Premium Package
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Explore our premium Lovable project showcases - fully functional web applications built with modern technologies
          </p>
        </div>

        <div className="relative">
          <Card className="overflow-hidden shadow-2xl">
            <div className="grid md:grid-cols-2 gap-0">
              {/* Project Preview Section */}
              <div className="relative h-64 md:h-96 bg-gradient-to-br from-blue-600 to-indigo-700">
                <img
                  src={`https://images.unsplash.com/${currentProject.image}?w=800&h=600&fit=crop`}
                  alt={currentProject.title}
                  className="absolute inset-0 w-full h-full object-cover opacity-30"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-white">
                    <IconComponent className="h-16 w-16 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold">{currentProject.title}</h3>
                    <div className="mt-2 px-3 py-1 bg-white/20 rounded-full text-sm">
                      {currentProject.category}
                    </div>
                  </div>
                </div>
              </div>

              {/* Project Details Section */}
              <CardContent className="p-6 md:p-8 flex flex-col justify-center">
                <CardHeader className="p-0 mb-6">
                  <CardTitle className="text-2xl mb-2">{currentProject.title}</CardTitle>
                  <CardDescription className="text-base">
                    {currentProject.description}
                  </CardDescription>
                </CardHeader>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Key Features:</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {currentProject.features.map((feature, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <Star className="h-4 w-4 text-blue-600 fill-current" />
                          <span className="text-sm text-gray-700">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Tech Stack:</h4>
                    <div className="flex flex-wrap gap-2">
                      {currentProject.techStack.map((tech, index) => (
                        <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <Button className="flex-1" onClick={() => window.open(currentProject.liveUrl, '_blank')}>
                    View Live Demo
                  </Button>
                  <Button variant="outline" className="flex-1">
                    Get Similar Project
                  </Button>
                </div>
              </CardContent>
            </div>
          </Card>

          {/* Navigation Arrows */}
          <Button
            variant="outline"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow-lg"
            onClick={prevSlide}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow-lg"
            onClick={nextSlide}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Slide Indicators */}
        <div className="flex justify-center mt-8 space-x-2">
          {projectShowcases.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-3 h-3 rounded-full transition-colors ${
                index === currentSlide
                  ? "bg-blue-600"
                  : "bg-gray-300 hover:bg-gray-400"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        {/* Auto-play indicator */}
        <div className="text-center mt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAutoPlaying(!isAutoPlaying)}
            className="text-gray-600"
          >
            {isAutoPlaying ? "Pause" : "Play"} Slideshow
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ProvisionalServicesSlideshow;
