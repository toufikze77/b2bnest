
import { Card, CardContent } from '@/components/ui/card';
import { Star } from 'lucide-react';

const TestimonialsSection = () => {
  const testimonials = [
    {
      id: 1,
      name: "Sarah Johnson",
      role: "CEO, TechStart Solutions",
      company: "TechStart Solutions",
      content: "BizDocHub has revolutionized how we handle our legal documents. The professional templates saved us thousands in legal fees and countless hours of work.",
      rating: 5,
      avatar: "SJ"
    },
    {
      id: 2,
      name: "Michael Chen",
      role: "HR Director",
      company: "Growth Dynamics",
      content: "The HR forms and onboarding documents are exactly what we needed. Everything is compliant and professionally designed. Highly recommended!",
      rating: 5,
      avatar: "MC"
    },
    {
      id: 3,
      name: "Emily Rodriguez",
      role: "Small Business Owner",
      company: "Creative Studios LLC",
      content: "As a small business owner, having access to professional-grade documents at this price point is incredible. The invoice templates alone paid for themselves.",
      rating: 5,
      avatar: "ER"
    },
    {
      id: 4,
      name: "David Park",
      role: "Operations Manager",
      company: "Streamline Corp",
      content: "The variety and quality of business forms available is impressive. We've streamlined our entire documentation process using BizDocHub templates.",
      rating: 5,
      avatar: "DP"
    },
    {
      id: 5,
      name: "Lisa Thompson",
      role: "Legal Consultant",
      company: "Thompson & Associates",
      content: "I regularly recommend BizDocHub to my clients. The legal documents are well-structured and cover all the essential bases for small to medium businesses.",
      rating: 5,
      avatar: "LT"
    },
    {
      id: 6,
      name: "James Wilson",
      role: "Startup Founder",
      company: "Innovation Labs",
      content: "Starting a business is complex enough. BizDocHub made the documentation side simple and professional. Great value for money!",
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
            Join thousands of satisfied businesses who trust BizDocHub for their 
            professional document needs
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

        {/* Trust indicators */}
        <div className="mt-16 text-center">
          <p className="text-gray-600 mb-8">Trusted by businesses worldwide</p>
          <div className="flex justify-center items-center space-x-8 text-gray-400">
            <div className="text-2xl font-bold">10,000+</div>
            <div className="text-gray-300">|</div>
            <div className="text-2xl font-bold">50+</div>
            <div className="text-gray-300">|</div>
            <div className="text-2xl font-bold">99%</div>
          </div>
          <div className="flex justify-center items-center space-x-8 text-sm text-gray-500 mt-2">
            <div>Happy Customers</div>
            <div className="text-gray-300">|</div>
            <div>Countries Served</div>
            <div className="text-gray-300">|</div>
            <div>Satisfaction Rate</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
