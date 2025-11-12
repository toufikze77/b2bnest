import { Calendar, User, ArrowRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Footer from "@/components/Footer";
import PinkSaleCTA from "@/components/PinkSaleCTA";

const Blog = () => {
  const navigate = useNavigate();
  
  const blogPosts = [
    {
      id: 1,
      title: "Essential Business Documents Every Startup Needs",
      excerpt: "Starting a new business? Here's a comprehensive guide to the must-have documents that will protect your company and ensure smooth operations from day one.",
      author: "Sarah Johnson",
      date: "December 28, 2024",
      category: "Startup",
      readTime: "5 min read",
      image: "photo-1554224155-6726b3ff858f"
    },
    {
      id: 2,
      title: "Understanding Employment Contracts: A Complete Guide",
      excerpt: "Navigate the complexities of employment agreements with our detailed breakdown of key clauses, legal requirements, and best practices for both employers and employees.",
      author: "Michael Chen",
      date: "December 25, 2024",
      category: "HR & Legal",
      readTime: "8 min read",
      image: "photo-1450101499163-c8848c66ca85"
    },
    {
      id: 3,
      title: "Digital Transformation: Modernizing Your Document Workflow",
      excerpt: "Learn how to transition from manual processes to AI-powered automation systems that improve efficiency and reduce operational costs.",
      author: "Emily Rodriguez",
      date: "December 22, 2024",
      category: "Technology",
      readTime: "6 min read",
      image: "photo-1460925895917-afdab827c52f"
    },
    {
      id: 4,
      title: "Compliance Made Simple: Staying on Top of Regulations",
      excerpt: "Stay compliant with ever-changing business regulations. Our guide covers the most common compliance requirements and how to manage them effectively.",
      author: "David Kim",
      date: "December 20, 2024",
      category: "Compliance",
      readTime: "7 min read",
      image: "photo-1507003211169-0a1dd7228f2d"
    },
    {
      id: 5,
      title: "The Future of Business Documentation: AI and Automation",
      excerpt: "Explore how artificial intelligence and automation are revolutionizing business documentation, making processes faster and more accurate than ever.",
      author: "Lisa Thompson",
      date: "December 18, 2024",
      category: "Innovation",
      readTime: "4 min read",
      image: "photo-1485827404703-89b55fcc595e"
    },
    {
      id: 6,
      title: "Contract Negotiation: Tips for Better Business Deals",
      excerpt: "Master the art of contract negotiation with proven strategies that help you secure favorable terms while maintaining strong business relationships.",
      author: "Robert Martinez",
      date: "December 15, 2024",
      category: "Business Strategy",
      readTime: "9 min read",
      image: "photo-1556761175-b413da4baf72"
    }
  ];

  const categories = ["All", "Startup", "HR & Legal", "Technology", "Compliance", "Innovation", "Business Strategy"];

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
          <h1 className="text-4xl font-bold text-gray-900 mb-6">AI Automation Blog</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Stay informed with the latest insights, tips, and trends in business documentation, 
            compliance, and operational efficiency.
          </p>
        </div>

        {/* Categories Filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map((category, index) => (
            <Button
              key={index}
              variant={index === 0 ? "default" : "outline"}
              className="rounded-full"
            >
              {category}
            </Button>
          ))}
        </div>

        {/* Featured Post */}
        <Card className="bg-white shadow-lg mb-12 overflow-hidden">
          <div className="md:flex">
            <div className="md:w-1/2">
              <img
                src={`https://images.unsplash.com/${blogPosts[0].image}?w=600&h=400&fit=crop`}
                alt={blogPosts[0].title}
                className="w-full h-64 md:h-full object-cover"
              />
            </div>
            <div className="md:w-1/2 p-8">
              <div className="flex items-center space-x-4 text-sm text-gray-500 mb-4">
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">
                  {blogPosts[0].category}
                </span>
                <span>Featured</span>
              </div>
              <CardTitle className="text-3xl mb-4">{blogPosts[0].title}</CardTitle>
              <CardDescription className="text-base mb-6">
                {blogPosts[0].excerpt}
              </CardDescription>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <div className="flex items-center space-x-1">
                    <User className="h-4 w-4" />
                    <span>{blogPosts[0].author}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4" />
                    <span>{blogPosts[0].date}</span>
                  </div>
                  <span>{blogPosts[0].readTime}</span>
                </div>
                <Button className="group">
                  Read More
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Blog Posts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {blogPosts.slice(1).map((post) => (
            <Card key={post.id} className="bg-white shadow-lg hover:shadow-xl transition-shadow overflow-hidden group cursor-pointer">
              <div className="relative">
                <img
                  src={`https://images.unsplash.com/${post.image}?w=400&h=250&fit=crop`}
                  alt={post.title}
                  className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-4 left-4">
                  <span className="bg-white/90 text-gray-800 px-3 py-1 rounded-full text-sm font-medium">
                    {post.category}
                  </span>
                </div>
              </div>
              <CardHeader>
                <CardTitle className="text-xl group-hover:text-blue-600 transition-colors">
                  {post.title}
                </CardTitle>
                <CardDescription>{post.excerpt}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center space-x-1">
                    <User className="h-4 w-4" />
                    <span>{post.author}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4" />
                    <span>{post.date}</span>
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-500">
                  {post.readTime}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Newsletter Signup */}
        <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg mt-16">
          <CardContent className="p-8 text-center">
            <h3 className="text-2xl font-bold mb-4">Stay Updated</h3>
            <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
              Subscribe to our newsletter and never miss the latest insights on business documentation, 
              compliance updates, and industry best practices.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-2 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-white"
              />
              <Button variant="secondary" className="whitespace-nowrap">
                Subscribe
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* PinkSale CTA */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <PinkSaleCTA variant="large" />
      </div>

      <Footer />
    </div>
  );
};

export default Blog;
