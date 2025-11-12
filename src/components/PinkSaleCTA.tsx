import React from 'react';
import { Zap, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PinkSaleCTAProps {
  variant?: 'default' | 'large' | 'inline';
  className?: string;
}

const PinkSaleCTA: React.FC<PinkSaleCTAProps> = ({ variant = 'default', className = '' }) => {
  const baseClasses = "inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold hover:from-purple-700 hover:to-pink-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5";
  
  if (variant === 'large') {
    return (
      <div className={`text-center ${className}`}>
        <a
          href="https://www.pinksale.finance/launchpad/ethereum/0xa3e47ea8bA047a848FF33Fa2292729327255b7B8"
          target="_blank"
          rel="noopener noreferrer"
          className={`${baseClasses} px-8 py-4 rounded-lg text-lg`}
        >
          <Zap className="h-6 w-6" />
          Join Presale on PinkSale
          <ExternalLink className="h-5 w-5" />
        </a>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <a
        href="https://www.pinksale.finance/launchpad/ethereum/0xa3e47ea8bA047a848FF33Fa2292729327255b7B8"
        target="_blank"
        rel="noopener noreferrer"
        className={`${baseClasses} px-6 py-3 rounded-lg ${className}`}
      >
        <Zap className="h-5 w-5" />
        Join Presale on PinkSale
        <ExternalLink className="h-4 w-4" />
      </a>
    );
  }

  return (
    <div className={`max-w-4xl mx-auto text-center ${className}`}>
      <a
        href="https://www.pinksale.finance/launchpad/ethereum/0xa3e47ea8bA047a848FF33Fa2292729327255b7B8"
        target="_blank"
        rel="noopener noreferrer"
        className={`${baseClasses} px-8 py-4 rounded-lg`}
      >
        <Zap className="h-5 w-5" />
        Join Presale on PinkSale
        <ExternalLink className="h-5 w-5" />
      </a>
    </div>
  );
};

export default PinkSaleCTA;
