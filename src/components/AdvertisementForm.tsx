import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, X, Save, XCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface Advertisement {
  id: string;
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  price?: number;
  currency: string;
  contact_email?: string;
  contact_phone?: string;
  website_url?: string;
  image_urls: string[];
  is_service: boolean;
}

interface AdvertisementFormProps {
  categories: Category[];
  existingAd?: Advertisement | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const AdvertisementForm: React.FC<AdvertisementFormProps> = ({
  categories,
  existingAd,
  onSuccess,
  onCancel,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    title: existingAd?.title || '',
    description: existingAd?.description || '',
    category: existingAd?.category || '',
    subcategory: existingAd?.subcategory || '',
    price: existingAd?.price?.toString() || '',
    currency: existingAd?.currency || 'USD',
    contact_email: existingAd?.contact_email || user?.email || '',
    contact_phone: existingAd?.contact_phone || '',
    website_url: existingAd?.website_url || '',
    is_service: existingAd?.is_service ?? true,
  });

  const [imageUrls, setImageUrls] = useState<string[]>(existingAd?.image_urls || []);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (imageUrls.length >= 3) {
      toast({
        title: "Upload limit reached",
        description: "You can upload a maximum of 3 images per advertisement.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('advertisement-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('advertisement-images')
        .getPublicUrl(fileName);

      setImageUrls(prev => [...prev, data.publicUrl]);
      toast({
        title: "Image uploaded",
        description: "Your image has been uploaded successfully.",
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Upload failed",
        description: "There was an error uploading your image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async (imageUrl: string, index: number) => {
    try {
      // Extract file path from the URL
      const urlParts = imageUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const filePath = `${user?.id}/${fileName}`;

      // Remove from storage
      await supabase.storage
        .from('advertisement-images')
        .remove([filePath]);

      // Remove from state
      setImageUrls(prev => prev.filter((_, i) => i !== index));
    } catch (error) {
      console.error('Error removing image:', error);
      toast({
        title: "Error",
        description: "Failed to remove image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const advertisementData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        subcategory: formData.subcategory.trim() || null,
        price: formData.price ? parseFloat(formData.price) : null,
        currency: formData.currency,
        contact_email: formData.contact_email.trim() || null,
        contact_phone: formData.contact_phone.trim() || null,
        website_url: formData.website_url.trim() || null,
        image_urls: imageUrls,
        is_service: formData.is_service,
        user_id: user.id,
      };

      let result;
      if (existingAd) {
        result = await supabase
          .from('advertisements')
          .update(advertisementData)
          .eq('id', existingAd.id);
      } else {
        result = await supabase
          .from('advertisements')
          .insert([advertisementData]);
      }

      if (result.error) throw result.error;

      toast({
        title: "Success!",
        description: `Advertisement ${existingAd ? 'updated' : 'created'} successfully.`,
      });
      onSuccess();
    } catch (error) {
      console.error('Error saving advertisement:', error);
      toast({
        title: "Error",
        description: `Failed to ${existingAd ? 'update' : 'create'} advertisement. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Enter advertisement title"
              required
            />
          </div>

          <div>
            <Label htmlFor="category">Category *</Label>
            <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="subcategory">Subcategory</Label>
            <Input
              id="subcategory"
              value={formData.subcategory}
              onChange={(e) => handleInputChange('subcategory', e.target.value)}
              placeholder="Optional subcategory"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_service"
              checked={formData.is_service}
              onCheckedChange={(checked) => handleInputChange('is_service', checked)}
            />
            <Label htmlFor="is_service">
              This is a service (uncheck for products)
            </Label>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                type="number"
                value={formData.price}
                onChange={(e) => handleInputChange('price', e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Select value={formData.currency} onValueChange={(value) => handleInputChange('currency', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="CAD">CAD</SelectItem>
                  <SelectItem value="AUD">AUD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="contact_email">Contact Email</Label>
            <Input
              id="contact_email"
              type="email"
              value={formData.contact_email}
              onChange={(e) => handleInputChange('contact_email', e.target.value)}
              placeholder="your.email@example.com"
            />
          </div>

          <div>
            <Label htmlFor="contact_phone">Contact Phone</Label>
            <Input
              id="contact_phone"
              type="tel"
              value={formData.contact_phone}
              onChange={(e) => handleInputChange('contact_phone', e.target.value)}
              placeholder="+1 (555) 123-4567"
            />
          </div>

          <div>
            <Label htmlFor="website_url">Website URL</Label>
            <Input
              id="website_url"
              type="url"
              value={formData.website_url}
              onChange={(e) => handleInputChange('website_url', e.target.value)}
              placeholder="https://your-website.com"
            />
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
          placeholder="Describe your service or product in detail..."
          rows={4}
          required
        />
      </div>

      <div>
        <Label>Images (up to 3)</Label>
        <div className="space-y-4">
          {imageUrls.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {imageUrls.map((url, index) => (
                <Card key={index} className="relative">
                  <CardContent className="p-2">
                    <img
                      src={url}
                      alt={`Upload ${index + 1}`}
                      className="w-full h-24 object-cover rounded"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                      onClick={() => removeImage(url, index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          
          {imageUrls.length < 3 && (
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
                disabled={uploading}
              />
              <label htmlFor="image-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {uploading ? 'Uploading...' : 'Click to upload an image'}
                </p>
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-4 pt-6">
        <Button type="submit" disabled={loading} className="flex items-center gap-2">
          <Save className="w-4 h-4" />
          {loading ? 'Saving...' : existingAd ? 'Update Advertisement' : 'Create Advertisement'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="flex items-center gap-2">
          <XCircle className="w-4 h-4" />
          Cancel
        </Button>
      </div>
    </form>
  );
};