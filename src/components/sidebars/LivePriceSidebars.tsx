import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { X, Bitcoin, Globe } from 'lucide-react';
import CryptoPriceSidebar from './CryptoPriceSidebar';
import ForexPriceSidebar from './ForexPriceSidebar';

interface LivePriceSidebarsProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'crypto' | 'forex';
}

const LivePriceSidebars: React.FC<LivePriceSidebarsProps> = ({ 
  isOpen, 
  onClose, 
  defaultTab = 'crypto' 
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab);

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-16 z-40 w-80 h-[calc(100vh-4rem)] bg-background border-l border-border shadow-xl transition-transform duration-300 transform translate-x-0">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-semibold">Live Market Prices</h2>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onClose}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Tabs 
        value={activeTab} 
        onValueChange={(value) => setActiveTab(value as 'crypto' | 'forex')}
        className="h-full"
      >
        <TabsList className="grid w-full grid-cols-2 mx-4 mt-4">
          <TabsTrigger value="crypto" className="flex items-center gap-2">
            <Bitcoin className="h-4 w-4" />
            Crypto
          </TabsTrigger>
          <TabsTrigger value="forex" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Forex
          </TabsTrigger>
        </TabsList>

        <TabsContent value="crypto" className="mt-4 h-full">
          <CryptoPriceSidebar />
        </TabsContent>

        <TabsContent value="forex" className="mt-4 h-full">
          <ForexPriceSidebar />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LivePriceSidebars;