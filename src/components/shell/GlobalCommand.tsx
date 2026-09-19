import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3, Bot, CalendarDays, FileText, FolderKanban, Search, Settings,
  Sparkles, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem,
  CommandList, CommandSeparator, CommandShortcut,
} from '@/components/ui/command';

const destinations = [
  { label: 'Dashboard', path: '/dashboard', icon: BarChart3 },
  { label: 'Projects', path: '/project-management', icon: FolderKanban },
  { label: 'Tasks', path: '/project-management?view=list', icon: FileText },
  { label: 'Calendar', path: '/project-management?view=calendar', icon: CalendarDays },
  { label: 'CRM and contacts', path: '/crm', icon: Users },
  { label: 'AI workspace', path: '/ai-workspace', icon: Bot },
  { label: 'Settings', path: '/settings', icon: Settings },
];

const createActions = [
  { label: 'Create project', path: '/project-management?create=project', icon: FolderKanban },
  { label: 'Create task', path: '/project-management?create=task', icon: FileText },
  { label: 'Create calendar event', path: '/project-management?create=event&view=calendar', icon: CalendarDays },
];

export function GlobalCommand() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <>
      <Button variant="outline" className="h-9 w-9 justify-center px-0 xl:w-64 xl:justify-start xl:px-3" onClick={() => setOpen(true)} aria-label="Search B2BNest">
        <Search className="h-4 w-4" />
        <span className="hidden xl:ml-2 xl:inline">Search B2BNest</span>
        <kbd className="ml-auto hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground xl:inline">⌘K</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Find a page or action…" />
        <CommandList>
          <CommandEmpty>No matching page or action.</CommandEmpty>
          <CommandGroup heading="Navigate">
            {destinations.map(({ label, path, icon: Icon }) => (
              <CommandItem key={path} onSelect={() => go(path)}>
                <Icon className="mr-2 h-4 w-4" />{label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Quick create">
            {createActions.map(({ label, path, icon: Icon }) => (
              <CommandItem key={path} onSelect={() => go(path)}>
                <Icon className="mr-2 h-4 w-4" />{label}
                <CommandShortcut><Sparkles className="h-3.5 w-3.5" /></CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}