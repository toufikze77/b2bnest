-- Create note_categories table for organizing notes into folders
CREATE TABLE IF NOT EXISTS note_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT 'blue',
  parent_id UUID REFERENCES note_categories(id) ON DELETE CASCADE,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create notes table with all features
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  format TEXT DEFAULT 'richtext' CHECK (format IN ('richtext', 'markdown', 'plaintext')),
  category_id UUID REFERENCES note_categories(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  color TEXT DEFAULT 'default',
  is_favorite BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  is_template BOOLEAN DEFAULT false,
  template_name TEXT,
  checklist JSONB DEFAULT '[]',
  reminder_date TIMESTAMP WITH TIME ZONE,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE note_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for note_categories
CREATE POLICY "Users can view their own categories"
  ON note_categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own categories"
  ON note_categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own categories"
  ON note_categories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own categories"
  ON note_categories FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for notes
CREATE POLICY "Users can view their own notes"
  ON notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notes"
  ON notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes"
  ON notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
  ON notes FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_notes_category_id ON notes(category_id);
CREATE INDEX idx_notes_tags ON notes USING GIN(tags);
CREATE INDEX idx_notes_is_archived ON notes(is_archived);
CREATE INDEX idx_notes_is_favorite ON notes(is_favorite);
CREATE INDEX idx_notes_is_template ON notes(is_template);
CREATE INDEX idx_notes_reminder_date ON notes(reminder_date) WHERE reminder_date IS NOT NULL;
CREATE INDEX idx_note_categories_user_id ON note_categories(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_notes_timestamp
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_notes_updated_at();

CREATE TRIGGER update_note_categories_timestamp
  BEFORE UPDATE ON note_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_notes_updated_at();