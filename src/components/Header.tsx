import React, { useState } from 'react';
import { Menu, X, User, LogOut, Settings, BarChart3, Users, KanbanSquare, Building2, ShoppingCart, Briefcase, Network, Brain, Bitcoin, Globe, Newspaper } from 'lucide-react';
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
import { useTheme } from '@/contexts/ThemeContext';
import LivePriceSidebars from '@/components/sidebars/LivePriceSidebars';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPriceSidebarOpen, setIsPriceSidebarOpen] = useState(false);
  const [activePriceTab, setActivePriceTab] = useState<'crypto' | 'forex'>('crypto');
  const { user, signOut } = useAuth();
  const { theme, setTheme, availableThemes } = useTheme();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center">
              <img src="/lovable-uploads/86c25eed-4258-4e9e-9fd3-c368f065e452.png" alt="B2BNest" className="h-8 w-auto" />
              <span className="ml-2 text-xl font-bold text-gray-900">B2BNest</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex space-x-8">
            <Link to="/" className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
              Home
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-gray-500 hover:text-gray-900">
                  BizzLink
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem asChild>
                  <Link to="/business-social" className="flex items-center">
                    <Users className="mr-2 h-4 w-4" />
                    Business Social
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/forum" className="flex items-center">
                    <Users className="mr-2 h-4 w-4" />
                    Forum
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/business-news" className="flex items-center">
                    <Newspaper className="mr-2 h-4 w-4" />
                    Business News
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Link to="/business-tools" className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
              Business Tools
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-gray-500 hover:text-gray-900">
                  AI Tools
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem asChild>
                  <Link to="/ai-showcase" className="flex items-center">
                    <Brain className="mr-2 h-4 w-4" />
                    AI Showcase
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/ai-studio" className="flex items-center">
                    <Brain className="mr-2 h-4 w-4" />
                    AI Studio
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/ai-workspace" className="flex items-center">
                    <Brain className="mr-2 h-4 w-4" />
                    AI Workspace
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-gray-500 hover:text-gray-900">
                  Directory
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem asChild>
                  <Link to="/directory" className="flex items-center">
                    <Building2 className="mr-2 h-4 w-4" />
                    All Directories
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/directory/companies" className="flex items-center">
                    <Building2 className="mr-2 h-4 w-4" />
                    Companies
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/directory/suppliers" className="flex items-center">
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Suppliers
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/directory/services" className="flex items-center">
                    <Briefcase className="mr-2 h-4 w-4" />
                    Services
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-gray-500 hover:text-gray-900">
                  Invest
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem asChild>
                  <Link to="/fundraising" className="flex items-center">
                    <Bitcoin className="mr-2 h-4 w-4" />
                    Fundraising
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/whitepaper" className="flex items-center">
                    <Globe className="mr-2 h-4 w-4" />
                    Whitepaper
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/tokenomics" className="flex items-center">
                    <Bitcoin className="mr-2 h-4 w-4" />
                    Tokenomics
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/live-charts" className="flex items-center">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Live Charts
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Link to="/pricing" className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
              Pricing
            </Link>
          </nav>

          {/* Right side controls */}
          <div className="flex items-center space-x-4">
            {/* Live Prices Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPriceSidebarOpen(!isPriceSidebarOpen)}
              className="hidden lg:flex"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Live Prices
            </Button>

            {/* Theme Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="px-3">
                  Theme: {theme}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {availableThemes.map((t) => (
                  <DropdownMenuItem key={t} onClick={() => setTheme(t)}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Menu */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative h-8 w-8 rounded-full">
                    <User className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                    <User className="mr-2 h-4 w-4" />
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/settings')}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center space-x-2">
                <Button variant="ghost" asChild>
                  <Link to="/auth">Sign In</Link>
                </Button>
                <Button asChild>
                  <Link to="/auth">Sign Up</Link>
                </Button>
              </div>
            )}

            {/* Mobile menu button */}
            <div className="lg:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="lg:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t">
              <Link
                to="/"
                className="text-gray-600 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                Home
              </Link>
              
              <div className="space-y-1">
                <div className="text-gray-900 font-medium px-3 py-2">BizzLink</div>
                <Link
                  to="/business-social"
                  className="text-gray-600 hover:text-gray-900 block px-6 py-2 rounded-md text-sm"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Business Social
                </Link>
                <Link
                  to="/forum"
                  className="text-gray-600 hover:text-gray-900 block px-6 py-2 rounded-md text-sm"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Forum
                </Link>
                <Link
                  to="/business-news"
                  className="text-gray-600 hover:text-gray-900 block px-6 py-2 rounded-md text-sm"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Business News
                </Link>
              </div>

              <Link
                to="/business-tools"
                className="text-gray-600 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                Business Tools
              </Link>

              <div className="space-y-1">
                <div className="text-gray-900 font-medium px-3 py-2">AI Tools</div>
                <Link
                  to="/ai-showcase"
                  className="text-gray-600 hover:text-gray-900 block px-6 py-2 rounded-md text-sm"
                  onClick={() => setIsMenuOpen(false)}
                >
                  AI Showcase
                </Link>
                <Link
                  to="/ai-studio"
                  className="text-gray-600 hover:text-gray-900 block px-6 py-2 rounded-md text-sm"
                  onClick={() => setIsMenuOpen(false)}
                >
                  AI Studio
                </Link>
                <Link
                  to="/ai-workspace"
                  className="text-gray-600 hover:text-gray-900 block px-6 py-2 rounded-md text-sm"
                  onClick={() => setIsMenuOpen(false)}
                >
                  AI Workspace
                </Link>
              </div>

              <div className="space-y-1">
                <div className="text-gray-900 font-medium px-3 py-2">Directory</div>
                <Link
                  to="/directory"
                  className="text-gray-600 hover:text-gray-900 block px-6 py-2 rounded-md text-sm"
                  onClick={() => setIsMenuOpen(false)}
                >
                  All Directories
                </Link>
                <Link
                  to="/directory/companies"
                  className="text-gray-600 hover:text-gray-900 block px-6 py-2 rounded-md text-sm"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Companies
                </Link>
                <Link
                  to="/directory/suppliers"
                  className="text-gray-600 hover:text-gray-900 block px-6 py-2 rounded-md text-sm"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Suppliers
                </Link>
                <Link
                  to="/directory/services"
                  className="text-gray-600 hover:text-gray-900 block px-6 py-2 rounded-md text-sm"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Services
                </Link>
              </div>

              <div className="space-y-1">
                <div className="text-gray-900 font-medium px-3 py-2">Invest</div>
                <Link
                  to="/fundraising"
                  className="text-gray-600 hover:text-gray-900 block px-6 py-2 rounded-md text-sm"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Fundraising
                </Link>
                <Link
                  to="/whitepaper"
                  className="text-gray-600 hover:text-gray-900 block px-6 py-2 rounded-md text-sm"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Whitepaper
                </Link>
                <Link
                  to="/tokenomics"
                  className="text-gray-600 hover:text-gray-900 block px-6 py-2 rounded-md text-sm"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Tokenomics
                </Link>
                <Link
                  to="/live-charts"
                  className="text-gray-600 hover:text-gray-900 block px-6 py-2 rounded-md text-sm"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Live Charts
                </Link>
              </div>

              <Link
                to="/pricing"
                className="text-gray-600 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                Pricing
              </Link>

              {user && (
                <>
                  <div className="border-t border-gray-200 pt-4 pb-3">
                    <div className="space-y-1">
                      <Link
                        to="/dashboard"
                        className="text-gray-600 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Dashboard
                      </Link>
                      <Link
                        to="/settings"
                        className="text-gray-600 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Settings
                      </Link>
                      <button
                        onClick={() => {
                          handleSignOut();
                          setIsMenuOpen(false);
                        }}
                        className="text-gray-600 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium w-full text-left"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Live Price Sidebars */}
      <LivePriceSidebars
        isOpen={isPriceSidebarOpen}
        onClose={() => setIsPriceSidebarOpen(false)}
        defaultTab={activePriceTab}
      />
    </header>
  );
};

export default Header;