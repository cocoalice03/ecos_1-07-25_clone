-- Create missing ECOS tables for Supabase database bgrxjdcpxgdunanwtpvv
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/bgrxjdcpxgdunanwtpvv/sql

-- Create ecos_sessions table
CREATE TABLE IF NOT EXISTS public.ecos_sessions (
    id VARCHAR(255) PRIMARY KEY,
    scenario_id INTEGER REFERENCES public.ecos_scenarios(id),
    student_email VARCHAR(255) NOT NULL,
    teacher_email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ecos_messages table
CREATE TABLE IF NOT EXISTS public.ecos_messages (
    id VARCHAR(255) PRIMARY KEY,
    session_id VARCHAR(255) REFERENCES public.ecos_sessions(id),
    content TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    type VARCHAR(50) DEFAULT 'text',
    sender_email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ecos_evaluations table
CREATE TABLE IF NOT EXISTS public.ecos_evaluations (
    id VARCHAR(255) PRIMARY KEY,
    session_id VARCHAR(255) REFERENCES public.ecos_sessions(id),
    teacher_email VARCHAR(255),
    overall_score INTEGER,
    criteria_scores TEXT,
    feedback TEXT,
    recommendations TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.ecos_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecos_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecos_evaluations ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies for authenticated users
CREATE POLICY "Allow authenticated users to manage sessions" ON public.ecos_sessions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to manage messages" ON public.ecos_messages
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to manage evaluations" ON public.ecos_evaluations
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Verify the setup
SELECT 
    'ecos_scenarios' as table_name, 
    COUNT(*) as row_count 
FROM public.ecos_scenarios
UNION ALL
SELECT 
    'ecos_sessions' as table_name, 
    COUNT(*) as row_count 
FROM public.ecos_sessions
UNION ALL
SELECT 
    'ecos_messages' as table_name, 
    COUNT(*) as row_count 
FROM public.ecos_messages
UNION ALL
SELECT 
    'ecos_evaluations' as table_name, 
    COUNT(*) as row_count 
FROM public.ecos_evaluations;