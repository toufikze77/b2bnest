import React, { useState } from 'react';
import { Menu, X, User, LogOut, Settings, BarChart3, Sun, Moon, MessageSquare, Rocket, MoreHorizontal } from 'lucide-react';

import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import ShareButton from '@/components/ShareButton';
import InstallAppButton from '@/components/InstallAppButton';
import { useTheme } from '@/contexts/ThemeContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUserAvatar } from '@/hooks/useUserAvatar';
import SupportFeedbackDialog from '@/components/SupportFeedbackDialog';
import OrganizationSwitcher from '@/components/OrganizationSwitcher';
import ProfileEditDialog from '@/components/ProfileEditDialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// Phase 16 spacing rules (tested in Header.test.tsx):
// - the row keeps a fixed gap between the logo, the menu and the right-hand buttons, so they can never touch;
// - the full menu shows from lg (1024px); below that the menu button opens the same links;
// - Download, Share and Support & feedback sit in "More" on desktop, so the menu always fits next to the logo.
export const HEADER_ROW_CLASS = 'flex h-20 items-center gap-3 lg:gap-6 xl:gap-8';
export const HEADER_NAV_CLASS = 'hidden lg:flex shrink-0 items-center gap-x-4 whitespace-nowrap xl:gap-x-5';


const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { avatarUrl, displayName, email: profileEmail } = useUserAvatar();
  const [profileOpen, setProfileOpen] = useState(false);
  const initials = (displayName || user?.email || '?').slice(0, 2).toUpperCase();

  
  

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="bg-white dark:bg-card shadow-sm border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={HEADER_ROW_CLASS} data-testid="header-row">
          {/* Logo */}
          <Link to="/" aria-label="B2BNEST home" className="flex shrink-0 items-center rounded-control focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
            {/* Owner's wordmark: color on white, reversed on the dark-mode header. */}
            <img src="/brand/svg/b2bnest-wordmark-color.svg" alt="B2BNEST" width={213} height={32} className="h-7 w-auto dark:hidden sm:h-8" />
            <img src="/brand/svg/b2bnest-wordmark-reversed.svg" alt="B2BNEST" width={213} height={32} className="hidden h-7 w-auto dark:block sm:h-8" />
          </Link>

          {/* Desktop Navigation */}
          <nav className={HEADER_NAV_CLASS} aria-label="Main">
            <Link to="/" className="text-gray-700 hover:text-blue-600 transition-colors">
              Home
            </Link>
            <Link to="/business-tools" className="text-gray-700 hover:text-blue-600 transition-colors">
              Business Tools
            </Link>
            <Link to="/template-center" className="text-gray-700 hover:text-blue-600 transition-colors">
              Templates
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                {/* A real button, so keyboard users can open it (it was a span and was skipped by Tab). */}
                <button type="button" className="rounded-control text-gray-700 hover:text-blue-600 transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
                  AI Tools
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem asChild>
                  <Link to="/ai-studio">AI Studio</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Link to="/business-resources" className="text-gray-700 hover:text-blue-600 transition-colors">
              Resources
            </Link>
            <Link to="/pricing" className="text-gray-700 hover:text-blue-600 transition-colors">
              Pricing
            </Link>
            <Link to="/help" className="text-gray-700 hover:text-blue-600 transition-colors">
              Help
            </Link>
          </nav>

          {/* Company, Dashboard, More, theme and account */}
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {user && (
              // Capped so the company name truncates instead of pushing the menu into the logo.
              <div className="hidden 2xl:block [&_[role=combobox]]:w-[150px] [&_[role=combobox]>span]:block [&_[role=combobox]>span]:min-w-0 [&_[role=combobox]>span]:truncate">
                <OrganizationSwitcher />
              </div>
            )}
            {user && (
              <Link
                to="/dashboard"
                className="hidden lg:flex items-center rounded-control px-2 py-2 text-gray-700 hover:text-blue-600 transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
                title="Dashboard"
                aria-label="Dashboard"
              >
                <BarChart3 className="h-4 w-4 xl:mr-1" aria-hidden="true" />
                <span className="hidden xl:inline">Dashboard</span>
              </Link>
            )}
            {/* Lower-priority actions, grouped so the main menu always fits. */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="hidden h-9 w-9 lg:inline-flex" aria-label="More: download app, share, support" title="More">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 space-y-1 p-2" data-testid="header-more">
                <InstallAppButton variant="ghost" size="sm" label="Download app" className="w-full justify-start" />
                <div className="[&_button]:w-full [&_button]:justify-start"><ShareButton variant="ghost" size="sm" /></div>
                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setIsFeedbackOpen(true)}>
                  <MessageSquare className="mr-2 h-4 w-4" />Support &amp; feedback
                </Button>
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFeedbackOpen(true)}
              aria-label="Support and feedback"
              title="Support & Feedback"
              className="hidden h-9 w-9 sm:inline-flex lg:hidden"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            <Button

              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="h-9 w-9"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>


            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  {/* The name is shown inside the menu, so the header keeps its width at every size. */}
                  <Button variant="ghost" className="flex items-center px-2" aria-label={`Account menu for ${displayName || user.email}`}>
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={avatarUrl} alt="" />
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <div className="px-2 py-1.5">
                    <p className="truncate text-sm font-medium">{displayName || 'Your profile'}</p>
                    <p className="truncate text-xs text-muted-foreground">{profileEmail}</p>
                  </div>
                  <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
                    <User className="h-4 w-4 mr-2" />
                    Edit profile
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard" className="flex items-center w-full">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/crm" className="flex items-center w-full">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      CRM
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/lead-generation" className="flex items-center w-full">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Lead Generation
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/rota" className="flex items-center w-full">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Employee Rota
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/onboarding" className="flex items-center w-full">
                      <Rocket className="h-4 w-4 mr-2" />
                      Onboarding &amp; Migration
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="flex items-center w-full">
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center space-x-2">
                <Link to="/auth" className="hidden sm:block">
                  <Button variant="outline" size="sm" className="bg-primary/10 border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                    Sign In
                  </Button>
                </Link>
                <Link to="/auth?mode=signup">
                  <Button size="sm" className="bg-primary hover:bg-primary/90 animate-pulse">
                    Sign Up
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              className="lg:hidden p-2 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="lg:hidden py-4 border-t">
            <div className="flex flex-col space-y-4">
              <Link
                to="/"
                className="text-gray-700 hover:text-blue-600 transition-colors px-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                to="/business-tools"
                className="text-gray-700 hover:text-blue-600 transition-colors px-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Business Tools
              </Link>
              <Link
                to="/template-center"
                className="text-gray-700 hover:text-blue-600 transition-colors px-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Templates
              </Link>
              {user && (
                <Link
                  to="/onboarding"
                  className="text-gray-700 hover:text-blue-600 transition-colors px-2"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Onboarding &amp; Migration
                </Link>
              )}



              <div className="px-2">
                <div className="font-medium text-gray-900 mb-2">AI Tools</div>
                <div className="pl-4 space-y-2">
                  <Link
                    to="/ai-studio"
                    className="block text-gray-600 hover:text-blue-600 transition-colors text-sm"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    AI Studio
                  </Link>
                </div>
              </div>
               <div className="px-2 py-2 space-y-2">
                 <InstallAppButton variant="default" size="default" className="w-full" />
                 <ShareButton variant="outline" size="default" />
               </div>
               <Link
                 to="/business-resources"
                className="text-gray-700 hover:text-blue-600 transition-colors px-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Resources
              </Link>
               <Link
                 to="/pricing"
                className="text-gray-700 hover:text-blue-600 transition-colors px-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Pricing
              </Link>
              <Link
                to="/help"
                className="text-gray-700 hover:text-blue-600 transition-colors px-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Help
              </Link>
              <button
                onClick={() => {
                  setIsFeedbackOpen(true);
                  setIsMenuOpen(false);
                }}
                className="text-gray-700 hover:text-blue-600 transition-colors px-2 text-left flex items-center"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Support &amp; Feedback
              </button>

              {user && (
                <>
                  <hr className="my-2" />
                   <Link
                     to="/dashboard"
                     className="text-gray-700 hover:text-blue-600 transition-colors px-2 flex items-center"
                     onClick={() => setIsMenuOpen(false)}
                   >
                     <BarChart3 className="h-4 w-4 mr-2" />
                     Dashboard
                   </Link>
                   <Link
                     to="/settings"
                     className="text-gray-700 hover:text-blue-600 transition-colors px-2 flex items-center"
                     onClick={() => setIsMenuOpen(false)}
                   >
                     <Settings className="h-4 w-4 mr-2" />
                     Settings
                   </Link>
                  <button
                    onClick={() => {
                      handleSignOut();
                      setIsMenuOpen(false);
                    }}
                    className="text-gray-700 hover:text-blue-600 transition-colors px-2 text-left flex items-center"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </button>
                </>
              )}
              {!user && (
                <Link
                  to="/auth"
                  className="text-gray-700 hover:text-blue-600 transition-colors px-2"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      <ProfileEditDialog open={profileOpen} onOpenChange={setProfileOpen} />
      <SupportFeedbackDialog open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen} />

    </header>
  );
};

export default Header;
