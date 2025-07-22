-- Create storage buckets for user avatars and service images
INSERT INTO storage.buckets (id, name, public) VALUES ('user-avatars', 'user-avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('service-images', 'service-images', true);

-- Create policies for user avatars
CREATE POLICY "Anyone can view user avatars" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'user-avatars');

CREATE POLICY "Users can upload their own avatars" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'user-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatars" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'user-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatars" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'user-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create policies for service images
CREATE POLICY "Anyone can view service images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'service-images');

CREATE POLICY "Authenticated users can upload service images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'service-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update service images they uploaded" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'service-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete service images they uploaded" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'service-images' AND auth.uid()::text = (storage.foldername(name))[1]);