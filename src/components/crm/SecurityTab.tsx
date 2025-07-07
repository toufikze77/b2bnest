import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Shield,
  Activity,
  KeyRound,
  UserCheck,
  Eye,
  Settings
} from 'lucide-react';

const SecurityTab = () => {
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
            <Button className="w-full">
              <UserCheck className="w-4 h-4 mr-2" />
              Manage User Roles
            </Button>
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
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-sm">Contact Created</span>
                </div>
                <p className="text-xs text-gray-600">john.doe@company.com • 2 minutes ago</p>
              </div>
              
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-sm">Deal Updated</span>
                </div>
                <p className="text-xs text-gray-600">sarah.johnson@startup.io • 5 minutes ago</p>
              </div>
              
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-4 h-4 text-orange-600" />
                  <span className="font-medium text-sm">User Login</span>
                </div>
                <p className="text-xs text-gray-600">admin@company.com • 10 minutes ago</p>
              </div>
              
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-4 h-4 text-purple-600" />
                  <span className="font-medium text-sm">Settings Modified</span>
                </div>
                <p className="text-xs text-gray-600">admin@company.com • 15 minutes ago</p>
              </div>
            </div>
            <Button className="w-full">
              <Eye className="w-4 h-4 mr-2" />
              View All Audit Logs
            </Button>
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
                <Badge className="bg-green-100 text-green-800">Active</Badge>
              </div>
              
              <div className="p-3 border rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-green-500" />
                  <span>Two-Factor Auth</span>
                </div>
                <Badge className="bg-green-100 text-green-800">Enabled</Badge>
              </div>
              
              <div className="p-3 border rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-purple-500" />
                  <span>Google SSO</span>
                </div>
                <Badge className="bg-green-100 text-green-800">Connected</Badge>
              </div>
              
              <div className="p-3 border rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-700" />
                  <span>Microsoft SSO</span>
                </div>
                <Badge className="bg-yellow-100 text-yellow-800">Available</Badge>
              </div>
            </div>
            <Button className="w-full">
              <Settings className="w-4 h-4 mr-2" />
              Configure Security
            </Button>
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
              <p className="text-2xl font-bold text-green-600">92%</p>
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
              <p className="text-2xl font-bold text-purple-600">18/21</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SecurityTab;