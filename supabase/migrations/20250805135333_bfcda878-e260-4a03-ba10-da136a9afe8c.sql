-- Add project_id column to todos table to link tasks with projects
ALTER TABLE public.todos ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX idx_todos_project_id ON public.todos(project_id);

-- Update the log_todo_changes function to track project changes
CREATE OR REPLACE FUNCTION public.log_todo_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Log status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.todo_history (todo_id, user_id, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'status', OLD.status, NEW.status);
  END IF;
  
  -- Log priority changes
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO public.todo_history (todo_id, user_id, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'priority', OLD.priority, NEW.priority);
  END IF;
  
  -- Log assignment changes
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO public.todo_history (todo_id, user_id, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'assigned_to', OLD.assigned_to::TEXT, NEW.assigned_to::TEXT);
  END IF;
  
  -- Log project changes
  IF OLD.project_id IS DISTINCT FROM NEW.project_id THEN
    INSERT INTO public.todo_history (todo_id, user_id, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'project_id', OLD.project_id::TEXT, NEW.project_id::TEXT);
  END IF;
  
  RETURN NEW;
END;
$function$;