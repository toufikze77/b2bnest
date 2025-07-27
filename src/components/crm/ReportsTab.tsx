import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  ChartBar,
  Target,
  ExternalLink,
  BarChart3,
  Download,
  FileText
} from 'lucide-react';
import CurrencySelector from './CurrencySelector';

interface ReportsTabProps {
  totalRevenue: number;
}

const ReportsTab = ({ totalRevenue }: ReportsTabProps) => {
  const [currency, setCurrency] = useState('USD');
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExportReport = async () => {
    setIsExporting(true);
    try {
      // Simulate report generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create sample CSV data
      const csvData = [
        ['Metric', 'Value', 'Currency'],
        ['Total Revenue', totalRevenue.toString(), currency],
        ['Lead Conversion Rate', '24.5%', ''],
        ['Average Deal Size', '32500', currency],
        ['Sales Cycle Length', '45 days', ''],
        ['Customer Lifetime Value', '47200', currency],
        ['Customer Acquisition Cost', '1840', currency]
      ];
      
      const csvContent = csvData.map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crm-report-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Report Exported",
        description: "Your detailed report has been downloaded successfully."
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "There was an error exporting your report.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleCustomReport = () => {
    toast({
      title: "Custom Report Builder",
      description: "Custom report builder will be available in the next update."
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Reports & Analytics</h2>
        <CurrencySelector value={currency} onValueChange={setCurrency} className="w-40" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChartBar className="w-5 h-5" />
            Advanced Reporting Tools
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="p-4 border rounded-lg hover:shadow-md cursor-pointer">
              <div className="flex items-center gap-2 mb-2">
                <ExternalLink className="w-4 h-4" />
                <span className="font-medium">Google Looker Studio</span>
              </div>
              <p className="text-sm text-gray-600">Interactive dashboards & reports</p>
              <Badge className="mt-2 bg-green-100 text-green-800">Connected</Badge>
            </div>
            <div className="p-4 border rounded-lg hover:shadow-md cursor-pointer">
              <div className="flex items-center gap-2 mb-2">
                <ExternalLink className="w-4 h-4" />
                <span className="font-medium">Metabase</span>
              </div>
              <p className="text-sm text-gray-600">Self-service business intelligence</p>
              <Badge className="mt-2 bg-yellow-100 text-yellow-800">Available</Badge>
            </div>
            <div className="p-4 border rounded-lg hover:shadow-md cursor-pointer">
              <div className="flex items-center gap-2 mb-2">
                <ExternalLink className="w-4 h-4" />
                <span className="font-medium">BigQuery</span>
              </div>
              <p className="text-sm text-gray-600">Data warehouse analytics</p>
              <Badge className="mt-2 bg-green-100 text-green-800">Connected</Badge>
            </div>
          </div>
          <Button className="w-full" onClick={handleCustomReport}>
            <ChartBar className="w-4 h-4 mr-2" />
            Create Custom Report
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Sales Performance Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Lead Conversion Rate</span>
                <span className="text-2xl font-bold text-blue-600">24.5%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '24.5%' }}></div>
              </div>
            </div>
            
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Average Deal Size</span>
                <span className="text-2xl font-bold text-green-600">$32.5K</span>
              </div>
              <p className="text-sm text-green-700">↗ 12% vs last quarter</p>
            </div>

            <div className="p-3 bg-purple-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Sales Cycle Length</span>
                <span className="text-2xl font-bold text-purple-600">45 days</span>
              </div>
              <p className="text-sm text-purple-700">↘ 8% improvement</p>
            </div>
          </div>
          <Button 
            className="w-full" 
            onClick={handleExportReport}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <Download className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Export Detailed Report
              </>
            )}
          </Button>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default ReportsTab;