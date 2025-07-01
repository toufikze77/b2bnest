
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, ExternalLink } from 'lucide-react';

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
          <DollarSign className="h-5 w-5 mr-2" />
          Purchase Tokens
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">Investment Details</h3>
            <div className="text-sm text-blue-800 space-y-1">
              <p><strong>Token Price:</strong> {presalePrice} ETH</p>
              <p><strong>Min Investment:</strong> {minContribution} ETH</p>
              <p><strong>Max Investment:</strong> {maxContribution} ETH</p>
            </div>
          </div>
          
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
