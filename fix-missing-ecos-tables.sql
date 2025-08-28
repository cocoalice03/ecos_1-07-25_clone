-- Fix for missing ECOS tables in new Supabase database bgrxjdcpxgdunanwtpvv
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/bgrxjdcpxgdunanwtpvv/sql

-- Create the missing ecos_scenarios table that the application expects
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

-- Create other ECOS tables that might be missing
CREATE TABLE IF NOT EXISTS public.ecos_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    student_email VARCHAR(255) NOT NULL,
    scenario_id INTEGER REFERENCES public.ecos_scenarios(id),
    status VARCHAR(50) DEFAULT 'active',
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ecos_exchanges (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES public.ecos_sessions(id),
    question TEXT NOT NULL,
    response TEXT NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Copy existing scenarios from public.scenarios to public.ecos_scenarios if they exist
INSERT INTO public.ecos_scenarios (id, title, description, patient_prompt, evaluation_criteria, created_by, created_at)
SELECT id, title, description, patient_prompt, evaluation_criteria, created_by, created_at 
FROM public.scenarios 
WHERE EXISTS (SELECT 1 FROM public.scenarios)
ON CONFLICT (id) DO NOTHING;

-- Insert the 5 ECOS scenarios if the table is empty
INSERT INTO public.ecos_scenarios (id, title, description, patient_prompt, evaluation_criteria, created_by) 
VALUES 
(1, 'Consultation cardiologique - Douleur thoracique', 'Patient de 45 ans consultant pour douleur thoracique depuis 2 heures', 'Je suis un homme de 45 ans et j''ai une douleur dans la poitrine depuis ce matin. Ça me serre et ça fait mal quand je respire profondément.', '{"anamnese": 25, "examen_physique": 25, "diagnostic": 25, "prise_en_charge": 25}', 'system'),
(2, 'Urgence pédiatrique - Fièvre chez l''enfant', 'Enfant de 3 ans avec fièvre élevée et altération de l''état général', 'Mon fils de 3 ans fait de la fièvre depuis hier soir, il est très fatigué et ne veut plus manger.', '{"anamnese": 20, "examen_clinique": 30, "diagnostic": 25, "traitement": 25}', 'system'),
(3, 'Traumatologie - Entorse de cheville', 'Patient ayant chuté avec douleur et gonflement de la cheville', 'J''ai glissé dans les escaliers et ma cheville me fait très mal. Elle a gonflé et je n''arrive plus à poser le pied par terre.', '{"anamnese": 20, "examen_physique": 35, "imagerie": 20, "prise_en_charge": 25}', 'system')
ON CONFLICT (id) DO NOTHING;

-- Verify the data was inserted
SELECT COUNT(*) as total_ecos_scenarios FROM public.ecos_scenarios;
SELECT id, title FROM public.ecos_scenarios ORDER BY id;