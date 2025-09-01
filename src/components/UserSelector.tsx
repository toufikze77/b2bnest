import React, { useState } from 'react';
import { Check, ChevronsUpDown, User, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useOrganization } from '@/hooks/useOrganization';

interface UserSelectorProps {
  value?: string;
  onChange: (userId?: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const UserSelector: React.FC<UserSelectorProps> = ({
  value,
  onChange,
  placeholder = "Select team member...",
  disabled = false,
  className
}) => {
  const { members, userRole } = useOrganization();
  const [open, setOpen] = useState(false);

  const selectedMember = members.find(m => m.user_id === value);
  const canAssignTasks = userRole && ['owner', 'admin', 'manager'].includes(userRole);

  const handleSelect = (userId: string) => {
    onChange(userId === value ? undefined : userId);
    setOpen(false);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'admin': return 'bg-red-100 text-red-800 border-red-200';
      case 'manager': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          {selectedMember ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">
                  {getInitials(selectedMember.profile?.display_name, selectedMember.profile?.email)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">
                {selectedMember.profile?.display_name || selectedMember.profile?.email}
              </span>
              <Badge variant="outline" className={cn("text-xs", getRoleColor(selectedMember.role))}>
                {selectedMember.role}
              </Badge>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{placeholder}</span>
            </div>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Search team members..." />
          <CommandEmpty>
            <div className="flex flex-col items-center gap-2 py-6">
              <UserPlus className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No team members found</p>
              {canAssignTasks && (
                <p className="text-xs text-muted-foreground">
                  Invite users to your organization to assign tasks
                </p>
              )}
            </div>
          </CommandEmpty>
          <CommandGroup>
            <CommandItem
              value="unassigned"
              onSelect={() => handleSelect('')}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  !value ? "opacity-100" : "opacity-0"
                )}
              />
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                  <User className="h-3 w-3 text-muted-foreground" />
                </div>
                <span className="text-muted-foreground">Unassigned</span>
              </div>
            </CommandItem>
            {members.map((member) => (
              <CommandItem
                key={member.id}
                value={member.user_id}
                onSelect={() => handleSelect(member.user_id)}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === member.user_id ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="flex items-center gap-2 flex-1">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs">
                      {getInitials(member.profile?.display_name, member.profile?.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-medium truncate">
                      {member.profile?.display_name || member.profile?.full_name || 'Unknown'}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {member.profile?.email}
                    </span>
                  </div>
                  <Badge variant="outline" className={cn("text-xs ml-auto", getRoleColor(member.role))}>
                    {member.role}
                  </Badge>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
};