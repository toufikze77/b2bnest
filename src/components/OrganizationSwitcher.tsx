import React, { useState } from 'react';
import { Building2, Check, ChevronsUpDown, Plus, Settings, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandSeparator } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useOrganization } from '@/hooks/useOrganization';

interface OrganizationSwitcherProps {
  className?: string;
}

export const OrganizationSwitcher: React.FC<OrganizationSwitcherProps> = ({ className }) => {
  const { 
    currentOrganization, 
    organizations, 
    members, 
    userRole,
    switchOrganization,
    loading 
  } = useOrganization();
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const handleSelect = async (orgId: string) => {
    if (orgId !== currentOrganization?.id) {
      await switchOrganization(orgId);
    }
    setOpen(false);
  };

  const getOrganizationInitials = (name: string) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'pro': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'enterprise': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'admin': return 'bg-red-100 text-red-800 border-red-200';
      case 'manager': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading || !currentOrganization) {
    return (
      <div className={cn("flex items-center gap-2 p-2", className)}>
        <div className="h-8 w-8 bg-muted rounded animate-pulse" />
        <div className="h-4 w-32 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">
                  {getOrganizationInitials(currentOrganization.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium truncate max-w-[150px]">
                  {currentOrganization.name}
                </span>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className={cn("text-xs", getRoleColor(userRole || ''))}>
                    {userRole}
                  </Badge>
                  <Badge variant="outline" className={cn("text-xs", getTierColor(currentOrganization.subscription_tier))}>
                    {currentOrganization.subscription_tier}
                  </Badge>
                </div>
              </div>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search organizations..." />
            <CommandEmpty>No organizations found.</CommandEmpty>
            <CommandGroup heading="Organizations">
              {organizations.map((org) => (
                <CommandItem
                  key={org.id}
                  value={org.id}
                  onSelect={() => handleSelect(org.id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      currentOrganization.id === org.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {getOrganizationInitials(org.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-medium truncate">{org.name}</span>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className={cn("text-xs", getTierColor(org.subscription_tier))}>
                          {org.subscription_tier}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  // In a real app, this would open a create organization dialog
                  console.log('Create organization');
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Organization
              </CommandItem>
              {(userRole === 'owner' || userRole === 'admin') && (
                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    setShowSettings(true);
                  }}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Organization Settings
                </CommandItem>
              )}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Quick stats */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        <span>{members.length}</span>
      </div>

      {/* Organization Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {currentOrganization.name} Settings
            </DialogTitle>
            <DialogDescription>
              Manage your organization settings and team members
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">Team Members ({members.length})</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {member.profile?.display_name?.slice(0, 2).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {member.profile?.display_name || member.profile?.full_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {member.profile?.email}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className={getRoleColor(member.role)}>
                      {member.role}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};