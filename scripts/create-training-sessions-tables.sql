
-- Create training_sessions table
CREATE TABLE IF NOT EXISTS training_sessions (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create training_session_scenarios table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS training_session_scenarios (
  id SERIAL PRIMARY KEY,
  training_session_id INTEGER REFERENCES training_sessions(id) ON DELETE CASCADE NOT NULL,
  scenario_id INTEGER REFERENCES ecos_scenarios(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create training_session_participants table
CREATE TABLE IF NOT EXISTS training_session_participants (
  id SERIAL PRIMARY KEY,
  training_session_id INTEGER REFERENCES training_sessions(id) ON DELETE CASCADE NOT NULL,
  student_email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_training_sessions_created_by ON training_sessions(created_by);
CREATE INDEX IF NOT EXISTS idx_training_sessions_dates ON training_sessions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_training_session_scenarios_session_id ON training_session_scenarios(training_session_id);
CREATE INDEX IF NOT EXISTS idx_training_session_scenarios_scenario_id ON training_session_scenarios(scenario_id);
CREATE INDEX IF NOT EXISTS idx_training_session_participants_session_id ON training_session_participants(training_session_id);
CREATE INDEX IF NOT EXISTS idx_training_session_participants_email ON training_session_participants(student_email);
