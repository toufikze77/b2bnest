import { Home, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";

// No articles are published yet. The page says so, and lists the topics planned, with no invented authors,
// dates, read times or search-engine article data.
const PLANNED_TOPICS = [
  { title: "Essential business documents every start-up needs", category: "Start-up" },
  { title: "Understanding employment contracts", category: "HR and legal" },
  { title: "Moving your document workflow online", category: "Technology" },
  { title: "Keeping track of the rules that apply to your business", category: "Compliance" },
  { title: "Where AI helps with business paperwork, and where it doesn't", category: "AI" },
  { title: "Negotiating contracts: practical tips", category: "Business strategy" },
];

const Blog = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-background dark:to-background">
      <SEOHead
        title="Blog | B2BNest"
        description="The B2BNest blog. No articles are published yet; see the topics we plan to cover."
        canonicalUrl="https://www.b2bnest.online/blog"
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <div className="flex justify-end mb-4">
            <Button variant="outline" onClick={() => navigate('/')} className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Go Back Home
            </Button>
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-6">Blog</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            No articles are published yet. These are the topics we plan to write about first.
          </p>
        </div>

        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-label="Planned topics">
          {PLANNED_TOPICS.map((topic) => (
            <li key={topic.title}>
              <Card className="h-full">
                <CardHeader>
                  <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                    {topic.category} · Planned
                  </span>
                  <CardTitle className="text-lg leading-snug">{topic.title}</CardTitle>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>

        <Card className="mt-16">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Looking for help now?</CardTitle>
            <CardDescription>The Help page and Knowledge Base cover how B2BNEST works today.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap justify-center gap-3">
            <Button asChild><Link to="/help">Help page</Link></Button>
            <Button asChild variant="outline"><Link to="/knowledge-base">Knowledge Base</Link></Button>
            <Button asChild variant="outline"><Link to="/contact"><Mail className="mr-2 h-4 w-4" />Contact us</Link></Button>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
};

export default Blog;
