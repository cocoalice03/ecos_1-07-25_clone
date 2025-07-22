
const requiredSecrets = [
  'DATABASE_URL',
  'SUPABASE_URL', 
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
  'PINECONE_API_KEY'
];

console.log('🔍 Vérification des Secrets Replit...\n');

let allSecretsPresent = true;

requiredSecrets.forEach(secret => {
  const value = process.env[secret];
  const isPresent = !!value;
  const icon = isPresent ? '✅' : '❌';
  
  console.log(`${icon} ${secret}: ${isPresent ? 'Présent' : 'MANQUANT'}`);
  
  if (isPresent && secret === 'DATABASE_URL') {
    // Extraire et vérifier le format de l'URL de base de données
    const urlMatch = value.match(/postgresql:\/\/postgres:([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (urlMatch) {
      const [, password, host, port, database] = urlMatch;
      console.log(`   📋 Host: ${host}`);
      console.log(`   📋 Port: ${port}`);
      console.log(`   📋 Database: ${database}`);
      console.log(`   📋 Password: ${password.substring(0, 3)}***`);
    } else {
      console.log('   ⚠️  Format d\'URL non reconnu');
    }
  }
  
  if (!isPresent) {
    allSecretsPresent = false;
  }
});

console.log(`\n${allSecretsPresent ? '🎉' : '⚠️'} ${allSecretsPresent ? 'Tous les Secrets sont configurés!' : 'Certains Secrets manquent'}`);

if (!allSecretsPresent) {
  console.log('\n📝 Pour configurer les Secrets:');
  console.log('1. Allez dans l\'onglet "Secrets" (🔐) dans le panneau de gauche');
  console.log('2. Cliquez sur "+ New Secret"');
  console.log('3. Ajoutez chaque Secret manquant avec sa valeur');
  console.log('4. Redémarrez l\'application après configuration');
}
