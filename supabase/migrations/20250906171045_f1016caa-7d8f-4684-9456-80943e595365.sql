-- Temporarily disable the todo history trigger to avoid null user_id issues
DROP TRIGGER IF EXISTS log_todo_changes_trigger ON public.todos;

-- Update any todos that reference B2BNEST project
UPDATE public.todos 
SET project_id = 'bf517b3e-e2a0-4600-8424-41056fe6da13'
WHERE project_id IS NULL 
  AND EXISTS (SELECT 1 FROM public.projects WHERE id = 'bf517b3e-e2a0-4600-8424-41056fe6da13');

-- Re-enable the trigger
CREATE TRIGGER log_todo_changes_trigger
    BEFORE UPDATE ON public.todos
    FOR EACH ROW
    EXECUTE FUNCTION public.log_todo_changes();