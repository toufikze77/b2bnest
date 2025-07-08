import React, { useState } from 'react';
import { Menu, X, User, LogOut, Settings, BarChart3 } from 'lucide-react';
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

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
            <Link to="/about" className="text-gray-700 hover:text-blue-600 transition-colors">
              About
            </Link>
            <Link to="/business-tools" className="text-gray-700 hover:text-blue-600 transition-colors">
              Business Tools
            </Link>
            <Link to="/ai-studio" className="text-gray-700 hover:text-blue-600 transition-colors font-medium bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
              AI Studio ✨
            </Link>
            <Link to="/ai-showcase" className="text-gray-700 hover:text-blue-600 transition-colors">
              AI-Powered
            </Link>
            <Link to="/blog" className="text-gray-700 hover:text-blue-600 transition-colors">
              Blog
            </Link>
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
              </DropdownMenuContent>
            </DropdownMenu>
            <Link to="/pricing" className="text-gray-700 hover:text-blue-600 transition-colors">
              Pricing
            </Link>
            <Link to="/contact" className="text-gray-700 hover:text-blue-600 transition-colors">
              Contact
            </Link>
          </nav>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
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
                  <DropdownMenuItem>
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

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
                to="/about"
                className="text-gray-700 hover:text-blue-600 transition-colors px-2"
                onClick={() => setIsMenuOpen(false)}
              >
                About
              </Link>
              <Link
                to="/business-tools"
                className="text-gray-700 hover:text-blue-600 transition-colors px-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Business Tools
              </Link>
              <Link
                to="/ai-showcase"
                className="text-gray-700 hover:text-blue-600 transition-colors px-2"
                onClick={() => setIsMenuOpen(false)}
              >
                AI-Powered
              </Link>
              <Link
                to="/blog"
                className="text-gray-700 hover:text-blue-600 transition-colors px-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Blog
              </Link>
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
                </div>
              </div>
              <Link
                to="/pricing"
                className="text-gray-700 hover:text-blue-600 transition-colors px-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Pricing
              </Link>
              <Link
                to="/contact"
                className="text-gray-700 hover:text-blue-600 transition-colors px-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Contact
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
    </header>
  );
};

export default Header;
