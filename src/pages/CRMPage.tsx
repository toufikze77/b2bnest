import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import CRM from '@/components/CRM';
import Footer from '@/components/Footer';

const CRMPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="outline" 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Customer Relationship Management</h1>
            <p className="text-gray-600">Manage your customers, leads, and sales pipeline effectively</p>
          </div>
        </div>
        
        <CRM />
      </div>
      <Footer />
    </div>
  );
};

export default CRMPage;