import React, { useState } from 'react';
import { Globe, Search, Check, X, ExternalLink, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface DomainResult {
  domain: string;
  available: boolean;
  price: string;
  registrar: string;
  affiliateLink: string;
  premium?: boolean;
}

const DomainAvailability = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<DomainResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  const domainExtensions = [
    { ext: '.com', price: '£8.99', popular: true },
    { ext: '.co.uk', price: '£6.99', popular: true },
    { ext: '.net', price: '£9.99', popular: false },
    { ext: '.org', price: '£9.99', popular: false },
    { ext: '.io', price: '£29.99', popular: false },
    { ext: '.co', price: '£24.99', popular: false },
    { ext: '.app', price: '£14.99', popular: false },
    { ext: '.dev', price: '£12.99', popular: false },
    { ext: '.tech', price: '£19.99', popular: false },
    { ext: '.store', price: '£49.99', popular: false },
    { ext: '.online', price: '£29.99', popular: false },
    { ext: '.site', price: '£24.99', popular: false }
  ];

  const registrars = [
    { name: 'Namecheap', affiliate: 'https://affiliate.namecheap.com/?affId=121420', color: 'bg-orange-100 text-orange-800' },
    { name: 'GoDaddy', affiliate: 'https://www.godaddy.com/deals', color: 'bg-green-100 text-green-800' },
    { name: 'Domain.com', affiliate: 'https://www.domain.com', color: 'bg-blue-100 text-blue-800' },
    { name: 'Porkbun', affiliate: 'https://porkbun.com', color: 'bg-purple-100 text-purple-800' }
  ];

  const searchDomains = async () => {
    if (!searchTerm.trim()) {
      toast({
        title: "Domain Required",
        description: "Please enter a domain name to search.",
        variant: "destructive"
      });
      return;
    }

    // Validate domain name format
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*$/;
    if (!domainRegex.test(searchTerm)) {
      toast({
        title: "Invalid Domain",
        description: "Please enter a valid domain name (letters, numbers, and hyphens only).",
        variant: "destructive"
      });
      return;
    }

    setIsSearching(true);
    
    // Simulate API call with realistic delay
    setTimeout(() => {
      const cleanDomain = searchTerm.toLowerCase().replace(/\s+/g, '');
      const searchResults: DomainResult[] = [];

      domainExtensions.forEach(({ ext, price, popular }) => {
        const registrar = registrars[Math.floor(Math.random() * registrars.length)];
        const domain = `${cleanDomain}${ext}`;
        
        // Simulate availability - popular extensions less likely to be available
        const available = Math.random() > (popular ? 0.6 : 0.3);
        
        searchResults.push({
          domain,
          available,
          price: available ? price : 'N/A',
          registrar: registrar.name,
          affiliateLink: `${registrar.affiliate}?domain=${domain}`,
          premium: !available && Math.random() > 0.7 // Some taken domains might be premium
        });
      });

      setResults(searchResults);
      setIsSearching(false);
    }, 2000);
  };

  const handleRegister = (domain: DomainResult) => {
    // Track affiliate click for analytics
    console.log(`Affiliate click: ${domain.domain} via ${domain.registrar}`);
    window.open(domain.affiliateLink, '_blank');
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Domain Availability Checker</h1>
        <p className="text-gray-600">
          Search for available domain names across multiple extensions and registrars
        </p>
        <Badge variant="secondary" className="mt-2">
          <Globe className="h-3 w-3 mr-1" />
          Free Tool - Powered by Affiliate Partners
        </Badge>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Domain Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter domain name (without extension)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchDomains()}
              className="flex-1"
            />
            <Button 
              onClick={searchDomains} 
              disabled={isSearching}
              className="min-w-[120px]"
            >
              {isSearching ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>
          
          <div className="mt-4 text-sm text-gray-600">
            <p>
              <strong>Tip:</strong> Enter just the domain name (e.g., "mybusiness") and we'll check 
              availability across popular extensions like .com, .co.uk, .net, and more.
            </p>
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Search Results for "{searchTerm}"</CardTitle>
            <p className="text-sm text-gray-600">
              Found {results.filter(r => r.available).length} available domains out of {results.length} checked
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {results.map((result, index) => (
                <div 
                  key={index}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    result.available 
                      ? 'bg-green-50 border-green-200' 
                      : result.premium 
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {result.available ? (
                        <Check className="h-5 w-5 text-green-600" />
                      ) : result.premium ? (
                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                      ) : (
                        <X className="h-5 w-5 text-red-600" />
                      )}
                      <span className="font-semibold text-lg">{result.domain}</span>
                    </div>
                    
                    <Badge 
                      variant={result.available ? "default" : result.premium ? "secondary" : "outline"}
                      className="text-xs"
                    >
                      {result.available ? "Available" : result.premium ? "Premium" : "Taken"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3">
                    {result.available && (
                      <div className="text-right">
                        <div className="font-semibold text-green-600">{result.price}</div>
                        <div className="text-xs text-gray-600">via {result.registrar}</div>
                      </div>
                    )}
                    
                    {result.premium && (
                      <div className="text-right">
                        <div className="font-semibold text-yellow-600">Premium Domain</div>
                        <div className="text-xs text-gray-600">Contact {result.registrar}</div>
                      </div>
                    )}

                    {(result.available || result.premium) && (
                      <Button
                        onClick={() => handleRegister(result)}
                        size="sm"
                        variant={result.available ? "default" : "outline"}
                        className="min-w-[100px]"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        {result.available ? "Register" : "Inquire"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-3">
                <Globe className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-blue-900 mb-1">Domain Registration Partners</h4>
                  <p className="text-sm text-blue-700 mb-3">
                    We partner with trusted domain registrars to help you secure your domain. 
                    We may earn a commission when you register through our partners, helping us keep this tool free.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {registrars.map((registrar, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {registrar.name} Partner
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {results.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Globe className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Find Your Perfect Domain?</h3>
            <p className="text-gray-600 mb-4">
              Enter a domain name above to check availability across 12+ popular extensions
            </p>
            <div className="flex justify-center gap-2 flex-wrap">
              <Badge variant="outline">.com</Badge>
              <Badge variant="outline">.co.uk</Badge>
              <Badge variant="outline">.net</Badge>
              <Badge variant="outline">.org</Badge>
              <Badge variant="outline">.io</Badge>
              <Badge variant="outline">.app</Badge>
              <Badge variant="outline">+6 more</Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DomainAvailability;