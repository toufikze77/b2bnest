
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink } from 'lucide-react';

interface PurchasePanelProps {
  presalePrice: string;
  tokenSymbol: string;
  minContribution: string;
  maxContribution: string;
}

const PurchasePanel = ({ presalePrice, tokenSymbol, minContribution, maxContribution }: PurchasePanelProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <ExternalLink className="h-5 w-5 mr-2" />
          Official Presale
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center space-y-4">
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm text-green-800 mb-3">
              Ready to invest in B2BNest? Visit our official presale on PinkFinance to purchase {tokenSymbol} tokens securely.
            </p>
            <Button asChild className="w-full" size="lg">
              <a href="https://www.pinksale.finance" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Invest on PinkFinance
              </a>
            </Button>
          </div>
          
          <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-xs text-yellow-800">
              <strong>Note:</strong> All investments must be made through our official PinkFinance presale page. 
              This ensures security and proper token distribution.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PurchasePanel;
