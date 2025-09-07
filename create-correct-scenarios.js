import { createClient } from '@supabase/supabase-js';

async function createCorrectScenarios() {
  console.log('🔧 Creating CORRECT test scenarios in Supabase...');
  
  // Convert PostgreSQL URL to Supabase HTTP URL if needed
  let supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (supabaseUrl && supabaseUrl.startsWith('postgresql://')) {
    const match = supabaseUrl.match(/db\.([^.]+)\.supabase\.co/);
    if (match) {
      const projectId = match[1];
      supabaseUrl = `https://${projectId}.supabase.co`;
    }
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    console.log('✅ Connected to Supabase');
    
    // NOTE: Suppression du scénario urologique hardcodé (ID 1) - uniquement scénarios légitimes
    const correctScenarios = [
      {
        id: 4,
        title: "Urgence psychiatrique - Episode psychotique",
        description: "Patient de 28 ans amené par sa famille pour troubles du comportement et épisode psychotique",
        patient_prompt: `Tu es un jeune homme de 28 ans en plein épisode psychotique. Tu as été amené à l'hôpital par ta famille car ton comportement les inquiète. Tu as les caractéristiques suivantes:

SYMPTÔMES ACTUELS:
- Tu entends des voix qui te parlent et te donnent parfois des ordres
- Tu es convaincu que des gens te surveillent et complotent contre toi
- Tu as des idées de grandeur - tu penses avoir des pouvoirs spéciaux
- Tu n'as pas dormi depuis 3 jours car "ils" pourraient t'attaquer
- Tu es très méfiant envers le personnel médical
- Tu as arrêté de manger normalement car tu penses qu'on empoisonne ta nourriture

CONTEXTE MÉDICAL:
- Tu es hospitalisé en psychiatrie pour un épisode schizophrénique décompensé
- Ce n'est pas ton premier épisode - tu as déjà été hospitalisé il y a 2 ans
- Tu avais arrêté ton traitement antipsychotique il y a 6 mois
- Tu n'as AUCUN problème digestif, d'estomac ou abdominal

COMPORTEMENT AVEC LE PERSONNEL:
- Tu es méfiant mais pas forcément agressif
- Tu peux être coopératif si on te rassure
- Tu confirmes tes hallucinations auditives si on te pose des questions précises
- Tu parles de tes idées délirantes de persécution
- Tu nie catégoriquement avoir des douleurs au ventre ou des problèmes digestifs
- Tu expliques que tu es ici pour "tes voix" et tes "problèmes dans la tête"

PHRASES TYPIQUES:
- "Ils me surveillent, vous aussi peut-être..."
- "Les voix me disent de ne pas faire confiance"
- "J'ai des pouvoirs que vous ne comprenez pas"
- "Mon ventre ? Non, ça va très bien, c'est dans ma tête le problème"
- "Ma famille s'inquiète mais moi je sais la vérité"

IMPORTANT: Ne mentionne JAMAIS de douleurs abdominales, de problèmes d'estomac ou digestifs. Tu es hospitalisé uniquement pour tes troubles psychiatriques.`,
        evaluation_criteria: {
          evaluation_psychiatrique: {
            elements: [
              "Évaluation de l'état mental (contact, orientation)",
              "Recherche d'hallucinations (auditives, visuelles)",
              "Évaluation des idées délirantes",
              "Appréciation du risque suicidaire",
              "Évaluation de la dangerosité"
            ],
            poids: 35
          },
          anamnese: {
            elements: [
              "Histoire de la maladie actuelle",
              "Antécédents psychiatriques",
              "Traitements antérieurs et observance",
              "Consommation de substances",
              "Facteurs déclenchants"
            ],
            poids: 25
          },
          communication: {
            elements: [
              "Approche empathique et non jugeante",
              "Adaptation du discours au patient",
              "Gestion de la méfiance",
              "Réassurance appropriée"
            ],
            poids: 25
          },
          prise_en_charge: {
            elements: [
              "Évaluation de la nécessité d'hospitalisation",
              "Proposition thérapeutique adaptée",
              "Implication de la famille",
              "Suivi prévu"
            ],
            poids: 15
          }
        },
        image_url: null,
        created_by: "system"
      }
    ];
    
    // First, clear existing scenarios to avoid conflicts
    console.log('🧹 Clearing existing scenarios...');
    await supabase
      .from('scenarios')
      .delete()
      .neq('id', 0); // Delete all records
    
    for (const scenario of correctScenarios) {
      try {
        const { data, error } = await supabase
          .from('scenarios')
          .upsert({
            id: scenario.id,
            title: scenario.title,
            description: scenario.description,
            patient_prompt: scenario.patient_prompt,
            evaluation_criteria: scenario.evaluation_criteria,
            image_url: scenario.image_url,
            created_by: scenario.created_by,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (error) throw error;
        console.log(`✅ Created scenario: ${scenario.title} (ID: ${scenario.id})`);
      } catch (error) {
        console.error(`❌ Failed to create scenario "${scenario.title}":`, error.message);
      }
    }
    
    // Verify scenarios were created
    const { data: allScenarios, error } = await supabase
      .from('scenarios')
      .select('id, title, patient_prompt')
      .order('id', { ascending: true });
    
    if (error) throw error;
    
    console.log(`\n📋 Total scenarios in database: ${allScenarios?.length || 0}`);
    allScenarios?.forEach(s => {
      console.log(`  - ${s.title} (ID: ${s.id})`);
      console.log(`    Patient prompt length: ${s.patient_prompt ? s.patient_prompt.length : 0} characters`);
    });
    
    console.log('\n🎯 SCENARIOS CORRECTLY CONFIGURED:');
    console.log('- Scenario 4: Psychiatric episode (NO abdominal problems)'); 
    console.log('- Scenario uses the correct "scenarios" table');
    console.log('- Patient prompts are comprehensive and specific');
    console.log('- Scénario urologique hardcodé supprimé');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createCorrectScenarios().catch(console.error);
}

export { createCorrectScenarios };