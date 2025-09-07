import { createClient } from '@supabase/supabase-js';

async function createTestScenarios() {
  console.log('❌ DEPRECATED: Test scenario creation with hardcoded medical content');
  console.log('⚠️ This script contained hardcoded medical scenarios and has been deprecated.');
  console.log('✅ Use create-correct-scenarios.js instead for legitimate scenarios.');
  console.log('📋 All scenarios should now be configured in database with specific evaluation criteria.');
  
  return;
  
  // REMOVED: Hardcoded medical test scenarios
  // - No more hardcoded symptoms (douleur épaule, lombalgie, etc.)
  // - No more hardcoded patient prompts
  // - No more hardcoded evaluation criteria
  // All content should come from database configuration
    
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