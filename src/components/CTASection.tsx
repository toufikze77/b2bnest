
import { Button } from "@/components/ui/button";

const CTASection = () => {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-blue-600">
      <div className="max-w-4xl mx-auto text-center">
        <h3 className="text-4xl font-bold text-white mb-6">
          Ready to Streamline Your Business?
        </h3>
        <p className="text-xl text-blue-100 mb-8">
          Join thousands of businesses using our professional document templates 
          to save time and ensure compliance.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" variant="secondary" className="text-lg px-8 py-3">
            Browse All Forms
          </Button>
          <Button size="lg" variant="outline" className="text-lg px-8 py-3 text-white border-white hover:bg-white hover:text-blue-600">
            Start Free Trial
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
