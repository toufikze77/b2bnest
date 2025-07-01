
import { Button } from '@/components/ui/button';
import { Bitcoin, Wallet } from 'lucide-react';

const CryptoPaymentSection = () => {
  return (
    <div className="mt-8 p-6 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg border border-orange-200">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-2 flex items-center justify-center">
          <Bitcoin className="h-8 w-8 mr-3 text-orange-600" />
          We Accept Crypto Payments
        </h3>
        <p className="text-lg font-semibold text-orange-800">Easy & Seamless Cryptocurrency Payments</p>
      </div>

      <div className="space-y-4">
        <p className="text-center text-gray-700 text-lg">
          We accept crypto payments for our products and services, making it easy for crypto enthusiasts 
          to use their digital currencies with us.
        </p>
        
        <div className="bg-white p-4 rounded-lg border border-orange-300">
          <p className="text-gray-700 text-center mb-4">
            <strong>Whether you're a seasoned crypto enthusiast or new to the world of digital currencies,</strong> 
            we've made it easy and seamless to pay with crypto.
          </p>
          
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">
              <strong>How it works:</strong>
            </p>
            <p className="text-sm text-gray-600">
              Simply choose your preferred cryptocurrency at checkout and follow the instructions
            </p>
          </div>
        </div>

        {/* Solana Pay Option */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-lg border border-purple-200">
          <div className="flex items-center justify-center mb-3">
            <Wallet className="h-6 w-6 text-purple-600 mr-2" />
            <h4 className="text-lg font-semibold text-purple-800">Solana Pay Available</h4>
          </div>
          <p className="text-center text-purple-700 text-sm mb-4">
            Fast, low-cost payments with Solana blockchain technology
          </p>
          <div className="text-center">
            <Button className="bg-purple-600 hover:bg-purple-700 text-white">
              <Wallet className="h-4 w-4 mr-2" />
              Pay with Solana
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CryptoPaymentSection;
