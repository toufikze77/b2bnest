-- Create enhanced todos table with JIRA-like features
CREATE TABLE public.todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  labels TEXT[] DEFAULT '{}',
  parent_id UUID REFERENCES public.todos(id) ON DELETE SET NULL,
  due_date DATE,
  start_date DATE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  estimated_hours INTEGER,
  actual_hours INTEGER
);

-- Create todo comments table
CREATE TABLE public.todo_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id UUID NOT NULL REFERENCES public.todos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create todo history table
CREATE TABLE public.todo_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id UUID NOT NULL REFERENCES public.todos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for todos
CREATE POLICY "Users can manage their own todos" ON public.todos
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view todos assigned to them" ON public.todos
  FOR SELECT USING (auth.uid() = assigned_to);

-- RLS Policies for todo_comments
CREATE POLICY "Users can view comments on their todos" ON public.todo_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.todos 
      WHERE id = todo_comments.todo_id 
      AND (user_id = auth.uid() OR assigned_to = auth.uid())
    )
  );

CREATE POLICY "Users can create comments on their todos" ON public.todo_comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.todos 
      WHERE id = todo_comments.todo_id 
      AND (user_id = auth.uid() OR assigned_to = auth.uid())
    )
  );

-- RLS Policies for todo_history
CREATE POLICY "Users can view history of their todos" ON public.todo_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.todos 
      WHERE id = todo_history.todo_id 
      AND (user_id = auth.uid() OR assigned_to = auth.uid())
    )
  );

CREATE POLICY "System can insert history records" ON public.todo_history
  FOR INSERT WITH CHECK (true);

-- Create trigger for updating updated_at
CREATE OR REPLACE FUNCTION public.update_todo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_todos_updated_at
  BEFORE UPDATE ON public.todos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_todo_updated_at();

CREATE TRIGGER update_todo_comments_updated_at
  BEFORE UPDATE ON public.todo_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_todo_updated_at();

-- Create function to log todo changes
CREATE OR REPLACE FUNCTION public.log_todo_changes()
RETURNS TRIGGER AS $$
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_todo_changes_trigger
  AFTER UPDATE ON public.todos
  FOR EACH ROW
  EXECUTE FUNCTION public.log_todo_changes();