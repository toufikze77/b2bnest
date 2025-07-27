import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import UserRoleManagement from './UserRoleManagement';
import { 
  Shield,
  Activity,
  KeyRound,
  UserCheck,
  Eye,
  Settings,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

const SecurityTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorEnabled: false,
    oauth2Enabled: true,
    googleSSO: false,
    microsoftSSO: false,
    auditLogging: true,
    sessionTimeout: '60',
    failedLoginThreshold: '5'
  });
  const [loading, setLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [showUserRoleManagement, setShowUserRoleManagement] = useState(false);

  useEffect(() => {
    fetchSecuritySettings();
    fetchAuditLogs();
  }, []);

  const fetchSecuritySettings = async () => {
    try {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('integration_settings')
        .select('*')
        .eq('user_id', user.id)
        .eq('integration_name', 'security_settings')
        .single();

      if (data && !error && data.settings && typeof data.settings === 'object') {
        setSecuritySettings(prev => ({ ...prev, ...(data.settings as Record<string, any>) }));
      }
    } catch (error) {
      console.error('Error fetching security settings:', error);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (data && !error) {
        setAuditLogs(data);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    }
  };

  const updateSecuritySetting = async (key: string, value: any) => {
    try {
      setLoading(true);
      if (!user?.id) return;

      const newSettings = { ...securitySettings, [key]: value };
      setSecuritySettings(newSettings);

      const { error } = await supabase
        .from('integration_settings')
        .upsert(
          {
            user_id: user.id,
            integration_name: 'security_settings',
            settings: newSettings,
            is_enabled: true
          },
          {
            onConflict: 'user_id,integration_name'
          }
        );

      if (error) throw error;

      toast({
        title: "Security Setting Updated",
        description: `${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} has been ${value ? 'enabled' : 'disabled'}`,
      });

      // Log the action
      await supabase.rpc('log_user_action', {
        p_user_id: user.id,
        p_action: 'security_setting_updated',
        p_resource_type: 'security',
        p_details: { setting: key, value }
      });

      fetchAuditLogs();
    } catch (error) {
      console.error('Error updating security setting:', error);
      toast({
        title: "Error",
        description: "Failed to update security setting",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const manageUserRoles = () => {
    setShowUserRoleManagement(true);
  };

  const configureSSO = (provider: string) => {
    toast({
      title: `${provider} SSO Configuration`,
      description: `Opening ${provider} Single Sign-On configuration...`,
    });
  };

  const [showAllAuditLogs, setShowAllAuditLogs] = useState(false);
  const [allAuditLogs, setAllAuditLogs] = useState([]);

  const viewAllAuditLogs = async () => {
    try {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (data && !error) {
        setAllAuditLogs(data);
        setShowAllAuditLogs(true);
      }
    } catch (error) {
      console.error('Error fetching all audit logs:', error);
      toast({
        title: "Error",
        description: "Failed to load audit logs",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Role-Based Access Control
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-red-500" />
                    <span className="font-medium">Owner</span>
                  </div>
                  <Badge className="bg-red-100 text-red-800">1 User</Badge>
                </div>
                <p className="text-sm text-gray-600">Full system access & user management</p>
              </div>
              
              <div className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-orange-500" />
                    <span className="font-medium">Admin</span>
                  </div>
                  <Badge className="bg-orange-100 text-orange-800">3 Users</Badge>
                </div>
                <p className="text-sm text-gray-600">Manage all CRM data & configurations</p>
              </div>
              
              <div className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-blue-500" />
                    <span className="font-medium">Moderator</span>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800">5 Users</Badge>
                </div>
                <p className="text-sm text-gray-600">Manage contacts & deals, limited settings</p>
              </div>
              
              <div className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-green-500" />
                    <span className="font-medium">User</span>
                  </div>
                  <Badge className="bg-green-100 text-green-800">12 Users</Badge>
                </div>
                <p className="text-sm text-gray-600">View own contacts & deals only</p>
              </div>
            </div>
            <Dialog open={showUserRoleManagement} onOpenChange={setShowUserRoleManagement}>
              <DialogTrigger asChild>
                <Button className="w-full" onClick={manageUserRoles} disabled={loading}>
                  <UserCheck className="w-4 h-4 mr-2" />
                  Manage User Roles
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>User Role Management</DialogTitle>
                </DialogHeader>
                <UserRoleManagement />
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Audit Logs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {auditLogs.length > 0 ? auditLogs.map((log: any, index) => (
                <div key={log.id} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-sm">{log.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                  </div>
                  <p className="text-xs text-gray-600">{log.resource_type} • {new Date(log.created_at).toLocaleString()}</p>
                </div>
              )) : (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
                  <p className="text-sm text-gray-600">No recent audit logs</p>
                </div>
              )}
            </div>
            <Dialog open={showAllAuditLogs} onOpenChange={setShowAllAuditLogs}>
              <DialogTrigger asChild>
                <Button className="w-full" onClick={viewAllAuditLogs} disabled={loading}>
                  <Eye className="w-4 h-4 mr-2" />
                  View All Audit Logs
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Complete Audit Log</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {allAuditLogs.length > 0 ? allAuditLogs.map((log: any) => (
                    <div key={log.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-blue-600" />
                          <span className="font-medium">{log.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                        </div>
                        <span className="text-xs text-gray-500">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-gray-600">{log.resource_type}</p>
                      {log.details && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                          <pre>{JSON.stringify(log.details, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  )) : (
                    <p className="text-center text-gray-500">No audit logs found</p>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              Authentication & Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="p-3 border rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-blue-500" />
                  <span>OAuth 2.0</span>
                </div>
                <Switch
                  checked={securitySettings.oauth2Enabled}
                  onCheckedChange={(checked) => updateSecuritySetting('oauth2Enabled', checked)}
                  disabled={loading}
                />
              </div>
              
              <div className="p-3 border rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-green-500" />
                  <span>Two-Factor Auth</span>
                </div>
                <Switch
                  checked={securitySettings.twoFactorEnabled}
                  onCheckedChange={(checked) => updateSecuritySetting('twoFactorEnabled', checked)}
                  disabled={loading}
                />
              </div>
              
              <div className="p-3 border rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-purple-500" />
                  <span>Google SSO</span>
                </div>
                <Switch
                  checked={securitySettings.googleSSO}
                  onCheckedChange={(checked) => updateSecuritySetting('googleSSO', checked)}
                  disabled={loading}
                />
              </div>
              
              <div className="p-3 border rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-700" />
                  <span>Microsoft SSO</span>
                </div>
                <Switch
                  checked={securitySettings.microsoftSSO}
                  onCheckedChange={(checked) => updateSecuritySetting('microsoftSSO', checked)}
                  disabled={loading}
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                <Input
                  id="sessionTimeout"
                  type="number"
                  value={securitySettings.sessionTimeout}
                  onChange={(e) => updateSecuritySetting('sessionTimeout', e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="failedLoginThreshold">Failed Login Threshold</Label>
                <Input
                  id="failedLoginThreshold"
                  type="number"
                  value={securitySettings.failedLoginThreshold}
                  onChange={(e) => updateSecuritySetting('failedLoginThreshold', e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Security Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
              <Shield className="w-8 h-8 mx-auto mb-2 text-green-600" />
              <h4 className="font-semibold text-green-800">Security Score</h4>
              <p className="text-2xl font-bold text-green-600">
                {Math.round(
                  (Object.values(securitySettings).filter(v => v === true).length / 
                   Object.values(securitySettings).filter(v => typeof v === 'boolean').length) * 100
                )}%
              </p>
            </div>
            
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
              <Activity className="w-8 h-8 mx-auto mb-2 text-blue-600" />
              <h4 className="font-semibold text-blue-800">Active Sessions</h4>
              <p className="text-2xl font-bold text-blue-600">24</p>
            </div>
            
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg text-center">
              <Eye className="w-8 h-8 mx-auto mb-2 text-orange-600" />
              <h4 className="font-semibold text-orange-800">Failed Logins</h4>
              <p className="text-2xl font-bold text-orange-600">3</p>
            </div>
            
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg text-center">
              <KeyRound className="w-8 h-8 mx-auto mb-2 text-purple-600" />
              <h4 className="font-semibold text-purple-800">2FA Enabled</h4>
              <p className="text-2xl font-bold text-purple-600">
                {securitySettings.twoFactorEnabled ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    Yes
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    No
                  </span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SecurityTab;