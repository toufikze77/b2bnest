import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Database, MapPin, Sparkles } from 'lucide-react';
import { DirectoryService, SUPPORTED_REGIONS } from '@/services/directoryService';
import { toast } from '@/hooks/use-toast';

interface RegionSelectorProps {
  onRegionChange?: (region: string) => void;
  selectedRegion?: string;
  showPopulator?: boolean;
}

const RegionSelector: React.FC<RegionSelectorProps> = ({ 
  onRegionChange, 
  selectedRegion,
  showPopulator = false 
}) => {
  const [loading, setLoading] = useState(false);
  const [populatingType, setPopulatingType] = useState<string>('');

  const handleRegionChange = (region: string) => {
    onRegionChange?.(region);
  };

  const populateRegionData = async (region: string, type: 'all' | 'suppliers' | 'companies' | 'services') => {
    try {
      setLoading(true);
      setPopulatingType(type);

      let result;
      if (type === 'all') {
        result = await DirectoryService.populateAllForRegion(region);
        toast({
          title: "Directory Populated",
          description: `Generated ${result.suppliers} suppliers, ${result.companies} companies, and ${result.services} services for ${region}`,
        });
      } else {
        switch (type) {
          case 'suppliers':
            result = await DirectoryService.populateSuppliers(region);
            break;
          case 'companies':
            result = await DirectoryService.populateCompanies(region);
            break;
          case 'services':
            result = await DirectoryService.populateServices(region);
            break;
        }
        toast({
          title: "Data Generated",
          description: `Generated ${result?.length || 0} ${type} for ${region}`,
        });
      }
    } catch (error) {
      console.error('Error populating data:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to generate directory data',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setPopulatingType('');
    }
  };

  const regionData = SUPPORTED_REGIONS.find(r => r.code === selectedRegion);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedRegion} onValueChange={handleRegionChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              {SUPPORTED_REGIONS.map((region) => (
                <SelectItem key={region.code} value={region.code}>
                  {region.flag} {region.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedRegion && regionData && (
          <Badge variant="secondary" className="flex items-center gap-1">
            {regionData.flag} {regionData.name}
          </Badge>
        )}
      </div>

      {showPopulator && selectedRegion && selectedRegion !== 'all' && regionData && (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI Directory Population for {regionData.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Generate realistic directory data using AI for {regionData.name}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => populateRegionData(selectedRegion, 'all')}
                disabled={loading}
                className="flex items-center gap-1"
              >
                {loading && populatingType === 'all' ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Database className="h-3 w-3" />
                )}
                Populate All
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => populateRegionData(selectedRegion, 'suppliers')}
                disabled={loading}
              >
                {loading && populatingType === 'suppliers' && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                Suppliers
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => populateRegionData(selectedRegion, 'companies')}
                disabled={loading}
              >
                {loading && populatingType === 'companies' && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                Companies
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => populateRegionData(selectedRegion, 'services')}
                disabled={loading}
              >
                {loading && populatingType === 'services' && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                Services
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RegionSelector;