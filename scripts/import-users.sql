
-- Script pour importer les utilisateurs depuis le fichier JSON
-- Insertion des données utilisateur

INSERT INTO users (id, email, first_name, last_name, profile_image_url, created_at, updated_at)
VALUES 
  (
    'cherubindavid@gmail.com',
    'cherubindavid@gmail.com', 
    NULL,
    NULL,
    NULL,
    '2025-06-13T13:17:38.573Z'::timestamp,
    '2025-06-13T13:17:38.573Z'::timestamp
  )
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  profile_image_url = EXCLUDED.profile_image_url,
  updated_at = EXCLUDED.updated_at;

-- Vérification de l'insertion
SELECT * FROM users WHERE email = 'cherubindavid@gmail.com';

-- Affichage du nombre total d'utilisateurs
SELECT COUNT(*) as total_users FROM users;
