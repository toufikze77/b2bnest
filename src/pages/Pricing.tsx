import React from 'react';
import PricingPlans from '@/components/PricingPlans';
import Footer from '@/components/Footer';
import PinkSaleCTA from '@/components/PinkSaleCTA';

const Pricing = () => {
  return (
    <>
      <PricingPlans />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <PinkSaleCTA variant="large" />
      </div>
      <Footer />
    </>
  );
};

export default Pricing;