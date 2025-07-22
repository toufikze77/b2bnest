import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Upload, Image as ImageIcon } from 'lucide-react';
import ImageUpload from '@/components/ImageUpload';

interface ServiceImageUploadProps {
  onServiceCreated?: () => void;
}

const ServiceImageUpload = ({ onServiceCreated }: ServiceImageUploadProps) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serviceData, setServiceData] = useState({
    title: '',
    description: '',
    category: 'Technology',
    price: '',
    imageUrl: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to create a service.",
        variant: "destructive"
      });
      return;
    }

    if (!serviceData.title || !serviceData.description) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Here you would typically save to a database
      // For now, we'll just show a success message
      toast({
        title: "Success",
        description: "Your service has been created successfully!"
      });

      // Reset form
      setServiceData({
        title: '',
        description: '',
        category: 'Technology',
        price: '',
        imageUrl: ''
      });

      onServiceCreated?.();
    } catch (error) {
      console.error('Error creating service:', error);
      toast({
        title: "Error",
        description: "Failed to create service. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>Please sign in to create a featured service.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Create Featured Service
        </CardTitle>
        <CardDescription>
          Add your professional service to the Premium Marketplace with images
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Service Title *</Label>
            <Input
              id="title"
              value={serviceData.title}
              onChange={(e) => setServiceData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter your service title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={serviceData.description}
              onChange={(e) => setServiceData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe your service in detail"
              rows={4}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                value={serviceData.category}
                onChange={(e) => setServiceData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              >
                <option value="Technology">Technology</option>
                <option value="Marketing">Marketing</option>
                <option value="Consulting">Consulting</option>
                <option value="Design">Design</option>
                <option value="Finance">Finance</option>
                <option value="Legal">Legal</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Price (GBP)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={serviceData.price}
                onChange={(e) => setServiceData(prev => ({ ...prev, price: e.target.value }))}
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <ImageUpload
              onImageUploaded={(url) => setServiceData(prev => ({ ...prev, imageUrl: url }))}
              bucket="service-images"
              userId={user.id}
              currentImageUrl={serviceData.imageUrl}
              label="Service Image"
              maxSize={5}
            />
          </div>

          <Button 
            type="submit" 
            disabled={isSubmitting || !serviceData.title || !serviceData.description}
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Creating Service...' : 'Create Featured Service'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ServiceImageUpload;