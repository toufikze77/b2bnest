
import React from 'react';
import { Building } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface BusinessConfigurationFormProps {
  businessType: string;
  businessSize: string;
  state: string;
  onBusinessTypeChange: (value: string) => void;
  onBusinessSizeChange: (value: string) => void;
  onStateChange: (value: string) => void;
}

const BusinessConfigurationForm = ({
  businessType,
  businessSize,
  state,
  onBusinessTypeChange,
  onBusinessSizeChange,
  onStateChange
}: BusinessConfigurationFormProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5" />
          Business Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="business-type">Business Type</Label>
          <Select value={businessType} onValueChange={onBusinessTypeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select business type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="llc">Limited Liability Company (LLC)</SelectItem>
              <SelectItem value="corporation">Corporation</SelectItem>
              <SelectItem value="partnership">Partnership</SelectItem>
              <SelectItem value="soleprop">Sole Proprietorship</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="business-size">Business Size</Label>
          <Select value={businessSize} onValueChange={onBusinessSizeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select business size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="solo">Solo Entrepreneur</SelectItem>
              <SelectItem value="small">Small Team (2-10)</SelectItem>
              <SelectItem value="medium">Medium Business (11-50)</SelectItem>
              <SelectItem value="large">Large Business (50+)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="state">Location</Label>
          <Select value={state} onValueChange={onStateChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ca">California</SelectItem>
              <SelectItem value="ny">New York</SelectItem>
              <SelectItem value="tx">Texas</SelectItem>
              <SelectItem value="fl">Florida</SelectItem>
              <SelectItem value="uk">United Kingdom</SelectItem>
              <SelectItem value="other">Other State/Country</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};

export default BusinessConfigurationForm;
