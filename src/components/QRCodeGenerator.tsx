import React, { useState } from 'react';
import { QrCode, Download, Copy, Check, Zap, Globe, Mail, Phone, Wifi } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

const QRCodeGenerator = () => {
  const [qrData, setQrData] = useState('');
  const [qrType, setQrType] = useState('url');
  const [generatedQR, setGeneratedQR] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Form data for different QR types
  const [emailData, setEmailData] = useState({ email: '', subject: '', body: '' });
  const [phoneData, setPhoneData] = useState('');
  const [wifiData, setWifiData] = useState({ ssid: '', password: '', security: 'WPA' });

  const generateQRCode = () => {
    let dataToEncode = '';
    
    switch (qrType) {
      case 'url':
        if (!qrData.startsWith('http://') && !qrData.startsWith('https://')) {
          dataToEncode = 'https://' + qrData;
        } else {
          dataToEncode = qrData;
        }
        break;
      case 'email':
        dataToEncode = `mailto:${emailData.email}?subject=${encodeURIComponent(emailData.subject)}&body=${encodeURIComponent(emailData.body)}`;
        break;
      case 'phone':
        dataToEncode = `tel:${phoneData}`;
        break;
      case 'wifi':
        dataToEncode = `WIFI:T:${wifiData.security};S:${wifiData.ssid};P:${wifiData.password};;`;
        break;
      default:
        dataToEncode = qrData;
    }

    if (!dataToEncode.trim()) {
      toast({
        title: "Data Required",
        description: "Please enter data to generate QR code.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    
    // Simulate QR generation (in real app, use QR library like qrcode)
    setTimeout(() => {
      // Generate a simple SVG QR code placeholder (basic squares pattern)
      const size = 200;
      const modules = 25; // QR modules per side
      const moduleSize = size / modules;
      
      let svgContent = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">`;
      svgContent += `<rect width="${size}" height="${size}" fill="white"/>`;
      
      // Generate random pattern for demo (real QR would be calculated)
      for (let i = 0; i < modules; i++) {
        for (let j = 0; j < modules; j++) {
          if (Math.random() > 0.5) {
            svgContent += `<rect x="${j * moduleSize}" y="${i * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="black"/>`;
          }
        }
      }
      
      svgContent += '</svg>';
      
      const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' });
      const svgUrl = URL.createObjectURL(svgBlob);
      
      setGeneratedQR(svgUrl);
      setIsGenerating(false);
    }, 1000);
  };

  const downloadQR = () => {
    if (!generatedQR) return;
    
    const link = document.createElement('a');
    link.download = 'qrcode.svg';
    link.href = generatedQR;
    link.click();
    
    toast({
      title: "Downloaded!",
      description: "QR code saved to your downloads."
    });
  };

  const copyQRLink = () => {
    navigator.clipboard.writeText(qrData);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "QR code data copied to clipboard."
    });
    
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">QR Code Generator</h1>
        <p className="text-gray-600">Create QR codes for websites, contacts, and more</p>
        <Badge variant="secondary" className="mt-2">
          Free Plan: Basic QR codes only
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              QR Code Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={qrType} onValueChange={setQrType} className="w-full">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="url">URL</TabsTrigger>
                <TabsTrigger value="text">Text</TabsTrigger>
                <TabsTrigger value="email">Email</TabsTrigger>
                <TabsTrigger value="phone">Phone</TabsTrigger>
              </TabsList>
              
              <TabsContent value="url" className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Website URL</label>
                  <Input
                    placeholder="example.com"
                    value={qrData}
                    onChange={(e) => setQrData(e.target.value)}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="text" className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Text Content</label>
                  <textarea
                    className="w-full p-2 border border-gray-300 rounded-md resize-none"
                    rows={3}
                    placeholder="Enter your text here..."
                    value={qrData}
                    onChange={(e) => setQrData(e.target.value)}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="email" className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Email Address</label>
                  <Input
                    placeholder="contact@example.com"
                    value={emailData.email}
                    onChange={(e) => setEmailData({...emailData, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Subject (Optional)</label>
                  <Input
                    placeholder="Email subject"
                    value={emailData.subject}
                    onChange={(e) => setEmailData({...emailData, subject: e.target.value})}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="phone" className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Phone Number</label>
                  <Input
                    placeholder="+1234567890"
                    value={phoneData}
                    onChange={(e) => setPhoneData(e.target.value)}
                  />
                </div>
              </TabsContent>
            </Tabs>
            
            <Button 
              onClick={generateQRCode} 
              disabled={isGenerating}
              className="w-full mt-6"
            >
              {isGenerating ? (
                <>
                  <QrCode className="h-4 w-4 mr-2 animate-pulse" />
                  Generating...
                </>
              ) : (
                <>
                  <QrCode className="h-4 w-4 mr-2" />
                  Generate QR Code
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Output Section */}
        <Card>
          <CardHeader>
            <CardTitle>Generated QR Code</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            {generatedQR ? (
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block">
                  <img 
                    src={generatedQR} 
                    alt="Generated QR Code" 
                    className="w-48 h-48 mx-auto"
                  />
                </div>
                
                <div className="flex gap-2 justify-center">
                  <Button onClick={downloadQR} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  <Button onClick={copyQRLink} variant="outline">
                    {copied ? (
                      <Check className="h-4 w-4 mr-2" />
                    ) : (
                      <Copy className="h-4 w-4 mr-2" />
                    )}
                    Copy Data
                  </Button>
                </div>
                
                <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                  Format: SVG • Size: 200x200px
                </div>
              </div>
            ) : (
              <div className="py-12">
                <QrCode className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Generate</h3>
                <p className="text-gray-600">
                  Enter your data and click generate to create your QR code.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upgrade CTA */}
      <Card className="mt-6">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 mb-1">Want Custom QR Codes?</h4>
              <p className="text-sm text-blue-700 mb-3">
                Upgrade to get custom colors, logos, high-resolution downloads, and analytics tracking.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">Starter: Custom Colors</Badge>
                <Badge variant="outline" className="text-xs">Pro: Logos + Analytics</Badge>
                <Badge variant="outline" className="text-xs">Enterprise: White-label</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QRCodeGenerator;