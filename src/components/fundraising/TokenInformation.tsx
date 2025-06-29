
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

interface TokenInformationProps {
  tokenName: string;
  tokenSymbol: string;
  totalSupply: string;
  presalePrice: string;
}

const TokenInformation = ({ tokenName, tokenSymbol, totalSupply, presalePrice }: TokenInformationProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Token Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium text-gray-600">Token Name</Label>
            <p className="text-lg font-semibold">{tokenName}</p>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-600">Symbol</Label>
            <p className="text-lg font-semibold">{tokenSymbol}</p>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-600">Total Supply</Label>
            <p className="text-lg font-semibold">{totalSupply}</p>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-600">Presale Price</Label>
            <p className="text-lg font-semibold">{presalePrice} ETH</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TokenInformation;
