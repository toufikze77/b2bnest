-- Create todo_subtasks table for subtask support
CREATE TABLE IF NOT EXISTS public.todo_subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id UUID NOT NULL REFERENCES public.todos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.todo_subtasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for todo_subtasks
CREATE POLICY "Users can view subtasks of their todos"
  ON public.todo_subtasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.todos
      WHERE todos.id = todo_subtasks.todo_id
      AND todos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create subtasks for their todos"
  ON public.todo_subtasks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.todos
      WHERE todos.id = todo_subtasks.todo_id
      AND todos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update subtasks of their todos"
  ON public.todo_subtasks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.todos
      WHERE todos.id = todo_subtasks.todo_id
      AND todos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete subtasks of their todos"
  ON public.todo_subtasks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.todos
      WHERE todos.id = todo_subtasks.todo_id
      AND todos.user_id = auth.uid()
    )
  );

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_todo_subtasks_todo_id ON public.todo_subtasks(todo_id);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_todo_subtasks_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_todo_subtasks_updated_at
  BEFORE UPDATE ON public.todo_subtasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_todo_subtasks_updated_at();