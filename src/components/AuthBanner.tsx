import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

const AuthBanner = () => {
  const { user } = useAuth();

  // Don't show banner if user is logged in
  if (user) return null;

  return (
    <div className="bg-blue-50 border-b border-blue-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-center space-x-4">
          <span className="text-blue-900 text-sm font-medium">
            Ready to transform your business with AI?
          </span>
          <div className="flex items-center space-x-2">
            <Link to="/auth">
              <Button variant="outline" size="sm" className="bg-white hover:bg-blue-50">
                Sign In
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                Start Free Trial
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthBanner;