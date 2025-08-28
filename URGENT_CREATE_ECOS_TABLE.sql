-- URGENT: Create ecos_scenarios table for Supabase database bgrxjdcpxgdunanwtpvv
-- Run this immediately in Supabase SQL Editor: https://supabase.com/dashboard/project/bgrxjdcpxgdunanwtpvv/sql

-- Step 1: Create the ecos_scenarios table that the application expects
CREATE TABLE IF NOT EXISTS public.ecos_scenarios (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    patient_prompt TEXT,
    evaluation_criteria JSONB,
    pinecone_index VARCHAR(255),
    image_url VARCHAR(500),
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Copy data from scenarios table if it exists  
INSERT INTO public.ecos_scenarios (id, title, description, patient_prompt, evaluation_criteria, created_by, created_at)
SELECT id, title, description, patient_prompt, evaluation_criteria, created_by, created_at 
FROM public.scenarios 
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scenarios' AND table_schema = 'public')
ON CONFLICT (id) DO NOTHING;

-- Step 3: Insert essential ECOS scenarios for the application
INSERT INTO public.ecos_scenarios (title, description, patient_prompt, evaluation_criteria, created_by) 
VALUES 
('Consultation cardiologique - Douleur thoracique', 
 'Patient de 45 ans consultant pour douleur thoracique depuis 2 heures', 
 'Je suis un homme de 45 ans et j''ai une douleur dans la poitrine depuis ce matin. Ça me serre et ça fait mal quand je respire profondément.',
 '{"anamnese": 25, "examen_physique": 25, "diagnostic": 25, "prise_en_charge": 25}',
 'system'),

('Urgence pédiatrique - Fièvre chez l''enfant', 
 'Enfant de 3 ans avec fièvre élevée et altération de l''état général', 
 'Mon fils de 3 ans fait de la fièvre depuis hier soir, il est très fatigué et ne veut plus manger.',
 '{"anamnese": 20, "examen_clinique": 30, "diagnostic": 25, "traitement": 25}',
 'system'),

('Traumatologie - Entorse de cheville', 
 'Patient ayant chuté avec douleur et gonflement de la cheville', 
 'J''ai glissé dans les escaliers et ma cheville me fait très mal. Elle a gonflé et je n''arrive plus à poser le pied par terre.',
 '{"anamnese": 20, "examen_physique": 35, "imagerie": 20, "prise_en_charge": 25}',
 'system'),

('Consultation psychiatrique - Troubles anxieux', 
 'Patient de 30 ans présentant des symptômes d''anxiété généralisée', 
 'Je me sens très angoissé depuis plusieurs semaines, j''ai du mal à dormir et je me fais du souci pour tout.',
 '{"anamnese": 30, "examen_mental": 25, "diagnostic": 25, "prise_en_charge": 20}',
 'system'),

('Médecine interne - Diabète décompensé', 
 'Patient diabétique de type 2 avec glycémie élevée et symptômes', 
 'Je suis diabétique depuis 10 ans, mais depuis quelques jours je me sens très fatigué, j''ai soif tout le temps et j''urine beaucoup.',
 '{"anamnese": 25, "examen_physique": 20, "biologie": 25, "traitement": 30}',
 'system')

ON CONFLICT (id) DO NOTHING;

-- Step 4: Create other essential tables if they don't exist
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

-- Step 5: Verify the setup
SELECT COUNT(*) as ecos_scenarios_count FROM public.ecos_scenarios;
SELECT id, title, created_by FROM public.ecos_scenarios ORDER BY id;

-- Step 6: Grant necessary permissions
ALTER TABLE public.ecos_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecos_sessions ENABLE ROW LEVEL SECURITY;  
ALTER TABLE public.ecos_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecos_evaluations ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies for authenticated users
CREATE POLICY "Allow authenticated users to read scenarios" ON public.ecos_scenarios
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert scenarios" ON public.ecos_scenarios
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update scenarios" ON public.ecos_scenarios
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read sessions" ON public.ecos_sessions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read messages" ON public.ecos_messages
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read evaluations" ON public.ecos_evaluations
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Final verification
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