
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, FileText, Users, Shield, Clock, CheckCircle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const projectShowcases = [
  {
    id: 1,
    title: "E-Commerce Platform",
    description: "Full-featured online store with inventory management, payment processing, and customer analytics dashboard.",
    icon: FileText,
    features: ["Payment Integration", "Inventory Management", "Customer Analytics", "Mobile Responsive"],
    image: "photo-1556742049-0cfed4f6a45d",
    techStack: ["React", "Supabase", "Stripe", "Tailwind CSS"],
    liveUrl: "https://ecommerce-demo.lovableproject.com",
    category: "E-Commerce"
  },
  {
    id: 2,
    title: "SaaS Dashboard",
    description: "Professional SaaS application with user management, subscription billing, and real-time analytics.",
    icon: Users,
    features: ["User Authentication", "Subscription Management", "Real-time Analytics", "Team Collaboration"],
    image: "photo-1551288049-bebda4e38f71",
    techStack: ["React", "Supabase", "PayPal", "Charts"],
    liveUrl: "https://saas-dashboard-demo.lovableproject.com",
    category: "SaaS"
  },
  {
    id: 3,
    title: "Portfolio Website",
    description: "Modern portfolio site with project showcases, contact forms, and blog functionality.",
    icon: Shield,
    features: ["Project Gallery", "Contact Integration", "Blog System", "SEO Optimized"],
    image: "photo-1467232004584-a241de8bcf5d",
    techStack: ["React", "Supabase", "Email API", "Responsive Design"],
    liveUrl: "https://portfolio-demo.lovableproject.com",
    category: "Portfolio"
  },
  {
    id: 4,
    title: "Restaurant Management",
    description: "Complete restaurant solution with menu management, online ordering, and table reservations.",
    icon: Clock,
    features: ["Menu Management", "Online Ordering", "Table Reservations", "Staff Dashboard"],
    image: "photo-1517248135467-4c7edcad34c4",
    techStack: ["React", "Supabase", "Payment Gateway", "Real-time Updates"],
    liveUrl: "https://restaurant-demo.lovableproject.com",
    category: "Food & Beverage"
  },
  {
    id: 5,
    title: "Learning Management System",
    description: "Educational platform with course management, student tracking, and interactive assessments.",
    icon: CheckCircle,
    features: ["Course Creation", "Student Progress", "Interactive Quizzes", "Certification System"],
    image: "photo-1522202176988-66273c2fd55f",
    techStack: ["React", "Supabase", "Video Streaming", "Progress Tracking"],
    liveUrl: "https://lms-demo.lovableproject.com",
    category: "Education"
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
