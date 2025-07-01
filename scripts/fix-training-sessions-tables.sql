
-- Script de correction pour créer les tables manquantes des sessions de formation

-- Supprimer les tables si elles existent déjà (pour éviter les conflits)
DROP TABLE IF EXISTS training_session_participants CASCADE;
DROP TABLE IF EXISTS training_session_students CASCADE;
DROP TABLE IF EXISTS training_session_scenarios CASCADE;
DROP TABLE IF EXISTS training_sessions CASCADE;

-- Créer la table training_sessions
CREATE TABLE training_sessions (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Créer la table training_session_scenarios (relation many-to-many entre sessions et scénarios)
CREATE TABLE training_session_scenarios (
    id SERIAL PRIMARY KEY,
    training_session_id INTEGER REFERENCES training_sessions(id) ON DELETE CASCADE NOT NULL,
    scenario_id INTEGER REFERENCES ecos_scenarios(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Créer la table training_session_students (étudiants assignés à une session)
CREATE TABLE training_session_students (
    id SERIAL PRIMARY KEY,
    training_session_id INTEGER REFERENCES training_sessions(id) ON DELETE CASCADE NOT NULL,
    student_email VARCHAR(255) NOT NULL,
    assigned_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Créer les index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_training_sessions_created_by ON training_sessions(created_by);
CREATE INDEX IF NOT EXISTS idx_training_sessions_dates ON training_sessions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_training_session_scenarios_session_id ON training_session_scenarios(training_session_id);
CREATE INDEX IF NOT EXISTS idx_training_session_scenarios_scenario_id ON training_session_scenarios(scenario_id);
CREATE INDEX IF NOT EXISTS idx_training_session_students_session_id ON training_session_students(training_session_id);
CREATE INDEX IF NOT EXISTS idx_training_session_students_email ON training_session_students(student_email);

-- Vérification des tables créées
SELECT 'Tables de sessions de formation créées avec succès' as status;

-- Lister toutes les tables créées
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'training%'
ORDER BY table_name;
