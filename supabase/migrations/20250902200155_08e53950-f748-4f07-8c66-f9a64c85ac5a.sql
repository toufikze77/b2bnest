-- =====================================================
-- SUPABASE DATABASE SCHEMA FOR MULTI-TENANT PLATFORM
-- =====================================================

-- 1. ACCOUNTS TABLE (Tenant Organizations)
CREATE TABLE IF NOT EXISTS accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. ACCOUNT_USERS TABLE (Local Users per Tenant)
CREATE TABLE IF NOT EXISTS account_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- Reference to auth.users
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'member', -- admin, manager, member
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
    status VARCHAR(50) DEFAULT 'active', -- active, archived, completed
    color VARCHAR(7) DEFAULT '#3B82F6', -- hex color
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
    status VARCHAR(50) DEFAULT 'todo', -- todo, in_progress, review, done
    priority VARCHAR(50) DEFAULT 'medium', -- low, medium, high, urgent
    assigned_to UUID[] DEFAULT '{}', -- Array of user_ids
    created_by UUID NOT NULL,
    due_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    position INTEGER DEFAULT 0, -- For ordering within columns
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

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_account_users_account_id ON account_users(account_id);
CREATE INDEX IF NOT EXISTS idx_account_users_user_id ON account_users(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_account_id ON projects(account_id);
CREATE INDEX IF NOT EXISTS idx_tasks_account_id ON tasks(account_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks USING GIN(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

-- ACCOUNTS POLICIES
CREATE POLICY "Users can view accounts they belong to" ON accounts
    FOR SELECT USING (
        id IN (
            SELECT account_id FROM account_users 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can update their account" ON accounts
    FOR UPDATE USING (
        id IN (
            SELECT account_id FROM account_users 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- ACCOUNT_USERS POLICIES
CREATE POLICY "Users can view account members" ON account_users
    FOR SELECT USING (
        account_id IN (
            SELECT account_id FROM account_users 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage account users" ON account_users
    FOR ALL USING (
        account_id IN (
            SELECT account_id FROM account_users 
            WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

-- PROJECTS POLICIES
CREATE POLICY "Users can view account projects" ON projects
    FOR SELECT USING (
        account_id IN (
            SELECT account_id FROM account_users 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage projects" ON projects
    FOR ALL USING (
        account_id IN (
            SELECT account_id FROM account_users 
            WHERE user_id = auth.uid()
        )
    );

-- TASKS POLICIES
CREATE POLICY "Users can view account tasks" ON tasks
    FOR SELECT USING (
        account_id IN (
            SELECT account_id FROM account_users 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage tasks" ON tasks
    FOR ALL USING (
        account_id IN (
            SELECT account_id FROM account_users 
            WHERE user_id = auth.uid()
        )
    );

-- TASK_COMMENTS POLICIES
CREATE POLICY "Users can view task comments" ON task_comments
    FOR SELECT USING (
        account_id IN (
            SELECT account_id FROM account_users 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their comments" ON task_comments
    FOR ALL USING (
        account_id IN (
            SELECT account_id FROM account_users 
            WHERE user_id = auth.uid()
        )
    );

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_account_users_updated_at BEFORE UPDATE ON account_users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_task_comments_updated_at BEFORE UPDATE ON task_comments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get user's account context
CREATE OR REPLACE FUNCTION get_user_account_id(user_uuid UUID)
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT account_id 
        FROM account_users 
        WHERE user_id = user_uuid 
        LIMIT 1
    );
END;
$$ language 'plpgsql';

-- Function to automatically create account and account_user when user signs up
CREATE OR REPLACE FUNCTION handle_new_user_account()
RETURNS TRIGGER AS $$
DECLARE
    new_account_id UUID;
    user_name TEXT;
BEGIN
    -- Extract name from metadata or use email
    user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1));
    
    -- Create a personal account for the user
    INSERT INTO accounts (name, slug)
    VALUES (
        user_name || '''s Account',
        LOWER(REPLACE(user_name, ' ', '-')) || '-' || EXTRACT(epoch FROM now())::text
    )
    RETURNING id INTO new_account_id;
    
    -- Add user to the account as admin
    INSERT INTO account_users (account_id, user_id, name, email, role, joined_at)
    VALUES (new_account_id, NEW.id, user_name, NEW.email, 'admin', NOW());
    
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;