import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Settings, 
  Shield, 
  Key, 
  Building, 
  User, 
  CheckCircle, 
  AlertTriangle,
  Link,
  Unlink,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { hmrcService } from '@/services/hmrcService';

interface HMRCSettingsProps {
  onDisconnect: () => void;
}

const HMRCSettings = ({ onDisconnect }: HMRCSettingsProps) => {
  const { toast } = useToast();
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    // Company Details
    companyName: '',
    companyNumber: '',
    utr: '',
    vatNumber: '',
    payeReference: '',
    
    // HMRC Connection
    clientId: '',
    clientSecret: '',
    redirectUri: `${window.location.origin}/business-tools?hmrc-callback=true`,
    
    // Preferences
    autoSubmitVAT: false,
    emailNotifications: true,
    reminderDays: 7,
    sandboxMode: true
  });

  // Load saved settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      const saved = await hmrcService.getSettings();
      if (saved) {
        setSettings(saved);
      }
      const token = await hmrcService.getToken();
      setIsConnected(!!token);
      setIsConfigured(await hmrcService.isFullyConfigured());
    };
    loadSettings();
  }, []);

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      await hmrcService.saveSettings(settings);
      toast({
        title: "Settings Saved",
        description: "HMRC settings have been saved successfully.",
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save HMRC settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    toast({
      title: "Testing Connection...",
      description: "Checking connection to HMRC services.",
    });

    // Simulate connection test
    setTimeout(() => {
      toast({
        title: "Connection Successful",
        description: "Successfully connected to HMRC Government Gateway (Demo Mode).",
      });
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">HMRC Settings</h2>
        <p className="text-gray-600">Configure your HMRC integration and company details</p>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`flex items-center justify-between p-4 ${isConfigured ? 'bg-green-50' : 'bg-amber-50'} rounded-lg`}>
            <div className="flex items-center gap-3">
              {isConfigured ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              )}
              <div>
                <p className="font-medium">{isConfigured ? 'Connected to HMRC' : 'Not connected'}</p>
                <p className="text-sm text-gray-600">Government Gateway{settings.sandboxMode ? ' (Sandbox)' : ''}</p>
              </div>
            </div>
            <Badge variant="secondary">{settings.sandboxMode ? 'Sandbox' : 'Live'}</Badge>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleTestConnection}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Test Connection
            </Button>
            {isConnected && (
              <Button variant="destructive" onClick={onDisconnect}>
                <Unlink className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Company Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Company Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="companyName">Company Name</Label>
              <Input 
                id="companyName"
                value={settings.companyName}
                onChange={(e) => setSettings(prev => ({ ...prev, companyName: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="companyNumber">Company Number</Label>
              <Input 
                id="companyNumber"
                value={settings.companyNumber}
                onChange={(e) => setSettings(prev => ({ ...prev, companyNumber: e.target.value }))}
              />
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="utr">Corporation Tax UTR</Label>
              <Input 
                id="utr"
                value={settings.utr}
                onChange={(e) => setSettings(prev => ({ ...prev, utr: e.target.value }))}
                placeholder="10 digit UTR number"
              />
            </div>
            <div>
              <Label htmlFor="vatNumber">VAT Registration Number</Label>
              <Input 
                id="vatNumber"
                value={settings.vatNumber}
                onChange={(e) => setSettings(prev => ({ ...prev, vatNumber: e.target.value }))}
                placeholder="GB123456789"
              />
            </div>
          </div>
          
          <div className="grid md:grid-cols-1 gap-4">
            <div>
              <Label htmlFor="payeReference">PAYE Reference</Label>
              <Input 
                id="payeReference"
                value={settings.payeReference}
                onChange={(e) => setSettings(prev => ({ ...prev, payeReference: e.target.value }))}
                placeholder="123/AB456"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Credentials
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Demo Mode</AlertTitle>
            <AlertDescription>
              These are demo credentials. In production, you would obtain these from HMRC Developer Hub 
              and they would be securely encrypted.
            </AlertDescription>
          </Alert>
          
          <div>
            <Label htmlFor="clientId">Client ID</Label>
            <Input 
              id="clientId"
              value={settings.clientId}
              onChange={(e) => setSettings(prev => ({ ...prev, clientId: e.target.value }))}
              className="font-mono"
            />
          </div>
          
          <div>
            <Label htmlFor="clientSecret">Client Secret</Label>
            <div className="flex gap-2">
              <Input 
                id="clientSecret"
                type={showClientSecret ? 'text' : 'password'}
                value={settings.clientSecret}
                onChange={(e) => setSettings(prev => ({ ...prev, clientSecret: e.target.value }))}
                className="font-mono flex-1"
              />
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setShowClientSecret(!showClientSecret)}
              >
                {showClientSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          <div>
            <Label htmlFor="redirectUri">Redirect URI</Label>
            <Input 
              id="redirectUri"
              value={settings.redirectUri}
              onChange={(e) => setSettings(prev => ({ ...prev, redirectUri: e.target.value }))}
              className="font-mono"
            />
          </div>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Auto-submit VAT Returns</p>
                <p className="text-sm text-gray-600">Automatically submit VAT returns when ready</p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoSubmitVAT}
                onChange={(e) => setSettings(prev => ({ ...prev, autoSubmitVAT: e.target.checked }))}
                className="w-4 h-4 text-blue-600"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Email Notifications</p>
                <p className="text-sm text-gray-600">Receive email alerts for deadlines</p>
              </div>
              <input
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={(e) => setSettings(prev => ({ ...prev, emailNotifications: e.target.checked }))}
                className="w-4 h-4 text-blue-600"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Sandbox Mode</p>
                <p className="text-sm text-gray-600">Use HMRC sandbox for testing</p>
              </div>
              <Badge variant={settings.sandboxMode ? 'default' : 'secondary'}>
                {settings.sandboxMode ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
          </div>
          
          <div>
            <Label htmlFor="reminderDays">Reminder Days Before Deadline</Label>
            <Input 
              id="reminderDays"
              type="number"
              min="1"
              max="30"
              value={settings.reminderDays}
              onChange={(e) => setSettings(prev => ({ ...prev, reminderDays: parseInt(e.target.value) || 7 }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSaveSettings} disabled={saving}>
          <Settings className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      {/* Help & Resources */}
      <Card>
        <CardHeader>
          <CardTitle>Help & Resources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">HMRC Resources</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• <a href="#" className="text-blue-600 hover:underline">Making Tax Digital guidance</a></li>
                <li>• <a href="#" className="text-blue-600 hover:underline">VAT return deadlines</a></li>
                <li>• <a href="#" className="text-blue-600 hover:underline">Corporation tax guidance</a></li>
                <li>• <a href="#" className="text-blue-600 hover:underline">PAYE RTI guidance</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Support</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• <a href="#" className="text-blue-600 hover:underline">Integration troubleshooting</a></li>
                <li>• <a href="#" className="text-blue-600 hover:underline">API documentation</a></li>
                <li>• <a href="#" className="text-blue-600 hover:underline">Contact support team</a></li>
                <li>• <a href="#" className="text-blue-600 hover:underline">Video tutorials</a></li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HMRCSettings;