import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, X } from 'lucide-react';

interface Purchase {
  id: string;
  name: string;
  plan: string;
  price: number;
  timestamp: Date;
}

const LivePurchaseNotification = () => {
  const [currentPurchase, setCurrentPurchase] = useState<Purchase | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Mock purchase data - in real app, this would come from a real-time source
  const mockPurchases: Purchase[] = [
    { id: '1', name: 'Sarah M.', plan: 'Professional', price: 19, timestamp: new Date() },
    { id: '2', name: 'John D.', plan: 'Starter', price: 11, timestamp: new Date() },
    { id: '3', name: 'Emma L.', plan: 'Enterprise', price: 29, timestamp: new Date() },
    { id: '4', name: 'Michael R.', plan: 'Professional', price: 19, timestamp: new Date() },
    { id: '5', name: 'Lisa K.', plan: 'Starter', price: 11, timestamp: new Date() },
    { id: '6', name: 'David C.', plan: 'Enterprise', price: 29, timestamp: new Date() },
    { id: '7', name: 'Anna S.', plan: 'Professional', price: 19, timestamp: new Date() },
    { id: '8', name: 'Tom B.', plan: 'Starter', price: 11, timestamp: new Date() },
  ];

  useEffect(() => {
    const showRandomPurchase = () => {
      const randomPurchase = mockPurchases[Math.floor(Math.random() * mockPurchases.length)];
      setCurrentPurchase({
        ...randomPurchase,
        timestamp: new Date()
      });
      setIsVisible(true);

      // Hide after 5 seconds
      setTimeout(() => {
        setIsVisible(false);
      }, 5000);
    };

    // Show first notification after 3 seconds
    const initialTimeout = setTimeout(showRandomPurchase, 3000);

    // Then show every 8-15 seconds
    const interval = setInterval(() => {
      const randomDelay = Math.random() * 7000 + 8000; // 8-15 seconds
      setTimeout(showRandomPurchase, randomDelay);
    }, 15000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!currentPurchase || !isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 animate-in slide-in-from-left duration-500">
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-green-600" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">
              <span className="font-semibold">{currentPurchase.name}</span> just purchased
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                {currentPurchase.plan}
              </Badge>
              <span className="text-sm font-semibold text-green-600">
                £{currentPurchase.price}/month
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {new Date().toLocaleTimeString()} • Limited time offer
            </p>
          </div>

          <button
            onClick={handleClose}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LivePurchaseNotification;