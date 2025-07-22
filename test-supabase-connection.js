
import { robustSupabaseService } from './server/services/robust-supabase.service.js';
import { alternativeSupabaseService } from './server/services/alternative-supabase.service.js';
import { directSupabaseService } from './server/services/direct-supabase.service.js';

async function testAllConnections() {
  console.log('🔧 Test complet de toutes les méthodes de connexion Supabase...\n');
  
  const services = [
    { name: 'Robust Supabase', service: robustSupabaseService },
    { name: 'Alternative Supabase', service: alternativeSupabaseService },
    { name: 'Direct Supabase', service: directSupabaseService }
  ];
  
  for (const { name, service } of services) {
    try {
      console.log(`\n📡 Testing ${name}...`);
      await service.testConnection();
      console.log(`✅ ${name} - Connexion réussie!`);
      
      // Test de récupération des scénarios
      const scenarios = await service.getScenarios();
      console.log(`✅ ${name} - ${scenarios.length} scénarios récupérés`);
      
      return { success: true, service: name, scenarios };
    } catch (error) {
      console.log(`❌ ${name} - Échec:`, error.message);
    }
  }
  
  console.log('\n❌ Toutes les méthodes de connexion ont échoué');
  return { success: false };
}

testAllConnections()
  .then(result => {
    if (result.success) {
      console.log(`\n🎉 Succès avec ${result.service}!`);
    } else {
      console.log('\n💡 Suggestions de dépannage:');
      console.log('1. Vérifiez votre connexion Internet');
      console.log('2. Vérifiez les credentials Supabase');
      console.log('3. Contactez le support Supabase si le problème persiste');
    }
  })
  .catch(error => {
    console.error('Erreur lors du test:', error);
  });
