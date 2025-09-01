-- Create organizations/accounts table for multi-tenancy
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  subscription_tier TEXT DEFAULT 'free',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create organization members table for user-organization relationships
CREATE TABLE public.organization_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'manager', 'member')),
  permissions JSONB DEFAULT '{}',
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Add organization_id to todos table for multi-tenancy
ALTER TABLE public.todos ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Add organization_id to other relevant tables
ALTER TABLE public.projects ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Create organization invitations table
CREATE TABLE public.organization_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'manager', 'member')),
  invited_by UUID REFERENCES auth.users(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations
CREATE POLICY "Users can view organizations they belong to" 
ON public.organizations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_id = organizations.id 
    AND user_id = auth.uid() 
    AND is_active = true
  )
);

CREATE POLICY "Organization owners can update their organization" 
ON public.organizations 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_id = organizations.id 
    AND user_id = auth.uid() 
    AND role IN ('owner', 'admin')
    AND is_active = true
  )
);

CREATE POLICY "Authenticated users can create organizations" 
ON public.organizations 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

-- RLS Policies for organization members
CREATE POLICY "Users can view members of their organizations" 
ON public.organization_members 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om2 
    WHERE om2.organization_id = organization_members.organization_id 
    AND om2.user_id = auth.uid() 
    AND om2.is_active = true
  )
);

CREATE POLICY "Organization admins can manage members" 
ON public.organization_members 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_id = organization_members.organization_id 
    AND user_id = auth.uid() 
    AND role IN ('owner', 'admin')
    AND is_active = true
  )
);

-- RLS Policies for organization invitations
CREATE POLICY "Organization admins can manage invitations" 
ON public.organization_invitations 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_id = organization_invitations.organization_id 
    AND user_id = auth.uid() 
    AND role IN ('owner', 'admin')
    AND is_active = true
  )
);

-- Update todos RLS policy to include organization scope
DROP POLICY IF EXISTS "Users can manage their own todos" ON public.todos;
DROP POLICY IF EXISTS "Users can view todos assigned to them" ON public.todos;

CREATE POLICY "Users can manage todos in their organization" 
ON public.todos 
FOR ALL 
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM public.organization_members om 
    WHERE om.user_id = auth.uid() 
    AND om.is_active = true
  )
);

-- Update projects RLS policy to include organization scope  
DROP POLICY IF EXISTS "Users can manage time entries for their projects" ON public.project_time_entries;

CREATE POLICY "Users can manage time entries in their organization projects" 
ON public.project_time_entries 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.organization_members om ON p.organization_id = om.organization_id
    WHERE p.id = project_time_entries.project_id 
    AND om.user_id = auth.uid() 
    AND om.is_active = true
  )
);

-- Create function to automatically create first organization for new users
CREATE OR REPLACE FUNCTION public.create_user_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id UUID;
BEGIN
  -- Create personal organization for the user
  INSERT INTO public.organizations (name, slug, created_by)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)) || '''s Organization',
    LOWER(REPLACE(COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)), ' ', '-')) || '-org-' || EXTRACT(epoch FROM now())::text,
    NEW.id
  )
  RETURNING id INTO org_id;
  
  -- Add user as owner of the organization
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (org_id, NEW.id, 'owner');
  
  RETURN NEW;
END;
$$;

-- Update the existing handle_new_user function to include organization creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
  org_id UUID;
BEGIN
  -- Insert profile with default settings including display_name
  INSERT INTO public.profiles (
    id, 
    email, 
    full_name,
    display_name,
    currency_code,
    timezone,
    country_code,
    language_code,
    date_format,
    time_format,
    is_active
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    'USD',
    'UTC',
    'US',
    'en',
    'MM/DD/YYYY',
    '12h',
    true
  );
  
  -- Create personal organization for the user
  INSERT INTO public.organizations (name, slug, created_by)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)) || '''s Organization',
    LOWER(REPLACE(COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)), ' ', '-')) || '-org-' || EXTRACT(epoch FROM now())::text,
    NEW.id
  )
  RETURNING id INTO org_id;
  
  -- Add user as owner of the organization
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (org_id, NEW.id, 'owner');
  
  -- Check if this is the first user for system-wide admin roles
  SELECT COUNT(*) INTO user_count FROM auth.users;
  
  -- Assign system role (separate from organization roles)
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'owner');
    
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NEW.id,
      'Welcome, System Owner!',
      'You have been assigned as the owner of this platform with full administrative rights.',
      'welcome'
    );
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NEW.id,
      'Welcome to BusinessForms Pro!',
      'Thank you for joining us. You now have your own organization workspace.',
      'welcome'
    );
  END IF;

  -- Enable 2FA by default for all new users
  INSERT INTO public.user_2fa_settings (user_id, is_enabled, email_verified)
  VALUES (NEW.id, true, false);
  
  RETURN NEW;
END;
$$;