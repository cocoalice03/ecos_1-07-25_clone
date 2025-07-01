
-- Script pour insérer des scénarios ECOS de base
-- Insertion de scénarios médicaux pour les examens cliniques

INSERT INTO ecos_scenarios (title, description, patient_prompt, evaluation_criteria, created_by, created_at)
VALUES 
  (
    'Consultation d''urgence - Douleur thoracique',
    'Patient de 55 ans consultant aux urgences pour une douleur thoracique aiguë. Évaluation de la prise en charge initiale.',
    'Tu es un homme de 55 ans qui arrives aux urgences avec une douleur thoracique qui a commencé il y a 2 heures. La douleur est intense, située au centre de la poitrine, et irradie vers le bras gauche. Tu es inquiet car ton père a fait un infarctus à 60 ans. Tu ressens aussi une légère nausée et transpires un peu. Réponds aux questions de l''étudiant en médecine de manière réaliste, en exprimant tes préoccupations de patient.',
    '{"anamnese": 25, "examen_physique": 20, "raisonnement_clinique": 30, "communication": 15, "gestion_urgence": 10}',
    'cherubindavid@gmail.com',
    NOW()
  ),
  (
    'Examen de l''épaule douloureuse',
    'Patient consultant pour des douleurs d''épaule chroniques. Focus sur l''examen clinique spécialisé.',
    'Tu es un patient de 45 ans, employé de bureau, qui consulte pour des douleurs à l''épaule droite depuis 3 mois. La douleur s''aggrave la nuit et quand tu lèves le bras. Tu as essayé des anti-inflammatoires sans grand succès. Tu t''inquiètes car cela t''empêche de faire du sport (tennis) et commence à gêner ton travail sur ordinateur.',
    '{"anamnese": 20, "examen_physique": 35, "raisonnement_clinique": 25, "communication": 15, "diagnostic_differentiel": 5}',
    'cherubindavid@gmail.com',
    NOW()
  ),
  (
    'Traumatisme du poignet',
    'Patient jeune avec traumatisme du poignet suite à une chute. Évaluation de la prise en charge traumatologique.',
    'Tu es un étudiant de 20 ans qui vient de faire une chute en skateboard il y a 1 heure. Tu es tombé sur les mains pour amortir la chute et maintenant tu as très mal au poignet droit. Tu arrives à bouger les doigts mais le poignet est gonflé et douloureux. Tu es inquiet car tu as des examens importants la semaine prochaine et tu dois pouvoir écrire.',
    '{"anamnese": 20, "examen_physique": 30, "imagerie": 15, "raisonnement_clinique": 25, "communication": 10}',
    'cherubindavid@gmail.com',
    NOW()
  ),
  (
    'Arthrose de la main',
    'Patient âgé consultant pour des douleurs articulaires des mains. Approche de la pathologie dégénérative.',
    'Tu es une femme de 68 ans, retraitée, qui consulte pour des douleurs aux mains qui s''aggravent depuis 6 mois. Les douleurs sont surtout présentes le matin au réveil et quand tu fais des activités comme ouvrir des bocaux ou tricoter. Tu remarques que tes doigts se déforment un peu et tu t''inquiètes pour ton autonomie future.',
    '{"anamnese": 25, "examen_physique": 30, "raisonnement_clinique": 25, "communication": 15, "conseil_therapeutique": 5}',
    'cherubindavid@gmail.com',
    NOW()
  ),
  (
    'Syndrome du canal carpien',
    'Patient avec paresthésies nocturnes de la main. Diagnostic et prise en charge du syndrome canalaire.',
    'Tu es une femme de 42 ans, caissière dans un supermarché, qui consulte pour des fourmillements dans la main droite, surtout la nuit. Cela te réveille parfois et tu dois secouer la main pour que ça passe. Pendant la journée au travail, tu ressens parfois des engourdissements. Tu t''inquiètes car cela commence à affecter ton travail et ton sommeil.',
    '{"anamnese": 25, "examen_physique": 25, "tests_specifiques": 20, "raisonnement_clinique": 20, "communication": 10}',
    'cherubindavid@gmail.com',
    NOW()
  )
ON CONFLICT DO NOTHING;

-- Vérification de l'insertion
SELECT COUNT(*) as scenarios_ajoutes FROM ecos_scenarios;
SELECT id, title, created_by FROM ecos_scenarios ORDER BY created_at;
