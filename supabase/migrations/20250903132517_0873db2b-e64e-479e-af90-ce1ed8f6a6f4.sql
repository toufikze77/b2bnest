-- Create organization_invitations table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days')
);

-- Enable RLS on organization_invitations
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- Create policies for organization_invitations
CREATE POLICY "Organization admins can manage invitations"
ON public.organization_invitations
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organization_invitations.organization_id
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
    AND om.is_active = true
  )
);

CREATE POLICY "Users can view invitations sent to their email"
ON public.organization_invitations
FOR SELECT
USING (email = auth.email());

-- Function to accept invitation
CREATE OR REPLACE FUNCTION public.accept_organization_invitation(invitation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invitation_record RECORD;
  result JSONB;
BEGIN
  -- Get invitation details
  SELECT * INTO invitation_record
  FROM public.organization_invitations
  WHERE id = invitation_id
    AND status = 'pending'
    AND expires_at > now()
    AND email = auth.email();
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;
  
  -- Check if user is already a member
  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = invitation_record.organization_id
    AND user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already a member of this organization');
  END IF;
  
  -- Add user to organization
  INSERT INTO public.organization_members (
    organization_id,
    user_id,
    role,
    invited_by
  ) VALUES (
    invitation_record.organization_id,
    auth.uid(),
    invitation_record.role,
    invitation_record.invited_by
  );
  
  -- Mark invitation as accepted
  UPDATE public.organization_invitations
  SET status = 'accepted'
  WHERE id = invitation_id;
  
  RETURN jsonb_build_object('success', true, 'organization_id', invitation_record.organization_id);
END;
$$;