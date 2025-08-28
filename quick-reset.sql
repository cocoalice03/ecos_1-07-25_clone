-- =================================================================
-- SCRIPT RAPIDE DE RESET DE LA BASE DE DONNEES ECOS
-- =================================================================
-- Version simplifiée pour l'éditeur SQL Supabase

-- Supprimer toutes les tables
DROP TABLE IF EXISTS public.training_session_students CASCADE;
DROP TABLE IF EXISTS public.training_sessions CASCADE;
DROP TABLE IF EXISTS public.evaluations CASCADE;
DROP TABLE IF EXISTS public.exchanges CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;
DROP TABLE IF EXISTS public.scenarios CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Créer table users
CREATE TABLE public.users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'student',
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Créer table scenarios  
CREATE TABLE public.scenarios (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    patient_prompt TEXT,
    evaluation_criteria JSONB,
    pinecone_index VARCHAR(255),
    image_url VARCHAR(500),
    created_by VARCHAR(255) REFERENCES public.users(email),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Créer table sessions
CREATE TABLE public.sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    student_email VARCHAR(255) NOT NULL REFERENCES public.users(email),
    scenario_id INTEGER REFERENCES public.scenarios(id),
    status VARCHAR(50) DEFAULT 'active',
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Créer table exchanges
CREATE TABLE public.exchanges (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES public.sessions(id),
    question TEXT NOT NULL,
    response TEXT NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Créer table evaluations
CREATE TABLE public.evaluations (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES public.sessions(id),
    scenario_id INTEGER REFERENCES public.scenarios(id),
    student_email VARCHAR(255) REFERENCES public.users(email),
    scores JSONB,
    feedback TEXT,
    strengths TEXT[],
    weaknesses TEXT[],
    recommendations TEXT[],
    global_score INTEGER DEFAULT 0,
    evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Créer tables training
CREATE TABLE public.training_sessions (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_by VARCHAR(255) REFERENCES public.users(email),
    scenario_ids INTEGER[] DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.training_session_students (
    id SERIAL PRIMARY KEY,
    training_session_id INTEGER REFERENCES public.training_sessions(id),
    student_email VARCHAR(255) REFERENCES public.users(email),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'assigned'
);

-- Insérer les administrateurs
INSERT INTO public.users (email, name, role, is_admin) VALUES
('cherubindavid@gmail.com', 'David Cherub', 'admin', true),
('colombemadoungou@gmail.com', 'Colombe Madoungou', 'admin', true),
('system', 'Système ECOS', 'admin', true);

-- Insérer les 5 scénarios
INSERT INTO public.scenarios (id, title, description, patient_prompt, evaluation_criteria, created_by) VALUES 
(1, 'Examen d''un patient avec douleur à l''épaule', 'Le patient présente une douleur à l''épaule droite depuis 2 semaines après une chute', 'Je suis un homme de 45 ans qui a chuté de vélo il y a 2 semaines. Depuis, j''ai une douleur constante à l''épaule droite qui s''aggrave quand je lève le bras.', '{"anamnese": ["Mécanisme de la chute", "Localisation précise de la douleur"], "examenClinique": ["Inspection", "Palpation", "Tests de mobilité"]}', 'system'),

(2, 'Consultation pour lombalgie aiguë', 'Patient se présentant avec une lombalgie aiguë apparue brutalement', 'J''ai 35 ans et j''ai ressenti une douleur intense dans le bas du dos ce matin en soulevant une boîte. La douleur irradie parfois dans ma jambe gauche.', '{"anamnese": ["Circonstances de survenue", "Irradiation"], "examenClinique": ["Test de Lasègue", "Examen neurologique"]}', 'system'),

(3, 'Urgence: Douleur thoracique', 'Patient aux urgences avec douleur thoracique à évaluer', 'J''ai 58 ans et je ressens une douleur oppressante dans la poitrine depuis 30 minutes. Je suis essoufflé et j''ai des sueurs froides.', '{"urgence": ["Signes vitaux", "ECG", "Troponines"], "anamnese": ["Facteurs de risque cardiovasculaire"], "examenClinique": ["Auscultation cardiaque"]}', 'system'),

(4, 'Gestion d''une crise de frustration chez un patient psychiatrique', 'Étudiant infirmier face à un patient schizophrène frustré de ne pas avoir accès à son téléphone', 'On m''a dit que je pourrais avoir mon téléphone aujourd''hui ! C''est l''anniversaire de ma copine, et vous m''empêchez de l''appeler !', '{"evaluation_criteria": [{"label": "Communication thérapeutique", "weight": 25}, {"label": "Gestion émotionnelle", "weight": 20}, {"label": "Respect du cadre", "weight": 15}]}', 'colombemadoungou@gmail.com'),

(5, 'Détection précoce d''un état de choc chez une personne âgée', 'Infirmier détectant un état de choc infectieux chez un patient diabétique de 79 ans', 'Je me sens pas bien, j''ai chaud… j''ai du mal à respirer… Je suis fatigué…', '{"evaluation_criteria": [{"label": "Interprétation des constantes vitales", "weight": 20}, {"label": "Adaptation de l''oxygénothérapie", "weight": 25}, {"label": "Alerte médicale", "weight": 20}]}', 'colombemadoungou@gmail.com');

-- Vérifier les résultats
SELECT 'Utilisateurs créés: ' || COUNT(*) FROM public.users;
SELECT 'Scénarios créés: ' || COUNT(*) FROM public.scenarios;