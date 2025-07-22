import React from 'react';
import AccountSettings from '@/components/AccountSettings';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const Settings = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Account Settings</h1>
            <p className="text-gray-600">Manage your account preferences and security settings</p>
          </div>
          
          <AccountSettings />
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Settings;