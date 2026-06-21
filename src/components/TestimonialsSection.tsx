
import { Card, CardContent } from '@/components/ui/card';
import { Star } from 'lucide-react';

const TestimonialsSection = () => {
  const testimonials = [
    {
      id: 1,
      name: "Sarah Johnson",
      role: "CEO, TechStart Solutions",
      company: "TechStart Solutions",
      content: "B2BNest unified our CRM, invoicing and project management in one place. We replaced three separate subscriptions and our team is far more productive.",
      rating: 5,
      avatar: "SJ"
    },
    {
      id: 2,
      name: "Michael Chen",
      role: "Operations Director",
      company: "Growth Dynamics",
      content: "The cash flow tracker and AI business advisor give us real insight into our numbers. It's like having a finance team built into the platform.",
      rating: 5,
      avatar: "MC"
    },
    {
      id: 3,
      name: "Emily Rodriguez",
      role: "Small Business Owner",
      company: "Creative Studios LLC",
      content: "As a small business owner, having a CRM, invoicing and project management at this price point is incredible. B2BNest pays for itself every month.",
      rating: 5,
      avatar: "ER"
    },
    {
      id: 4,
      name: "David Park",
      role: "Operations Manager",
      company: "Streamline Corp",
      content: "The range of business tools is impressive. We've streamlined our entire operations workflow with B2BNest's unified dashboard.",
      rating: 5,
      avatar: "DP"
    },
    {
      id: 5,
      name: "Lisa Thompson",
      role: "Finance Consultant",
      company: "Thompson & Associates",
      content: "I regularly recommend B2BNest to my clients. The financial tracking, ROI calculator and HMRC integration cover what most small businesses need.",
      rating: 5,
      avatar: "LT"
    },
    {
      id: 6,
      name: "James Wilson",
      role: "Startup Founder",
      company: "Innovation Labs",
      content: "Starting a business is complex enough. B2BNest made running operations simple — CRM, projects, invoicing and payroll all in one place.",
      rating: 5,
      avatar: "JW"
    }
  ];

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ));
  };

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h3 className="text-3xl font-bold text-gray-900 mb-4">
            What Our Clients Say
          </h3>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Join thousands of businesses who trust B2BNest to run and scale their
            operations
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial) => (
            <Card key={testimonial.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center mb-4">
                  {renderStars(testimonial.rating)}
                </div>
                
                <p className="text-gray-700 mb-6 leading-relaxed">
                  "{testimonial.content}"
                </p>
                
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold mr-4">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {testimonial.name}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {testimonial.role}
                    </p>
                    <p className="text-sm text-blue-600">
                      {testimonial.company}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
