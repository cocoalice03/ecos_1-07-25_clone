
-- Migration pour ajouter la colonne image_url à la table ecos_scenarios
ALTER TABLE ecos_scenarios 
ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
