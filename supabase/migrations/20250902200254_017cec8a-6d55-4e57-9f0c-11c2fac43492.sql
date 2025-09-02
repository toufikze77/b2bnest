-- Create multi-tenant project management schema
-- Step 1: Create core tables without complex constraints

-- 1. ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. ACCOUNT_USERS TABLE
CREATE TABLE IF NOT EXISTS account_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'member',
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    joined_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_per_account UNIQUE(account_id, user_id),
    CONSTRAINT unique_email_per_account UNIQUE(account_id, email)
);

-- 3. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active',
    color VARCHAR(7) DEFAULT '#3B82F6',
    owner_id UUID NOT NULL,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TASKS TABLE
CREATE TABLE IF NOT EXISTS tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'todo',
    priority VARCHAR(50) DEFAULT 'medium',
    assigned_to UUID[] DEFAULT '{}',
    created_by UUID NOT NULL,
    due_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    position INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TASK_COMMENTS TABLE
CREATE TABLE IF NOT EXISTS task_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_account_users_account_id ON account_users(account_id);
CREATE INDEX IF NOT EXISTS idx_account_users_user_id ON account_users(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_account_id ON projects(account_id);
CREATE INDEX IF NOT EXISTS idx_tasks_account_id ON tasks(account_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks USING GIN(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);

-- Enable RLS
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

-- Simple RLS policies
CREATE POLICY "account_select_policy" ON accounts FOR SELECT USING (
    EXISTS (SELECT 1 FROM account_users WHERE account_users.account_id = accounts.id AND account_users.user_id = auth.uid())
);

CREATE POLICY "account_users_select_policy" ON account_users FOR SELECT USING (
    account_id IN (SELECT account_id FROM account_users WHERE user_id = auth.uid())
);

CREATE POLICY "account_users_all_policy" ON account_users FOR ALL USING (
    account_id IN (SELECT account_id FROM account_users WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
);

CREATE POLICY "projects_select_policy" ON projects FOR SELECT USING (
    account_id IN (SELECT account_id FROM account_users WHERE user_id = auth.uid())
);

CREATE POLICY "projects_all_policy" ON projects FOR ALL USING (
    account_id IN (SELECT account_id FROM account_users WHERE user_id = auth.uid())
);

CREATE POLICY "tasks_select_policy" ON tasks FOR SELECT USING (
    account_id IN (SELECT account_id FROM account_users WHERE user_id = auth.uid())
);

CREATE POLICY "tasks_all_policy" ON tasks FOR ALL USING (
    account_id IN (SELECT account_id FROM account_users WHERE user_id = auth.uid())
);

CREATE POLICY "task_comments_select_policy" ON task_comments FOR SELECT USING (
    account_id IN (SELECT account_id FROM account_users WHERE user_id = auth.uid())
);

CREATE POLICY "task_comments_all_policy" ON task_comments FOR ALL USING (
    account_id IN (SELECT account_id FROM account_users WHERE user_id = auth.uid())
);

-- Helper function
CREATE OR REPLACE FUNCTION get_user_account_id(user_uuid UUID)
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT account_id FROM account_users WHERE user_id = user_uuid LIMIT 1);
END;
$$ language 'plpgsql';