import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, 
  Users, 
  Mail, 
  Phone, 
  MessageSquare, 
  BarChart3,
  Eye,
  Calendar,
  Target,
  DollarSign
} from 'lucide-react';

interface AnalyticsTabProps {
  totalRevenue: number;
}

const AnalyticsTab = ({ totalRevenue }: AnalyticsTabProps) => {
  const [timeRange, setTimeRange] = useState('30d');
  
  // Sample analytics data (in a real app, this would come from API)
  const analyticsData = {
    communicationStats: {
      totalEmails: 1247,
      emailOpenRate: 68,
      emailClickRate: 24,
      totalCalls: 156,
      callConnectRate: 84,
      avgCallDuration: '4:32',
      totalSMS: 89,
      smsResponseRate: 42
    },
    leadConversion: {
      totalLeads: 342,
      qualifiedLeads: 156,
      conversionRate: 23,
      avgTimeToConvert: '12 days'
    },
    salesMetrics: {
      closedDeals: 28,
      avgDealSize: 15600,
      salesCycle: '45 days',
      winRate: 31
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Time Range Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Analytics & Insights</h2>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="1y">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Communication Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Email Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>Total Emails Sent</span>
                <span className="font-semibold">{analyticsData.communicationStats.totalEmails.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Open Rate</span>
                <Badge className="bg-green-100 text-green-800">{analyticsData.communicationStats.emailOpenRate}%</Badge>
              </div>
              <div className="flex justify-between">
                <span>Click Rate</span>
                <Badge className="bg-blue-100 text-blue-800">{analyticsData.communicationStats.emailClickRate}%</Badge>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full" 
                  style={{ width: `${analyticsData.communicationStats.emailOpenRate}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Call Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>Total Calls</span>
                <span className="font-semibold">{analyticsData.communicationStats.totalCalls}</span>
              </div>
              <div className="flex justify-between">
                <span>Connect Rate</span>
                <Badge className="bg-green-100 text-green-800">{analyticsData.communicationStats.callConnectRate}%</Badge>
              </div>
              <div className="flex justify-between">
                <span>Avg Duration</span>
                <span className="font-semibold">{analyticsData.communicationStats.avgCallDuration}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              SMS Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>Total SMS Sent</span>
                <span className="font-semibold">{analyticsData.communicationStats.totalSMS}</span>
              </div>
              <div className="flex justify-between">
                <span>Response Rate</span>
                <Badge className="bg-purple-100 text-purple-800">{analyticsData.communicationStats.smsResponseRate}%</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lead Conversion & Sales Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Lead Conversion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>Total Leads</span>
                <span className="font-semibold">{analyticsData.leadConversion.totalLeads}</span>
              </div>
              <div className="flex justify-between">
                <span>Qualified Leads</span>
                <span className="font-semibold">{analyticsData.leadConversion.qualifiedLeads}</span>
              </div>
              <div className="flex justify-between">
                <span>Conversion Rate</span>
                <Badge className="bg-green-100 text-green-800">{analyticsData.leadConversion.conversionRate}%</Badge>
              </div>
              <div className="flex justify-between">
                <span>Avg Time to Convert</span>
                <span className="font-semibold">{analyticsData.leadConversion.avgTimeToConvert}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Sales Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>Monthly Target</span>
                <span className="font-semibold">$100,000</span>
              </div>
              <div className="flex justify-between">
                <span>Current Pipeline</span>
                <span className="font-semibold">${Math.round(totalRevenue).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Closed Deals</span>
                <span className="font-semibold">{analyticsData.salesMetrics.closedDeals}</span>
              </div>
              <div className="flex justify-between">
                <span>Win Rate</span>
                <Badge className="bg-green-100 text-green-800">{analyticsData.salesMetrics.winRate}%</Badge>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-green-500 h-3 rounded-full" 
                  style={{ width: `${Math.min((totalRevenue / 100000) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lead Sources & Activity Timeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Lead Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Website</span>
                <Badge>45%</Badge>
              </div>
              <div className="flex justify-between">
                <span>Referrals</span>
                <Badge>30%</Badge>
              </div>
              <div className="flex justify-between">
                <span>Social Media</span>
                <Badge>15%</Badge>
              </div>
              <div className="flex justify-between">
                <span>Email Campaign</span>
                <Badge>10%</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Key Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Avg Deal Size</span>
                <span className="font-semibold">${analyticsData.salesMetrics.avgDealSize.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Sales Cycle</span>
                <span className="font-semibold">{analyticsData.salesMetrics.salesCycle}</span>
              </div>
              <div className="flex justify-between">
                <span>Customer Lifetime Value</span>
                <span className="font-semibold">$47,200</span>
              </div>
              <div className="flex justify-between">
                <span>Customer Acquisition Cost</span>
                <span className="font-semibold">$1,840</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticsTab;