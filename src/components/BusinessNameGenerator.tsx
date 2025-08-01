import React, { useState } from 'react';
import { Sparkles, RefreshCw, Copy, Check, Zap, Globe, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface DomainOption {
  extension: string;
  available: boolean;
  price: string;
  registrar: string;
  affiliateLink: string;
}

interface NameSuggestion {
  name: string;
  domains: DomainOption[];
  available: boolean;
}

const BusinessNameGenerator = () => {
  const [keyword, setKeyword] = useState('');
  const [industry, setIndustry] = useState('');
  const [suggestions, setSuggestions] = useState<NameSuggestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const { toast } = useToast();

  const industries = [
    'Technology', 'Healthcare', 'Finance', 'Retail', 'Education', 
    'Marketing', 'Consulting', 'Food & Beverage', 'Real Estate', 'Creative'
  ];

  const domainRegistrars = [
    { name: 'Namecheap', affiliate: 'https://affiliate.namecheap.com/?affId=121420' },
    { name: 'GoDaddy', affiliate: 'https://www.godaddy.com/deals' },
    { name: 'Domain.com', affiliate: 'https://www.domain.com' },
    { name: 'Porkbun', affiliate: 'https://porkbun.com' }
  ];

  const generateDomainOptions = (name: string): DomainOption[] => {
    const cleanName = name.toLowerCase().replace(/\s+/g, '');
    const extensions = [
      { ext: '.com', price: '£8.99', popular: true },
      { ext: '.co.uk', price: '£6.99', popular: true },
      { ext: '.net', price: '£9.99', popular: false },
      { ext: '.org', price: '£9.99', popular: false },
      { ext: '.io', price: '£29.99', popular: false },
      { ext: '.co', price: '£24.99', popular: false }
    ];

    return extensions.map(({ ext, price, popular }) => {
      const registrar = domainRegistrars[Math.floor(Math.random() * domainRegistrars.length)];
      return {
        extension: `${cleanName}${ext}`,
        available: Math.random() > (popular ? 0.4 : 0.2), // Popular extensions less likely available
        price,
        registrar: registrar.name,
        affiliateLink: `${registrar.affiliate}?domain=${cleanName}${ext}`
      };
    });
  };

  const generateNames = () => {
    if (!keyword.trim()) {
      toast({
        title: "Keyword Required",
        description: "Please enter a keyword to generate business names.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    
    // Simulate API call delay
    setTimeout(() => {
      const prefixes = ['Smart', 'Pro', 'Elite', 'Prime', 'Swift'];
      const suffixes = ['Hub', 'Labs', 'Works', 'Solutions', 'Group'];
      const modifiers = ['Digital', 'Global', 'Innovative', 'Expert', 'Creative'];
      
      const newSuggestions: NameSuggestion[] = [];
      
      // Generate 5 free suggestions (limited for free plan)
      for (let i = 0; i < 5; i++) {
        let name = '';
        const rand = Math.random();
        
        if (rand < 0.3) {
          name = `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${keyword}`;
        } else if (rand < 0.6) {
          name = `${keyword} ${suffixes[Math.floor(Math.random() * suffixes.length)]}`;
        } else {
          name = `${modifiers[Math.floor(Math.random() * modifiers.length)]} ${keyword}`;
        }
        
        const domains = generateDomainOptions(name);
        const hasAvailableDomain = domains.some(domain => domain.available);
        
        newSuggestions.push({
          name: name,
          domains: domains,
          available: hasAvailableDomain
        });
      }
      
      setSuggestions(newSuggestions);
      setIsGenerating(false);
    }, 1500);
  };

  const copyToClipboard = (name: string) => {
    navigator.clipboard.writeText(name);
    setCopiedName(name);
    toast({
      title: "Copied!",
      description: `"${name}" copied to clipboard.`
    });
    
    setTimeout(() => setCopiedName(null), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Business Name Generator</h1>
        <p className="text-gray-600">Generate creative business names for your startup</p>
        <Badge variant="secondary" className="mt-2">
          Free Plan: 5 suggestions per search
        </Badge>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Generate Business Names
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Keyword or Core Concept *
            </label>
            <Input
              placeholder="e.g., tech, coffee, design..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && generateNames()}
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">
              Industry (Optional)
            </label>
            <select 
              className="w-full p-2 border border-gray-300 rounded-md"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            >
              <option value="">Select industry...</option>
              {industries.map(ind => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          </div>

          <Button 
            onClick={generateNames} 
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Generating Names...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Business Names
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Names</CardTitle>
            <p className="text-sm text-gray-600">
              Here are your business name suggestions. Click to copy!
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6">
              {suggestions.map((suggestion, index) => (
                <div 
                  key={index}
                  className="p-6 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{suggestion.name}</h3>
                      <Badge 
                        variant={suggestion.available ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {suggestion.available ? "Domains Available" : "Limited Availability"}
                      </Badge>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(suggestion.name)}
                    >
                      {copiedName === suggestion.name ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Domain Options:</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {suggestion.domains.slice(0, 4).map((domain, domainIndex) => (
                        <div 
                          key={domainIndex}
                          className={`flex items-center justify-between p-3 rounded border ${
                            domain.available ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{domain.extension}</span>
                              <Badge 
                                variant={domain.available ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {domain.available ? "Available" : "Taken"}
                              </Badge>
                            </div>
                            <div className="text-xs text-gray-600">
                              {domain.price} via {domain.registrar}
                            </div>
                          </div>
                          
                          {domain.available && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(domain.affiliateLink, '_blank')}
                              className="ml-2"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Register
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    {suggestion.domains.length > 4 && (
                      <div className="mt-2 text-center">
                        <Button variant="ghost" size="sm" className="text-xs">
                          View {suggestion.domains.length - 4} more domains
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-start gap-3">
                <Globe className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-900 mb-1">Domain Partnership Program</h4>
                  <p className="text-sm text-amber-700 mb-3">
                    We earn a small commission when you register domains through our partners. This helps us keep the business name generator free while providing you with competitive pricing.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">Namecheap Partner</Badge>
                    <Badge variant="outline" className="text-xs">GoDaddy Affiliate</Badge>
                    <Badge variant="outline" className="text-xs">Domain.com Partner</Badge>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-blue-900 mb-1">Want More Options?</h4>
                  <p className="text-sm text-blue-700 mb-3">
                    Upgrade to get unlimited name suggestions, AI-powered creativity, and domain availability checking.
                  </p>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs">Starter: 50 suggestions</Badge>
                    <Badge variant="outline" className="text-xs">Pro: Unlimited + AI</Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {suggestions.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Generate Names?</h3>
            <p className="text-gray-600">
              Enter a keyword above to get started with your business name suggestions.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BusinessNameGenerator;