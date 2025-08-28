-- Script d'initialisation pour la nouvelle base de données bgrxjdcpxgdunanwtpvv
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Création des utilisateurs administrateurs
INSERT INTO public.users (email, name, role, is_admin) VALUES
('cherubindavid@gmail.com', 'David Cherub', 'admin', true),
('colombemadoungou@gmail.com', 'Colombe Madoungou', 'admin', true),
('system', 'Système ECOS', 'admin', true)
ON CONFLICT (email) DO UPDATE SET 
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    is_admin = EXCLUDED.is_admin,
    updated_at = NOW();

-- 2. Insertion des 5 scénarios ECOS
INSERT INTO public.scenarios (
    id, 
    title, 
    description, 
    patient_prompt, 
    evaluation_criteria, 
    created_by
) VALUES 
(
    1,
    'Examen d''un patient avec douleur à l''épaule',
    'Le patient présente une douleur à l''épaule droite depuis 2 semaines après une chute',
    'Je suis un homme de 45 ans qui a chuté de vélo il y a 2 semaines. Depuis, j''ai une douleur constante à l''épaule droite qui s''aggrave quand je lève le bras.',
    '{"anamnese": ["Mécanisme de la chute", "Localisation précise de la douleur", "Facteurs aggravants/soulageants"], "examenClinique": ["Inspection", "Palpation", "Tests de mobilité", "Tests spécifiques de l''épaule"]}',
    'system'
),
(
    2,
    'Consultation pour lombalgie aiguë',
    'Patient se présentant avec une lombalgie aiguë apparue brutalement',
    'J''ai 35 ans et j''ai ressenti une douleur intense dans le bas du dos ce matin en soulevant une boîte. La douleur irradie parfois dans ma jambe gauche.',
    '{"anamnese": ["Circonstances de survenue", "Irradiation", "Antécédents de lombalgie"], "examenClinique": ["Test de Lasègue", "Examen neurologique", "Palpation vertébrale"]}',
    'system'
),
(
    3,
    'Urgence: Douleur thoracique',
    'Patient aux urgences avec douleur thoracique à évaluer',
    'J''ai 58 ans et je ressens une douleur oppressante dans la poitrine depuis 30 minutes. Je suis essoufflé et j''ai des sueurs froides.',
    '{"urgence": ["Signes vitaux", "ECG", "Troponines"], "anamnese": ["Facteurs de risque cardiovasculaire", "Caractéristiques de la douleur"], "examenClinique": ["Auscultation cardiaque", "Examen pulmonaire"]}',
    'system'
),
(
    4,
    'Gestion d''une crise de frustration chez un patient atteint de troubles schizophréniques en hospitalisation libre',
    'L''étudiant infirmier en S3 se trouve en service de soins psychiatriques lors du tour du matin. Il est interpellé par M. Bernard, 35 ans, hospitalisé en secteur libre pour des troubles schizophréniques. Le patient est en fin de première semaine d''hospitalisation, frustré de ne pas encore avoir accès à son téléphone, bien qu''on lui ait annoncé cette possibilité après 7 jours.',
    'On m''a dit que je pourrais avoir mon téléphone aujourd''hui ! C''est l''anniversaire de ma copine, et vous m''empêchez de l''appeler ! Vous aviez dit une semaine, ça fait une semaine ! Je veux voir un autre soignant, vous m''écoutez même pas !',
    '{"evaluation_criteria": [{"label": "Identification de l''élément déclencheur", "weight": 10, "description": "L''étudiant comprend que la frustration du patient est liée à l''absence d''accès au téléphone."}, {"label": "Utilisation des attitudes de Porter", "weight": 20, "description": "L''étudiant utilise au moins 4 attitudes de la relation d''aide (écoute, reformulation, empathie, etc.)."}, {"label": "Communication thérapeutique", "weight": 20, "description": "Le discours est adapté, rassurant, non culpabilisant, permettant une désescalade verbale."}, {"label": "Gestion émotionnelle", "weight": 15, "description": "L''étudiant maintient une posture calme, ne se laisse pas envahir par le stress ou l''agitation du patient."}, {"label": "Respect du cadre institutionnel", "weight": 10, "description": "L''étudiant rappelle avec bienveillance les règles fixées à l''entrée."}]}',
    'colombemadoungou@gmail.com'
),
(
    5,
    'Détection précoce d''un état de choc chez une personne âgée en service de médecine interne',
    'L''étudiant infirmier de S5 effectue le tour de soins de midi dans le service de médecine interne. Il entre dans la chambre de M. Morel, 79 ans, diabétique non insulinodépendant, en léger surpoids, vivant en résidence autonomie. Le patient exprime un malaise général.',
    'Je me sens pas bien, j''ai chaud… j''ai du mal à respirer… Je suis fatigué…',
    '{"evaluation_criteria": [{"label": "Relevé et interprétation des constantes vitales", "weight": 15, "description": "L''étudiant prend les constantes et comprend leur gravité (tachycardie, hypotension, hypoxémie, hyperthermie)."}, {"label": "Adaptation de l''oxygénothérapie", "weight": 20, "description": "L''étudiant augmente le débit et adapte le matériel selon la désaturation."}, {"label": "Initiative de prélèvements biologiques", "weight": 20, "description": "L''étudiant propose ECBU, hémocultures, et ECBC si toux productive."}, {"label": "Communication adaptée avec le patient", "weight": 10, "description": "L''étudiant explique calmement la situation et rassure le patient."}, {"label": "Alerte médicale", "weight": 15, "description": "L''étudiant informe rapidement le médecin ou l''équipe de garde."}]}',
    'colombemadoungou@gmail.com'
)
ON CONFLICT (id) DO UPDATE SET 
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    patient_prompt = EXCLUDED.patient_prompt,
    evaluation_criteria = EXCLUDED.evaluation_criteria,
    created_by = EXCLUDED.created_by,
    updated_at = NOW();

-- 3. Vérification des données
SELECT 'USERS' as table_name, COUNT(*) as count FROM public.users
UNION ALL
SELECT 'SCENARIOS' as table_name, COUNT(*) as count FROM public.scenarios;

-- 4. Affichage des scénarios créés
SELECT 
    id,
    title,
    created_by
FROM public.scenarios 
ORDER BY id;