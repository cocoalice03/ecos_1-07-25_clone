
-- Script pour créer toutes les tables de la base de données

-- Drop existing tables if they exist (in correct order due to foreign keys)
DROP TABLE IF EXISTS training_session_participants CASCADE;
DROP TABLE IF EXISTS training_session_scenarios CASCADE;
DROP TABLE IF EXISTS training_sessions CASCADE;
DROP TABLE IF EXISTS ecos_reports CASCADE;
DROP TABLE IF EXISTS ecos_messages CASCADE;
DROP TABLE IF EXISTS ecos_evaluations CASCADE;
DROP TABLE IF EXISTS ecos_sessions CASCADE;
DROP TABLE IF EXISTS ecos_scenarios CASCADE;
DROP TABLE IF EXISTS daily_counters CASCADE;
DROP TABLE IF EXISTS exchanges CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create sessions table (required for Replit Auth)
CREATE TABLE sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMP NOT NULL
);

CREATE INDEX IDX_session_expire ON sessions(expire);

-- Create users table (required for Replit Auth)
CREATE TABLE users (
  id VARCHAR PRIMARY KEY NOT NULL,
  email VARCHAR UNIQUE,
  first_name VARCHAR,
  last_name VARCHAR,
  profile_image_url VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create exchanges table
CREATE TABLE exchanges (
  id_exchange SERIAL PRIMARY KEY,
  utilisateur_email TEXT NOT NULL,
  question TEXT NOT NULL,
  reponse TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create daily_counters table
CREATE TABLE daily_counters (
  utilisateur_email TEXT NOT NULL,
  date TIMESTAMP NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

-- Create ecos_scenarios table
CREATE TABLE ecos_scenarios (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  patient_prompt TEXT NOT NULL,
  evaluation_criteria JSONB NOT NULL,
  pinecone_index VARCHAR(255),
  image_url VARCHAR(500),
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create training_sessions table
CREATE TABLE training_sessions (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create ecos_sessions table
CREATE TABLE ecos_sessions (
  id SERIAL PRIMARY KEY,
  scenario_id INTEGER REFERENCES ecos_scenarios(id),
  student_email VARCHAR(255) NOT NULL,
  training_session_id INTEGER REFERENCES training_sessions(id),
  start_time TIMESTAMP DEFAULT NOW(),
  end_time TIMESTAMP,
  status VARCHAR(50) DEFAULT 'in_progress'
);

-- Create ecos_evaluations table
CREATE TABLE ecos_evaluations (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES ecos_sessions(id),
  criterion_id VARCHAR(50) NOT NULL,
  score INTEGER NOT NULL,
  feedback TEXT
);

-- Create ecos_reports table
CREATE TABLE ecos_reports (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES ecos_sessions(id),
  summary TEXT NOT NULL,
  strengths TEXT[],
  weaknesses TEXT[],
  recommendations TEXT[]
);

-- Create ecos_messages table
CREATE TABLE ecos_messages (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES ecos_sessions(id),
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Create training_session_scenarios table
CREATE TABLE training_session_scenarios (
  id SERIAL PRIMARY KEY,
  training_session_id INTEGER REFERENCES training_sessions(id),
  scenario_id INTEGER REFERENCES ecos_scenarios(id)
);

-- Create training_session_participants table
CREATE TABLE training_session_participants (
  id SERIAL PRIMARY KEY,
  training_session_id INTEGER REFERENCES training_sessions(id),
  student_email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_exchanges_email ON exchanges(utilisateur_email);
CREATE INDEX idx_exchanges_timestamp ON exchanges(timestamp);
CREATE INDEX idx_daily_counters_email_date ON daily_counters(utilisateur_email, date);
CREATE INDEX idx_ecos_sessions_student ON ecos_sessions(student_email);
CREATE INDEX idx_ecos_sessions_scenario ON ecos_sessions(scenario_id);
CREATE INDEX idx_ecos_sessions_status ON ecos_sessions(status);
CREATE INDEX idx_ecos_evaluations_session ON ecos_evaluations(session_id);
CREATE INDEX idx_ecos_messages_session ON ecos_messages(session_id);
CREATE INDEX idx_training_session_scenarios_training ON training_session_scenarios(training_session_id);
CREATE INDEX idx_training_session_scenarios_scenario ON training_session_scenarios(scenario_id);
CREATE INDEX idx_training_session_participants_training ON training_session_participants(training_session_id);

SELECT 'Tables créées avec succès' as status;
