-- Fix todos table to properly reference projects
-- Add project_id foreign key if it doesn't exist
DO $$
BEGIN
    -- Check if project_id column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'todos' AND column_name = 'project_id' AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.todos ADD COLUMN project_id uuid REFERENCES public.projects(id);
    END IF;
END $$;

-- Update any existing todos that might have string project references
UPDATE public.todos 
SET project_id = (
    SELECT p.id 
    FROM public.projects p 
    WHERE p.name = 'Website Redesign'
    LIMIT 1
)
WHERE project_id IS NULL AND EXISTS (
    SELECT 1 FROM public.projects WHERE name = 'Website Redesign'
);

-- Update any todos that reference B2BNEST
UPDATE public.todos 
SET project_id = (
    SELECT p.id 
    FROM public.projects p 
    WHERE p.name = 'B2BNEST'
    LIMIT 1
)
WHERE project_id IS NULL AND EXISTS (
    SELECT 1 FROM public.projects WHERE name = 'B2BNEST'
);