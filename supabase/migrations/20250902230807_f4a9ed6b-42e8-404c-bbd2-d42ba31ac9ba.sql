-- Enable realtime for todo_comments table
ALTER TABLE public.todo_comments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.todo_comments;