import { createClient } from '@supabase/supabase-js';

async function createTestScenarios() {
  console.log('🔧 Creating test scenarios in Supabase...');
  
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
    
    const testScenarios = [
      {
        title: "Examen d'un patient avec douleur à l'épaule",
        description: "Le patient présente une douleur à l'épaule droite depuis 2 semaines après une chute",
        patientPrompt: "Je suis un homme de 45 ans qui a chuté de vélo il y a 2 semaines. Depuis, j'ai une douleur constante à l'épaule droite qui s'aggrave quand je lève le bras.",
        evaluationCriteria: {
          anamnese: ["Mécanisme de la chute", "Localisation précise de la douleur", "Facteurs aggravants/soulageants"],
          examenClinique: ["Inspection", "Palpation", "Tests de mobilité", "Tests spécifiques de l'épaule"]
        },
        imageUrl: null,
        createdBy: "system"
      },
      {
        title: "Consultation pour lombalgie aiguë",
        description: "Patient se présentant avec une lombalgie aiguë apparue brutalement",
        patientPrompt: "J'ai 35 ans et j'ai ressenti une douleur intense dans le bas du dos ce matin en soulevant une boîte. La douleur irradie parfois dans ma jambe gauche.",
        evaluationCriteria: {
          anamnese: ["Circonstances de survenue", "Irradiation", "Antécédents de lombalgie"],
          examenClinique: ["Test de Lasègue", "Examen neurologique", "Palpation vertébrale"]
        },
        imageUrl: null,
        createdBy: "system"
      },
      {
        title: "Urgence: Douleur thoracique",
        description: "Patient aux urgences avec douleur thoracique à évaluer",
        patientPrompt: "J'ai 58 ans et je ressens une douleur oppressante dans la poitrine depuis 30 minutes. Je suis essoufflé et j'ai des sueurs froides.",
        evaluationCriteria: {
          urgence: ["Signes vitaux", "ECG", "Troponines"],
          anamnese: ["Facteurs de risque cardiovasculaire", "Caractéristiques de la douleur"],
          examenClinique: ["Auscultation cardiaque", "Examen pulmonaire"]
        },
        imageUrl: null,
        createdBy: "system"
      }
    ];
    
    for (const scenario of testScenarios) {
      try {
        const { data, error } = await supabase
          .from('ecos_scenarios')
          .insert({
            title: scenario.title,
            description: scenario.description,
            patient_prompt: scenario.patientPrompt,
            evaluation_criteria: scenario.evaluationCriteria,
            image_url: scenario.imageUrl,
            created_by: scenario.createdBy
          })
          .select()
          .single();
        
        if (error) throw error;
        console.log(`✅ Created scenario: ${scenario.title}`);
      } catch (error) {
        console.error(`❌ Failed to create scenario "${scenario.title}":`, error.message);
      }
    }
    
    // List all scenarios
    const { data: allScenarios, error } = await supabase
      .from('ecos_scenarios')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    console.log(`\n📋 Total scenarios in database: ${allScenarios?.length || 0}`);
    allScenarios?.forEach(s => {
      console.log(`  - ${s.title} (ID: ${s.id})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createTestScenarios().catch(console.error);