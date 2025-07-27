
import React from 'react';
import { ArrowLeft, FileText, Eye, Download, Send, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/utils/currencyUtils';

interface DocumentListProps {
  activeTab: 'quote' | 'invoice';
  quotes: any[];
  invoices: any[];
  loading: boolean;
  sendingDocument: string | null;
  onTabChange: (tab: 'quote' | 'invoice') => void;
  onBack: () => void;
  onView: (id: string, type: 'quote' | 'invoice') => void;
  onDownload: (doc: any, type: 'quote' | 'invoice') => void;
  onSend: (doc: any, type: 'quote' | 'invoice') => void;
  onEdit?: (doc: any) => void;
}

const DocumentList: React.FC<DocumentListProps> = ({
  activeTab,
  quotes,
  invoices,
  loading,
  sendingDocument,
  onTabChange,
  onBack,
  onView,
  onDownload,
  onSend,
  onEdit
}) => {
  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Create
            </Button>
            <div>
              <CardTitle className="text-xl">
                {activeTab === 'quote' ? 'Quotes' : 'Invoices'} List
              </CardTitle>
              <CardDescription>View and manage your documents</CardDescription>
            </div>
          </div>
          <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as 'quote' | 'invoice')}>
            <TabsList>
              <TabsTrigger value="quote">Quotes</TabsTrigger>
              <TabsTrigger value="invoice">Invoices</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <div className="space-y-4">
            {(activeTab === 'quote' ? quotes : invoices).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p>No {activeTab}s found. Create your first {activeTab}!</p>
              </div>
            ) : (
              (activeTab === 'quote' ? quotes : invoices).map((doc: any) => (
                <div key={doc.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">
                          {activeTab === 'quote' ? doc.quote_number : doc.invoice_number}
                        </h3>
                        <span className="text-sm px-2 py-1 bg-gray-100 rounded">
                          {doc.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p><strong>Client:</strong> {doc.client_name}</p>
                        <p><strong>Total:</strong> {formatCurrency(doc.total_amount || 0, doc.currency || 'USD')}</p>
                        <p><strong>Created:</strong> {new Date(doc.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onView(doc.id, activeTab)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      {onEdit && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => onEdit(doc)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onDownload(doc, activeTab)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onSend(doc, activeTab)}
                        disabled={sendingDocument === doc.id}
                      >
                        <Send className="h-4 w-4 mr-1" />
                        {sendingDocument === doc.id ? 'Sending...' : 'Send'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DocumentList;
