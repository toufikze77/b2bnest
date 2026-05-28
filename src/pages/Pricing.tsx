import React from 'react';
import PricingPlans from '@/components/PricingPlans';
import BusinessToolsSection from '@/components/BusinessToolsSection';
import Footer from '@/components/Footer';
import SEOHead from '@/components/SEOHead';

const Pricing = () => {
  return (
    <>
      <SEOHead
        title="Pricing — Affordable Business Tool Plans | B2BNest"
        description="Choose the right B2BNest plan for your business. Free tools forever, premium plans from $9.99/month with CRM, AI, and more."
        canonicalUrl="https://b2bnest.lovable.app/pricing"
        ogTitle="B2BNest Pricing — Plans from $9.99/month"
        ogDescription="Transparent pricing for B2BNest's all-in-one business platform. Free tools and affordable premium plans starting at $9.99/month."
      />
      <h1 className="sr-only">Choose the Right Plan for Your Business</h1>
      <PricingPlans />
      <BusinessToolsSection />
      <Footer />
    </>
  );
};

export default Pricing;
