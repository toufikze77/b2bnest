
import { Button } from '@/components/ui/button';
import { Bitcoin, Wallet, CreditCard } from 'lucide-react';

const CryptoPaymentSection = () => {
  return (
    <div className="mt-8 p-6 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg border border-orange-200">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-2 flex items-center justify-center">
          <Bitcoin className="h-8 w-8 mr-3 text-orange-600" />
          Multiple Payment Options Available
        </h3>
        <p className="text-lg font-semibold text-orange-800">Easy & Seamless Payment Experience</p>
      </div>

      <div className="space-y-4">
        <p className="text-center text-gray-700 text-lg">
          We accept multiple payment methods for our products and services, making it easy for everyone 
          to use our platform regardless of their preferred payment method.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Stripe Option */}
          <div className="bg-white p-4 rounded-lg border border-blue-300">
            <div className="flex items-center justify-center mb-3">
              <CreditCard className="h-6 w-6 text-blue-600 mr-2" />
              <h4 className="text-lg font-semibold text-blue-800">Stripe</h4>
            </div>
            <p className="text-center text-blue-700 text-sm mb-4">
              Pay securely with credit cards, debit cards, and digital wallets
            </p>
            <div className="text-center">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <CreditCard className="h-4 w-4 mr-2" />
                Pay with Stripe
              </Button>
            </div>
          </div>

          {/* Coinbase Option */}
          <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-300">
            <div className="flex items-center justify-center mb-3">
              <Bitcoin className="h-6 w-6 text-orange-600 mr-2" />
              <h4 className="text-lg font-semibold text-orange-800">Coinbase</h4>
            </div>
            <p className="text-center text-orange-700 text-sm mb-4">
              Pay with Bitcoin, Ethereum, and other cryptocurrencies
            </p>
            <div className="text-center">
              <Button className="bg-orange-600 hover:bg-orange-700 text-white">
                <Bitcoin className="h-4 w-4 mr-2" />
                Pay with Coinbase
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-orange-300">
          <p className="text-gray-700 text-center mb-4">
            <strong>Choose your preferred payment method at checkout.</strong> 
            Whether you prefer traditional payment methods like Stripe and credit cards, 
            or cutting-edge crypto payments with Coinbase, we've got you covered.
          </p>
          
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">
              <strong>How it works:</strong>
            </p>
            <p className="text-sm text-gray-600">
              Select a product, choose your payment method, and complete your purchase securely
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CryptoPaymentSection;
