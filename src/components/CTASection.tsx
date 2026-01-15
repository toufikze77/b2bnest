
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const CTASection = () => {
  const { user } = useAuth();
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-primary">
      <div className="max-w-4xl mx-auto text-center">
        <h3 className="text-4xl font-bold text-primary-foreground mb-6">
          Ready to Streamline Your Business Documentation?
        </h3>
        <p className="text-xl text-primary-foreground/80 mb-8">
          Start with our free templates or unlock the full library with our premium plans.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            size="lg" 
            variant="secondary" 
            className="text-lg px-8 py-3"
            onClick={() => window.location.href = '/'}
          >
            Browse Templates
          </Button>
          <Button 
            size="lg" 
            variant="outline" 
            className="text-lg px-8 py-3 text-primary-foreground border-primary-foreground bg-transparent hover:bg-primary-foreground hover:text-primary transition-colors duration-200"
            onClick={() => window.location.href = '/auth'}
          >
            Start 14-Day Free Trial
          </Button>
        </div>
        <p className="text-primary-foreground/70 text-sm mt-4">
          No credit card required • Cancel anytime
        </p>
      </div>
    </section>
  );
};

export default CTASection;
