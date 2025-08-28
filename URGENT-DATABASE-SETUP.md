# URGENT: Database Setup Instructions

Your new Supabase database (`bgrxjdcpxgdunanwtpvv`) is missing the required tables. Here's how to fix it:

## 🚨 Critical Issue
- **API Status**: All teacher endpoints returning 500 errors
- **Frontend Status**: Shows "API returned 0 scenarios. Connected: No"
- **Root Cause**: New database has no tables

## 📋 Manual Setup Required

### Step 1: Access Supabase Dashboard
1. Go to: https://supabase.com/dashboard/project/bgrxjdcpxgdunanwtpvv
2. Navigate to **SQL Editor**

### Step 2: Run Table Creation SQL
Copy and paste this SQL into the SQL Editor and run it:

```sql
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
```

### Step 3: Insert Sample Data
After creating tables, run this to add sample scenarios:

```sql
INSERT INTO ecos_scenarios (title, description, patient_prompt, evaluation_criteria, created_by) VALUES
('Douleur thoracique aiguë', 
 'Patient présentant une douleur thoracique aiguë nécessitant une évaluation rapide',
 'Vous ressentez une douleur thoracique soudaine et intense qui irradie vers le bras gauche.',
 '{"anamnese": {"weight": 25, "description": "Qualité de l''anamnèse"}, "examen_clinique": {"weight": 25, "description": "Examen clinique complet"}, "diagnostic": {"weight": 30, "description": "Pertinence du diagnostic"}, "prise_en_charge": {"weight": 20, "description": "Plan de prise en charge"}}',
 'system'),
 
('Traumatisme du poignet',
 'Évaluation d''un traumatisme du poignet suite à une chute',
 'Vous avez chuté sur votre poignet gauche et ressentez une douleur intense avec impossibilité de bouger.',
 '{"anamnese": {"weight": 20, "description": "Recueil de l''histoire du traumatisme"}, "examen_clinique": {"weight": 30, "description": "Examen du poignet et tests spécifiques"}, "imagerie": {"weight": 25, "description": "Prescription d''examens complémentaires"}, "traitement": {"weight": 25, "description": "Plan thérapeutique"}}',
 'system'),
 
('Syndrome du canal carpien',
 'Diagnostic et prise en charge du syndrome du canal carpien',
 'Vous ressentez des fourmillements dans les trois premiers doigts de la main, surtout la nuit.',
 '{"anamnese": {"weight": 25, "description": "Histoire de la maladie et facteurs de risque"}, "examen_clinique": {"weight": 35, "description": "Tests spécifiques du canal carpien"}, "diagnostic": {"weight": 25, "description": "Diagnostic différentiel"}, "traitement": {"weight": 15, "description": "Options thérapeutiques"}}',
 'system');

SELECT COUNT(*) as scenario_count FROM ecos_scenarios;
```

## 🔍 Verification Steps

After running the SQL:

1. **Check Tables Created**:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' ORDER BY table_name;
   ```

2. **Check Sample Data**:
   ```sql
   SELECT id, title, created_by FROM ecos_scenarios;
   ```

3. **Test Server**:
   - Restart your development server
   - Visit: http://localhost:3000/health
   - Visit: http://localhost:3000/api/teacher/scenarios?email=cherubindavid@gmail.com

## 🚀 Expected Results

After setup:
- ✅ Health endpoint should show database: "healthy" 
- ✅ Teacher scenarios endpoint should return 3 scenarios
- ✅ Frontend should show "Connected: Yes" and display scenarios
- ✅ All 500 errors should be resolved

## 📊 Database Info
- **Project**: bgrxjdcpxgdunanwtpvv
- **Environment**: Development  
- **Connection**: Uses environment variables from `.env`
- **SSL**: Required (automatically configured)

## 🔧 Alternative: Command Line Setup
If you prefer to run from command line after manual table creation:

```bash
node fix-db-connection.js
```

This will verify the setup and insert sample data if tables exist.