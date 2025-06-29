
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, FileText, Users, Shield, Clock, CheckCircle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const services = [
  {
    id: 1,
    title: "Document Management",
    description: "Comprehensive document creation, storage, and management solutions for your business needs.",
    icon: FileText,
    features: ["Template Library", "Version Control", "Digital Signatures", "Secure Storage"],
    image: "photo-1486312338219-ce68d2c6f44d"
  },
  {
    id: 2,
    title: "Team Collaboration",
    description: "Enhanced collaboration tools to streamline your team's workflow and productivity.",
    icon: Users,
    features: ["Real-time Editing", "Team Comments", "Role-based Access", "Activity Tracking"],
    image: "photo-1461749280684-dccba630e2f6"
  },
  {
    id: 3,
    title: "Compliance & Security",
    description: "Enterprise-grade security and compliance features to protect your sensitive data.",
    icon: Shield,
    features: ["Data Encryption", "Audit Trails", "GDPR Compliance", "Access Controls"],
    image: "photo-1518770660439-4636190af475"
  },
  {
    id: 4,
    title: "Quick Setup Services",
    description: "Fast deployment and setup services to get your business running in no time.",
    icon: Clock,
    features: ["24-hour Setup", "Data Migration", "Training Sessions", "Support Integration"],
    image: "photo-1488590528505-98d2b5aba04b"
  },
  {
    id: 5,
    title: "Quality Assurance",
    description: "Professional quality assurance and validation services for all your business processes.",
    icon: CheckCircle,
    features: ["Process Validation", "Quality Control", "Performance Testing", "Compliance Checks"],
    image: "photo-1460925895917-afdab827c52f"
  }
];

const ProvisionalServicesSlideshow = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % services.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % services.length);
    setIsAutoPlaying(false);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + services.length) % services.length);
    setIsAutoPlaying(false);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    setIsAutoPlaying(false);
  };

  const currentService = services[currentSlide];
  const IconComponent = currentService.icon;

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Our Provisional Services
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Discover comprehensive business solutions designed to streamline your operations and boost productivity
          </p>
        </div>

        <div className="relative">
          <Card className="overflow-hidden shadow-2xl">
            <div className="grid md:grid-cols-2 gap-0">
              {/* Image Section */}
              <div className="relative h-64 md:h-96 bg-gradient-to-br from-blue-600 to-indigo-700">
                <img
                  src={`https://images.unsplash.com/${currentService.image}?w=800&h=600&fit=crop`}
                  alt={currentService.title}
                  className="absolute inset-0 w-full h-full object-cover opacity-20"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-white">
                    <IconComponent className="h-16 w-16 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold">{currentService.title}</h3>
                  </div>
                </div>
              </div>

              {/* Content Section */}
              <CardContent className="p-6 md:p-8 flex flex-col justify-center">
                <CardHeader className="p-0 mb-6">
                  <CardTitle className="text-2xl mb-2">{currentService.title}</CardTitle>
                  <CardDescription className="text-base">
                    {currentService.description}
                  </CardDescription>
                </CardHeader>

                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-900 mb-3">Key Features:</h4>
                  {currentService.features.map((feature, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Star className="h-4 w-4 text-blue-600 fill-current" />
                      <span className="text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>

                <Button className="mt-6 w-full md:w-auto">
                  Learn More About {currentService.title}
                </Button>
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
          {services.map((_, index) => (
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
