import React, { useState } from 'react';
import { Megaphone, Upload, Plus, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/components/ui/use-toast';
import Footer from '@/components/Footer';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { documentService } from '@/services/documentService';

const MarketingMaterials = () => {
  const { user } = useAuth();
  const { canUpload, loading: roleLoading } = useUserRole();
  const [uploadMode, setUploadMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subcategory: '',
    tags: '',
    price: '',
    file: null as File | null
  });

  const subcategories = ['Brochures', 'Social Media', 'Email Templates', 'Presentations', 'Banners'];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, file: e.target.files[0] });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canUpload) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to upload documents.",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    
    try {
      const tagsArray = formData.tags.split(',').map(tag => tag.trim()).filter(Boolean);
      
      await documentService.uploadDocument({
        title: formData.title,
        description: formData.description,
        category: 'marketing',
        subcategory: formData.subcategory,
        tags: tagsArray,
        price: formData.price ? parseFloat(formData.price) : 0,
        file_name: formData.file?.name,
        file_size: formData.file?.size
      });

      toast({
        title: "Document Uploaded",
        description: "Your marketing material has been uploaded successfully."
      });

      // Reset form
      setFormData({
        title: '',
        description: '',
        subcategory: '',
        tags: '',
        price: '',
        file: null
      });
      setUploadMode(false);
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload document. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-pink-50">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center">
            <div className="text-lg">Loading...</div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-pink-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-pink-500 w-12 h-12 rounded-full flex items-center justify-center">
              <Megaphone className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Marketing Materials</h1>
              <p className="text-gray-600">Brochures, flyers, and marketing templates</p>
            </div>
          </div>
          
          {!user && (
            <Alert className="mb-6">
              <Lock className="h-4 w-4" />
              <AlertDescription>
                Please sign in to view and access marketing materials.
              </AlertDescription>
            </Alert>
          )}

          {user && !canUpload && (
            <Alert className="mb-6">
              <Lock className="h-4 w-4" />
              <AlertDescription>
                You don't have permission to upload documents. Contact the administrator for access.
              </AlertDescription>
            </Alert>
          )}

          {canUpload && (
            <div className="flex gap-4">
              <Button 
                onClick={() => setUploadMode(!uploadMode)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Upload New Document
              </Button>
            </div>
          )}
        </div>

        {uploadMode && canUpload && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Upload Marketing Material</CardTitle>
              <CardDescription>Add a new marketing template to the collection</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="title">Document Title</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      placeholder="e.g., Social Media Campaign Template"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="subcategory">Subcategory</Label>
                    <Select value={formData.subcategory} onValueChange={(value) => setFormData({...formData, subcategory: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select subcategory" />
                      </SelectTrigger>
                      <SelectContent>
                        {subcategories.map(sub => (
                          <SelectItem key={sub} value={sub.toLowerCase().replace(/\s+/g, '-')}>{sub}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Describe the marketing material and its use cases"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="tags">Tags (comma-separated)</Label>
                    <Input
                      id="tags"
                      value={formData.tags}
                      onChange={(e) => setFormData({...formData, tags: e.target.value})}
                      placeholder="marketing, social media, branding, campaign"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="price">Price ($)</Label>
                    <Input
                      id="price"
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({...formData, price: e.target.value})}
                      placeholder="0 for free"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="file">Document File</Label>
                  <div className="mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-pink-400 transition-colors">
                    <div className="space-y-1 text-center">
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="flex text-sm text-gray-600">
                        <label htmlFor="file" className="relative cursor-pointer bg-white rounded-md font-medium text-pink-600 hover:text-pink-500">
                          <span>Upload a file</span>
                          <input
                            id="file"
                            name="file"
                            type="file"
                            className="sr-only"
                            accept=".pdf,.doc,.docx,.xlsx,.pptx,.ai,.psd,.png,.jpg,.jpeg"
                            onChange={handleFileChange}
                            required
                          />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-gray-500">PDF, DOC, DOCX, XLSX, PPTX, AI, PSD, PNG, JPG up to 10MB</p>
                      {formData.file && (
                        <p className="text-sm text-pink-600 font-medium">{formData.file.name}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button type="submit" className="flex-1" disabled={uploading}>
                    {uploading ? 'Uploading...' : 'Upload Material'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setUploadMode(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subcategories.map((subcategory) => (
            <Card key={subcategory} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">{subcategory}</CardTitle>
                <CardDescription>Browse {subcategory.toLowerCase()} templates</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  View Templates
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default MarketingMaterials;
