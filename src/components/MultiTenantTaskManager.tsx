import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Shield, Key, UserCheck } from 'lucide-react';
import { useOrganization } from '@/hooks/useOrganization';
import { OrganizationSwitcher } from '@/components/OrganizationSwitcher';
import TodoList from '@/components/TodoList';

export const MultiTenantTaskManager: React.FC = () => {
  const { currentOrganization, members, userRole, loading } = useOrganization();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!currentOrganization) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Organization Found</h2>
            <p className="text-muted-foreground mb-4">
              You need to be part of an organization to access task management features.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'admin': return 'bg-red-100 text-red-800 border-red-200';
      case 'manager': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const canManageTasks = userRole && ['owner', 'admin', 'manager'].includes(userRole);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Organization Header */}
      <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{currentOrganization.name}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className={getRoleColor(userRole || '')}>
                {userRole}
              </Badge>
              <span>•</span>
              <span>{members.length} members</span>
              <span>•</span>
              <Badge variant="outline" className="text-xs">
                {currentOrganization.subscription_tier}
              </Badge>
            </div>
          </div>
        </div>
        
        <div className="lg:hidden">
          <OrganizationSwitcher />
        </div>
      </div>

      {/* Security Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Key className="h-4 w-4" />
              Data Isolation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              All tasks are securely isolated within your organization. No cross-tenant data access.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Role-Based Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {canManageTasks ? 'You can create and assign tasks to team members.' : 'You can view and work on assigned tasks.'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team Collaboration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Assign tasks to specific team members with full audit trail and activity tracking.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Task Management */}
      <TodoList />
    </div>
  );
};