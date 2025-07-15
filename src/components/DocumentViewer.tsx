
import React from 'react';
import { ArrowLeft, Download, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/utils/currencyUtils';

interface DocumentViewerProps {
  document: any;
  onBack: () => void;
  onDownload: (doc: any, type: string) => void;
  onSend: (doc: any, type: string) => void;
  sendingDocument: string | null;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({
  document,
  onBack,
  onDownload,
  onSend,
  sendingDocument
}) => {
  const items = JSON.parse(document.items || '[]');
  const subtotal = document.subtotal || 0;
  const taxAmount = document.tax_amount || 0;
  const total = document.total_amount || 0;

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to List
            </Button>
            <div>
              <CardTitle className="text-xl">
                {document.type === 'quote' ? 'Quote' : 'Invoice'} Preview
              </CardTitle>
              <CardDescription>
                {document.type === 'quote' ? document.quote_number : document.invoice_number}
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => onDownload(document, document.type)}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button 
              variant="outline"
              onClick={() => onSend(document, document.type)}
              disabled={sendingDocument === document.id}
            >
              <Send className="h-4 w-4 mr-2" />
              {sendingDocument === document.id ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-white border rounded-lg p-8 max-w-4xl mx-auto">
          {/* Document Header */}
          <div className="flex justify-between items-start mb-8">
            <div className="flex-1">
              {document.logo_url && (
                <img 
                  src={document.logo_url} 
                  alt="Company Logo" 
                  className="h-16 mb-4 object-contain"
                />
              )}
              <h1 className="text-2xl font-bold text-blue-600 mb-2">
                {document.company_name || 'Company Name'}
              </h1>
              <div className="text-gray-600 whitespace-pre-line">
                {document.company_address}
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">
                {document.type === 'quote' ? 'QUOTE' : 'INVOICE'}
              </h2>
              <div className="text-sm space-y-1">
                <p><strong>Number:</strong> {document.type === 'quote' ? document.quote_number : document.invoice_number}</p>
                <p><strong>Date:</strong> {new Date(document.created_at).toLocaleDateString()}</p>
                {document.type === 'quote' && document.valid_until && (
                  <p><strong>Valid Until:</strong> {new Date(document.valid_until).toLocaleDateString()}</p>
                )}
                {document.type === 'invoice' && document.due_date && (
                  <p><strong>Due Date:</strong> {new Date(document.due_date).toLocaleDateString()}</p>
                )}
              </div>
            </div>
          </div>

          {/* Client Information */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-3">Bill To:</h3>
            <div className="text-gray-700">
              <p className="font-semibold">{document.client_name}</p>
              <p>{document.client_email}</p>
              <div className="whitespace-pre-line">{document.client_address}</div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-8">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
                  <th className="border border-gray-300 px-4 py-2 text-center">Quantity</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">Rate</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, index: number) => (
                  <tr key={index}>
                    <td className="border border-gray-300 px-4 py-2">{item.description}</td>
                    <td className="border border-gray-300 px-4 py-2 text-center">{item.quantity}</td>
                    <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(item.rate, document.currency)}</td>
                    <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(item.amount, document.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-64">
              <div className="flex justify-between py-2">
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal, document.currency)}</span>
              </div>
              {taxAmount > 0 && (
                <div className="flex justify-between py-2">
                  <span>Tax ({document.tax_rate}%):</span>
                  <span>{formatCurrency(taxAmount, document.currency)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-t-2 border-gray-800 font-bold text-lg">
                <span>Total:</span>
                <span>{formatCurrency(total, document.currency)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {document.notes && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Notes:</h3>
              <div className="text-gray-700 whitespace-pre-line bg-gray-50 p-4 rounded">
                {document.notes}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DocumentViewer;
