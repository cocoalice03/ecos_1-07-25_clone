-- =================================================================
-- SCRIPT COMPLET DE RESET ET RECREATION DE LA BASE DE DONNEES ECOS
-- =================================================================
-- Ce script recrée toute la structure de la base de données ECOS
-- avec les 5 scénarios et la gestion des utilisateurs par email

-- =================================================================
-- 1. SUPPRESSION DES TABLES EXISTANTES (dans l'ordre des dépendances)
-- =================================================================

-- Supprimer les tables dépendantes en premier
DROP TABLE IF EXISTS public.training_session_students CASCADE;
DROP TABLE IF EXISTS public.training_sessions CASCADE;
DROP TABLE IF EXISTS public.evaluations CASCADE;
DROP TABLE IF EXISTS public.exchanges CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;
DROP TABLE IF EXISTS public.scenarios CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- =================================================================
-- 2. CREATION DE LA TABLE USERS (BASE)
-- =================================================================

CREATE TABLE public.users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les recherches par email
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_role ON public.users(role);

-- =================================================================
-- 3. CREATION DE LA TABLE SCENARIOS
-- =================================================================

CREATE TABLE public.scenarios (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    patient_prompt TEXT,
    evaluation_criteria JSONB,
    pinecone_index VARCHAR(255),
    image_url VARCHAR(500),
    created_by VARCHAR(255) REFERENCES public.users(email),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les recherches
CREATE INDEX idx_scenarios_created_by ON public.scenarios(created_by);
CREATE INDEX idx_scenarios_created_at ON public.scenarios(created_at);

-- =================================================================
-- 4. CREATION DE LA TABLE SESSIONS (SESSIONS ECOS)
-- =================================================================

CREATE TABLE public.sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    student_email VARCHAR(255) NOT NULL REFERENCES public.users(email),
    scenario_id INTEGER REFERENCES public.scenarios(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les recherches
CREATE INDEX idx_sessions_student_email ON public.sessions(student_email);
CREATE INDEX idx_sessions_scenario_id ON public.sessions(scenario_id);
CREATE INDEX idx_sessions_status ON public.sessions(status);
CREATE INDEX idx_sessions_session_id ON public.sessions(session_id);

-- =================================================================
-- 5. CREATION DE LA TABLE EXCHANGES (MESSAGES DE CHAT)
-- =================================================================

CREATE TABLE public.exchanges (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES public.sessions(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    response TEXT NOT NULL,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'assistant', 'system')),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB
);

-- Index pour les recherches
CREATE INDEX idx_exchanges_session_id ON public.exchanges(session_id);
CREATE INDEX idx_exchanges_timestamp ON public.exchanges(timestamp);

-- =================================================================
-- 6. CREATION DE LA TABLE EVALUATIONS
-- =================================================================

CREATE TABLE public.evaluations (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES public.sessions(id) ON DELETE CASCADE,
    scenario_id INTEGER REFERENCES public.scenarios(id) ON DELETE CASCADE,
    student_email VARCHAR(255) NOT NULL REFERENCES public.users(email),
    scores JSONB,
    feedback TEXT,
    strengths TEXT[],
    weaknesses TEXT[],
    recommendations TEXT[],
    global_score INTEGER DEFAULT 0,
    evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les recherches
CREATE INDEX idx_evaluations_session_id ON public.evaluations(session_id);
CREATE INDEX idx_evaluations_student_email ON public.evaluations(student_email);
CREATE INDEX idx_evaluations_scenario_id ON public.evaluations(scenario_id);

-- =================================================================
-- 7. CREATION DE LA TABLE TRAINING_SESSIONS (SESSIONS DE FORMATION)
-- =================================================================

CREATE TABLE public.training_sessions (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_by VARCHAR(255) NOT NULL REFERENCES public.users(email),
    scenario_ids INTEGER[] DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les recherches
CREATE INDEX idx_training_sessions_created_by ON public.training_sessions(created_by);
CREATE INDEX idx_training_sessions_status ON public.training_sessions(status);

-- =================================================================
-- 8. CREATION DE LA TABLE TRAINING_SESSION_STUDENTS (ASSIGNATIONS)
-- =================================================================

CREATE TABLE public.training_session_students (
    id SERIAL PRIMARY KEY,
    training_session_id INTEGER REFERENCES public.training_sessions(id) ON DELETE CASCADE,
    student_email VARCHAR(255) NOT NULL REFERENCES public.users(email),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'assigned' CHECK (status IN ('assigned', 'started', 'completed')),
    UNIQUE(training_session_id, student_email)
);

-- Index pour les recherches
CREATE INDEX idx_training_session_students_session_id ON public.training_session_students(training_session_id);
CREATE INDEX idx_training_session_students_student_email ON public.training_session_students(student_email);

-- =================================================================
-- 9. INSERTION DES UTILISATEURS ADMINISTRATEURS
-- =================================================================

INSERT INTO public.users (email, name, role, is_admin) VALUES
('cherubindavid@gmail.com', 'David Cherub', 'admin', true),
('colombemadoungou@gmail.com', 'Colombe Madoungou', 'admin', true),
('system', 'Système ECOS', 'admin', true)
ON CONFLICT (email) DO UPDATE SET 
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    is_admin = EXCLUDED.is_admin,
    updated_at = NOW();

-- =================================================================
-- 10. INSERTION DES 5 SCENARIOS MEDICAUX ECOS
-- =================================================================

INSERT INTO public.scenarios (
    id, 
    title, 
    description, 
    patient_prompt, 
    evaluation_criteria, 
    created_by, 
    created_at
) VALUES 
(
    1,
    'Examen d''un patient avec douleur à l''épaule',
    'Le patient présente une douleur à l''épaule droite depuis 2 semaines après une chute',
    'Je suis un homme de 45 ans qui a chuté de vélo il y a 2 semaines. Depuis, j''ai une douleur constante à l''épaule droite qui s''aggrave quand je lève le bras.',
    '{
        "anamnese": [
            "Mécanisme de la chute",
            "Localisation précise de la douleur",
            "Facteurs aggravants/soulageants"
        ],
        "examenClinique": [
            "Inspection",
            "Palpation",
            "Tests de mobilité",
            "Tests spécifiques de l''épaule"
        ]
    }',
    'system',
    '2025-07-22T15:10:18.096702'
),
(
    2,
    'Consultation pour lombalgie aiguë',
    'Patient se présentant avec une lombalgie aiguë apparue brutalement',
    'J''ai 35 ans et j''ai ressenti une douleur intense dans le bas du dos ce matin en soulevant une boîte. La douleur irradie parfois dans ma jambe gauche.',
    '{
        "anamnese": [
            "Circonstances de survenue",
            "Irradiation",
            "Antécédents de lombalgie"
        ],
        "examenClinique": [
            "Test de Lasègue",
            "Examen neurologique",
            "Palpation vertébrale"
        ]
    }',
    'system',
    '2025-07-22T15:10:18.618385'
),
(
    3,
    'Urgence: Douleur thoracique',
    'Patient aux urgences avec douleur thoracique à évaluer',
    'J''ai 58 ans et je ressens une douleur oppressante dans la poitrine depuis 30 minutes. Je suis essoufflé et j''ai des sueurs froides.',
    '{
        "urgence": [
            "Signes vitaux",
            "ECG",
            "Troponines"
        ],
        "anamnese": [
            "Facteurs de risque cardiovasculaire",
            "Caractéristiques de la douleur"
        ],
        "examenClinique": [
            "Auscultation cardiaque",
            "Examen pulmonaire"
        ]
    }',
    'system',
    '2025-07-22T15:10:19.147167'
),
(
    4,
    'Gestion d''une crise de frustration chez un patient atteint de troubles schizophréniques en hospitalisation libre',
    'L''étudiant infirmier en S3 se trouve en service de soins psychiatriques lors du tour du matin. Il est interpellé par M. Bernard, 35 ans, hospitalisé en secteur libre pour des troubles schizophréniques. Le patient est en fin de première semaine d''hospitalisation, frustré de ne pas encore avoir accès à son téléphone, bien qu''on lui ait annoncé cette possibilité après 7 jours.

Le patient monte progressivement en tension, verbalement insistant, reprochant à l''équipe de ne pas respecter les engagements. Il souhaite appeler sa compagne pour son anniversaire. L''étudiant doit gérer cette montée en pression sans recours à l''isolement, par la communication thérapeutique et l''écoute active, tout en gardant une posture professionnelle.',
    'On m''a dit que je pourrais avoir mon téléphone aujourd''hui ! C''est l''anniversaire de ma copine, et vous m''empêchez de l''appeler ! Vous aviez dit une semaine, ça fait une semaine ! Je veux voir un autre soignant, vous m''écoutez même pas !',
    '{
        "evaluation_criteria": [
            {
                "label": "Identification de l''élément déclencheur",
                "weight": 10,
                "description": "L''étudiant comprend que la frustration du patient est liée à l''absence d''accès au téléphone."
            },
            {
                "label": "Utilisation des attitudes de Porter",
                "weight": 20,
                "description": "L''étudiant utilise au moins 4 attitudes de la relation d''aide (écoute, reformulation, empathie, etc.)."
            },
            {
                "label": "Proposition d''un cadre sécurisant",
                "weight": 15,
                "description": "L''étudiant propose de discuter dans une pièce calme, hors du couloir, avec la présence d''un binôme."
            },
            {
                "label": "Gestion émotionnelle",
                "weight": 15,
                "description": "L''étudiant maintient une posture calme, ne se laisse pas envahir par le stress ou l''agitation du patient."
            },
            {
                "label": "Communication thérapeutique",
                "weight": 20,
                "description": "Le discours est adapté, rassurant, non culpabilisant, permettant une désescalade verbale."
            },
            {
                "label": "Respect du cadre institutionnel",
                "weight": 10,
                "description": "L''étudiant rappelle avec bienveillance les règles fixées à l''entrée (cadre de soins, durée de privation)."
            },
            {
                "label": "Collaboration avec l''équipe",
                "weight": 10,
                "description": "Demande d''assistance ou anticipation de relais avec un binôme ou le psychiatre."
            }
        ]
    }',
    'colombemadoungou@gmail.com',
    '2025-07-23T11:14:29.389913'
),
(
    5,
    'Détection précoce d''un état de choc chez une personne âgée en service de médecine interne',
    'L''étudiant infirmier de S5 effectue le tour de soins de midi dans le service de médecine interne. Il entre dans la chambre de M. Morel, 79 ans, diabétique non insulinodépendant, en léger surpoids, vivant en résidence autonomie. Le patient exprime un malaise général.

Les paramètres vitaux montrent une altération inquiétante : température à 39,6°C, fréquence cardiaque à 135 bpm, tension artérielle systolique basse (120/60 mmHg), fréquence respiratoire élevée (35/min) et saturation à 87 %. Le patient est sous oxygène à 2 L/min par lunettes.

L''étudiant doit reconnaître les signes d''un état de choc infectieux, ajuster les soins infirmiers dans son rôle propre : augmentation de l''oxygénothérapie, installation en position demi-assise, mise en place d''un prélèvement ECBU, hémocultures, ECBC si expectoration, et alerte au médecin. L''évolution dépendra de la pertinence de ses décisions.',
    'Je me sens pas bien, j''ai chaud… j''ai du mal à respirer… Je suis fatigué…',
    '{
        "evaluation_criteria": [
            {
                "label": "Relevé et interprétation des constantes vitales",
                "weight": 15,
                "description": "L''étudiant prend les constantes et comprend leur gravité (tachycardie, hypotension, hypoxémie, hyperthermie)."
            },
            {
                "label": "Adaptation de l''oxygénothérapie",
                "weight": 20,
                "description": "L''étudiant augmente le débit et adapte le matériel selon la désaturation."
            },
            {
                "label": "Installation du patient",
                "weight": 10,
                "description": "L''étudiant met le patient en position demi-assise pour améliorer la ventilation."
            },
            {
                "label": "Initiative de prélèvements biologiques",
                "weight": 20,
                "description": "L''étudiant propose ECBU, hémocultures, et ECBC si toux productive."
            },
            {
                "label": "Communication adaptée avec le patient",
                "weight": 10,
                "description": "L''étudiant explique calmement la situation et rassure le patient."
            },
            {
                "label": "Alerte médicale",
                "weight": 15,
                "description": "L''étudiant informe rapidement le médecin ou l''équipe de garde."
            },
            {
                "label": "Respect du rôle infirmier",
                "weight": 10,
                "description": "L''étudiant reste dans le champ de ses compétences et n''initie pas d''acte médical non prescrit."
            }
        ]
    }',
    'colombemadoungou@gmail.com',
    '2025-07-23T11:18:50.25754'
)
ON CONFLICT (id) DO UPDATE SET 
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    patient_prompt = EXCLUDED.patient_prompt,
    evaluation_criteria = EXCLUDED.evaluation_criteria,
    created_by = EXCLUDED.created_by,
    updated_at = NOW();

-- =================================================================
-- 11. RESET DES SEQUENCES POUR LES IDS
-- =================================================================

-- Reset des séquences pour assurer la cohérence des IDs auto-incrémentés
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('scenarios_id_seq', (SELECT MAX(id) FROM scenarios));
SELECT setval('sessions_id_seq', COALESCE((SELECT MAX(id) FROM sessions), 1));
SELECT setval('exchanges_id_seq', COALESCE((SELECT MAX(id) FROM exchanges), 1));
SELECT setval('evaluations_id_seq', COALESCE((SELECT MAX(id) FROM evaluations), 1));
SELECT setval('training_sessions_id_seq', COALESCE((SELECT MAX(id) FROM training_sessions), 1));
SELECT setval('training_session_students_id_seq', COALESCE((SELECT MAX(id) FROM training_session_students), 1));

-- =================================================================
-- 12. VERIFICATION DES DONNEES INSEREES
-- =================================================================

-- Vérification des utilisateurs
SELECT 'USERS' as table_name, COUNT(*) as count FROM public.users
UNION ALL
SELECT 'SCENARIOS' as table_name, COUNT(*) as count FROM public.scenarios
UNION ALL
SELECT 'SESSIONS' as table_name, COUNT(*) as count FROM public.sessions
UNION ALL
SELECT 'EXCHANGES' as table_name, COUNT(*) as count FROM public.exchanges
UNION ALL
SELECT 'EVALUATIONS' as table_name, COUNT(*) as count FROM public.evaluations
UNION ALL
SELECT 'TRAINING_SESSIONS' as table_name, COUNT(*) as count FROM public.training_sessions
UNION ALL
SELECT 'TRAINING_SESSION_STUDENTS' as table_name, COUNT(*) as count FROM public.training_session_students;

-- Affichage des scénarios créés
SELECT 
    id,
    title,
    created_by,
    created_at
FROM public.scenarios 
ORDER BY id;

-- Affichage des utilisateurs administrateurs
SELECT 
    email,
    name,
    role,
    is_admin,
    created_at
FROM public.users 
WHERE is_admin = true
ORDER BY email;

-- =================================================================
-- 13. ACTIVATION DE RLS (ROW LEVEL SECURITY) - OPTIONNEL
-- =================================================================

-- Vous pouvez activer RLS pour sécuriser l'accès aux données
-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.exchanges ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.training_session_students ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- SCRIPT TERMINE - BASE DE DONNEES ECOS COMPLETEMENT RESETEE
-- =================================================================

-- Résumé de ce qui a été créé :
-- ✅ 7 tables avec structure complète et contraintes
-- ✅ 3 utilisateurs administrateurs
-- ✅ 5 scénarios médicaux ECOS complets
-- ✅ Index pour optimiser les performances
-- ✅ Contraintes de référence et validation
-- ✅ Séquences réinitialisées correctement

COMMIT;