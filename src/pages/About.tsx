import { FileText, Users, Shield, Award, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import VideoTutorialSection from "@/components/fundraising/VideoTutorialSection";

const About = () => {
  const navigate = useNavigate();
  
  const values = [
    {
      icon: FileText,
      title: "Quality Documentation",
      description: "We provide professionally crafted business documents that meet industry standards and legal requirements."
    },
    {
      icon: Users,
      title: "Customer-Centric",
      description: "Our platform is designed with businesses in mind, offering intuitive tools and exceptional support."
    },
    {
      icon: Shield,
      title: "Security First",
      description: "We prioritize the security and confidentiality of your business documents and sensitive information."
    },
    {
      icon: Award,
      title: "Excellence",
      description: "We strive for excellence in everything we do, from document quality to customer service."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="flex justify-end mb-4">
            <Button
              variant="outline"
              onClick={() => navigate('/')}
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Go Back Home
            </Button>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-6">About B2BNest</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Empowering businesses with professional documentation solutions that streamline operations and ensure compliance.
          </p>
        </div>

        {/* Mission Section */}
        <div className="mb-16">
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="text-3xl text-center">Our Mission</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg text-gray-700 text-center max-w-4xl mx-auto">
                At B2BNest, we believe that every business deserves access to high-quality, professional documentation. 
                Our mission is to simplify the complex world of business paperwork by providing comprehensive templates, 
                forms, and documents that help companies operate more efficiently, maintain compliance, and focus on what they do best.
              </p>
              <div className="mt-8 p-6 bg-blue-50 rounded-lg text-center">
                <p className="text-lg text-gray-700 mb-2">
                  <strong>Need help or have questions?</strong>
                </p>
                <p className="text-gray-600">
                  Contact us at <a href="mailto:admin@b2bnest.online" className="text-blue-600 hover:underline font-medium">admin@b2bnest.online</a>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Values Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Our Values</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => {
              const IconComponent = value.icon;
              return (
                <Card key={index} className="bg-white shadow-lg hover:shadow-xl transition-shadow">
                  <CardHeader className="text-center">
                    <div className="mx-auto bg-blue-100 p-3 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                      <IconComponent className="h-8 w-8 text-blue-600" />
                    </div>
                    <CardTitle className="text-xl">{value.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-center">
                      {value.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Story Section */}
        <div className="mb-16">
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-3xl text-center">Our Story</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6 text-lg text-gray-700">
                <p>
                  Founded in 2024, B2BNest emerged from a simple observation: businesses spend countless hours 
                  creating and recreating the same types of documents, often without the legal expertise or 
                  design skills needed to make them truly professional.
                </p>
                <p>
                  Our founders, experienced entrepreneurs and legal professionals, recognized the need for a 
                  comprehensive platform that would democratize access to high-quality business documentation. 
                  They envisioned a world where any business, regardless of size or industry, could access 
                  the same caliber of documents used by Fortune 500 companies.
                </p>
                <p>
                  Today, B2BNest serves thousands of businesses worldwide, from startups to established 
                  enterprises, helping them streamline their operations and maintain professional standards 
                  in all their documentation needs.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Video Section */}
        <div className="mb-16">
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="text-3xl text-center">Learn More About B2BNest</CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <VideoTutorialSection />
            </CardContent>
          </Card>
        </div>

        {/* Team Section */}
        <div>
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Our Commitment</h2>
          <Card className="bg-white shadow-lg">
            <CardContent className="p-8">
              <p className="text-lg text-gray-700 text-center max-w-4xl mx-auto">
                We're committed to continuously improving our platform, expanding our template library, 
                and providing exceptional support to help your business succeed. Your success is our success, 
                and we're here to support you every step of the way.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default About;
