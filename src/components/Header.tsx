import React, { useState } from 'react';
import { Menu, X, User, LogOut, Settings, BarChart3, Users, KanbanSquare, Building2, ShoppingCart, Briefcase, Network, Brain, Bitcoin, Globe } from 'lucide-react';
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
import LivePriceSidebars from '@/components/sidebars/LivePriceSidebars';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPriceSidebarOpen, setIsPriceSidebarOpen] = useState(false);
  const [activePriceTab, setActivePriceTab] = useState<'crypto' | 'forex'>('crypto');
  const { user, signOut } = useAuth();
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
          <Link to="/" className="flex items-center">
            <img 
              src="/lovable-uploads/ac6d0f2a-e033-4bfc-b1e3-f5f14c1106e9.png" 
              alt="AI-Powered Business Automation Platform Logo" 
              style={{width: "125px", height: "auto"}}
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-gray-700 hover:text-blue-600 transition-colors">
              Home
            </Link>
            <Link to="/business-social" className="text-gray-700 hover:text-blue-600 transition-colors">
              Business Social
            </Link>
            <Link to="/business-tools" className="text-gray-700 hover:text-blue-600 transition-colors">
              Business Tools
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <span className="text-gray-700 hover:text-blue-600 transition-colors cursor-pointer">
                  AI Tools
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem asChild>
                  <Link to="/ai-studio">AI Studio</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/ai-showcase">AI Showcase</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/ai-workspace">
                    <Brain className="h-4 w-4 mr-2" />
                    AI Workspace
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <span className="text-gray-700 hover:text-blue-600 transition-colors cursor-pointer">
                    Directory
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to="/directory" className="w-full flex items-center">
                      <Network className="h-4 w-4 mr-2" />
                      Business Hub
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/directory/companies" className="w-full flex items-center">
                      <Building2 className="h-4 w-4 mr-2" />
                      Companies
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/directory/suppliers" className="w-full flex items-center">
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Suppliers
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/directory/services" className="w-full flex items-center">
                      <Briefcase className="h-4 w-4 mr-2" />
                      Services
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <span className="text-gray-700 hover:text-blue-600 transition-colors cursor-pointer">
                  Invest
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/fundraising" className="w-full">
                    Funding Round
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/whitepaper" className="w-full">
                    Whitepaper
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/tokenomics" className="w-full">
                    Tokenomics
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/live-charts" className="w-full flex items-center">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Market
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Link to="/pricing" className="text-gray-700 hover:text-blue-600 transition-colors">
              Pricing
            </Link>
          </nav>

          {/* Live Prices and User Menu */}
          <div className="flex items-center space-x-2">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2 px-3">
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline truncate max-w-32">
                      {user.email}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard" className="flex items-center w-full">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Dashboard
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
                <Link to="/auth">
                  <Button variant="outline" size="sm" className="bg-primary/10 border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                    Sign In
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button size="sm" className="bg-primary hover:bg-primary/90 animate-pulse">
                    Sign Up
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-100"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <div className="flex flex-col space-y-4">
              <Link
                to="/"
                className="text-gray-700 hover:text-blue-600 transition-colors px-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                to="/business-social"
                className="text-gray-700 hover:text-blue-600 transition-colors px-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Business Social
              </Link>
              <Link
                to="/business-tools"
                className="text-gray-700 hover:text-blue-600 transition-colors px-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Business Tools
              </Link>
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
                  <Link
                    to="/ai-showcase"
                    className="block text-gray-600 hover:text-blue-600 transition-colors text-sm"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    AI Showcase
                  </Link>
                  <Link
                    to="/ai-workspace"
                    className="block text-gray-600 hover:text-blue-600 transition-colors text-sm flex items-center"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    AI Workspace
                  </Link>
                </div>
              </div>
              {user && (
                <div className="px-2">
                  <div className="font-medium text-gray-900 mb-2">Directory</div>
                  <div className="pl-4 space-y-2">
                    <Link
                      to="/directory"
                      className="block text-gray-600 hover:text-blue-600 transition-colors text-sm flex items-center"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Network className="h-4 w-4 mr-2" />
                      Business Hub
                    </Link>
                    <Link
                      to="/directory/companies"
                      className="block text-gray-600 hover:text-blue-600 transition-colors text-sm flex items-center"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Building2 className="h-4 w-4 mr-2" />
                      Companies
                    </Link>
                    <Link
                      to="/directory/suppliers"
                      className="block text-gray-600 hover:text-blue-600 transition-colors text-sm flex items-center"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Suppliers
                    </Link>
                    <Link
                      to="/directory/services"
                      className="block text-gray-600 hover:text-blue-600 transition-colors text-sm flex items-center"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Briefcase className="h-4 w-4 mr-2" />
                      Services
              </Link>
              
                  </div>
                </div>
              )}
              <div className="px-2">
                <div className="font-medium text-gray-900 mb-2">Invest</div>
                <div className="pl-4 space-y-2">
                  <Link
                    to="/fundraising"
                    className="block text-gray-600 hover:text-blue-600 transition-colors text-sm"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Funding Round
                  </Link>
                  <Link
                    to="/whitepaper"
                    className="block text-gray-600 hover:text-blue-600 transition-colors text-sm"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Whitepaper
                  </Link>
                  <Link
                    to="/tokenomics"
                    className="block text-gray-600 hover:text-blue-600 transition-colors text-sm"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Tokenomics
                  </Link>
                  <Link
                    to="/live-charts"
                    className="block text-gray-600 hover:text-blue-600 transition-colors text-sm flex items-center"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Market
                  </Link>
                </div>
              </div>
              <Link
                to="/pricing"
                className="text-gray-700 hover:text-blue-600 transition-colors px-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Pricing
              </Link>
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
