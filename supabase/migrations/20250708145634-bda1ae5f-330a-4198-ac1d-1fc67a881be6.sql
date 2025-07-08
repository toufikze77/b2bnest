-- Enable Row Level Security
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;

-- Create policies for companies
CREATE POLICY "Anyone can view companies" 
ON public.companies 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create companies" 
ON public.companies 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Company creators can update their companies" 
ON public.companies 
FOR UPDATE 
USING (auth.uid() = created_by);

-- Create policies for connections
CREATE POLICY "Users can view their connections" 
ON public.connections 
FOR SELECT 
USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Authenticated users can create connections" 
ON public.connections 
FOR INSERT 
WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update their connection requests" 
ON public.connections 
FOR UPDATE 
USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Create policies for social posts
CREATE POLICY "Anyone can view public posts" 
ON public.social_posts 
FOR SELECT 
USING (is_public = true);

CREATE POLICY "Users can view their own posts" 
ON public.social_posts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can create posts" 
ON public.social_posts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts" 
ON public.social_posts 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts" 
ON public.social_posts 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create policies for post likes
CREATE POLICY "Anyone can view post likes" 
ON public.post_likes 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can like posts" 
ON public.post_likes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own likes" 
ON public.post_likes 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create policies for post comments
CREATE POLICY "Anyone can view comments on public posts" 
ON public.post_comments 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create comments" 
ON public.post_comments 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" 
ON public.post_comments 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" 
ON public.post_comments 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create policies for job postings
CREATE POLICY "Anyone can view active job postings" 
ON public.job_postings 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Authenticated users can create job postings" 
ON public.job_postings 
FOR INSERT 
WITH CHECK (auth.uid() = posted_by);

CREATE POLICY "Job posters can update their postings" 
ON public.job_postings 
FOR UPDATE 
USING (auth.uid() = posted_by);