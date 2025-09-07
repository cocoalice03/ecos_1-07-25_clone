// Test script for the generate-criteria endpoint
// Tests both the new direct endpoint and verifies functionality

const testData = {
  email: 'colombemadoungou@gmail.com',
  description: 'L\'étudiant infirmier doit gérer une situation complexe selon les protocoles médicaux.',
  scenarioDescription: 'L\'étudiant infirmier doit gérer une situation complexe selon les protocoles médicaux.'
};

async function testGenerateCriteria() {
  console.log('🔧 Testing generate-criteria endpoint...\n');
  
  // Test the new direct endpoint
  try {
    console.log('📡 Testing direct generate-criteria endpoint...');
    
    const handler = await import('./api/generate-criteria.js');
    
    // Mock request and response objects
    const mockReq = {
      method: 'POST',
      body: testData
    };
    
    const mockRes = {
      statusCode: null,
      headers: {},
      responseData: null,
      setHeader: function(key, value) {
        this.headers[key] = value;
      },
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.responseData = data;
        return this;
      },
      end: function() {
        return this;
      }
    };
    
    await handler.default(mockReq, mockRes);
    
    console.log('📊 Response Status:', mockRes.statusCode);
    console.log('📄 Response Headers:', mockRes.headers);
    
    if (mockRes.statusCode === 200) {
      console.log('✅ Generate-criteria endpoint working correctly!');
      console.log('🎯 Generated criteria preview:');
      if (mockRes.responseData && mockRes.responseData.criteria) {
        const criteria = mockRes.responseData.criteria;
        if (criteria.evaluation_criteria && Array.isArray(criteria.evaluation_criteria)) {
          criteria.evaluation_criteria.forEach((criterion, index) => {
            console.log(`   ${index + 1}. ${criterion.name} (Weight: ${criterion.weight || 'N/A'})`);
          });
        }
      }
    } else {
      console.log('❌ Endpoint returned error:', mockRes.responseData);
    }
    
  } catch (error) {
    console.error('❌ Error testing generate-criteria:', error.message);
    
    // Check for missing environment variables
    if (error.message.includes('OPENAI_API_KEY')) {
      console.log('\n🔑 Please ensure OPENAI_API_KEY environment variable is set');
    }
  }
  
  console.log('\n' + '='.repeat(60));
}

async function testScenarioRetrieval() {
  console.log('🗄️ Testing scenario database retrieval...\n');
  
  try {
    const scenariosHandler = await import('./api/scenarios.js');
    
    const mockReq = {
      method: 'GET',
      url: '/api/scenarios'
    };
    
    const mockRes = {
      statusCode: null,
      headers: {},
      responseData: null,
      setHeader: function(key, value) {
        this.headers[key] = value;
      },
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.responseData = data;
        return this;
      },
      end: function() {
        return this;
      }
    };
    
    await scenariosHandler.default(mockReq, mockRes);
    
    console.log('📊 Scenarios Response Status:', mockRes.statusCode);
    
    if (mockRes.statusCode === 200 && mockRes.responseData) {
      const data = mockRes.responseData;
      console.log('✅ Scenarios retrieved successfully!');
      console.log(`📈 Found ${data.count || 0} scenarios`);
      console.log(`🔗 Connected: ${data.connected ? 'Yes' : 'No'}`);
      console.log(`📡 Source: ${data.source}`);
      
      if (data.scenarios && data.scenarios.length > 0) {
        console.log('\n📋 Available scenarios:');
        data.scenarios.forEach((scenario, index) => {
          console.log(`   ${index + 1}. ${scenario.title}`);
        });
      } else {
        console.log('⚠️ No scenarios found in database');
      }
    } else {
      console.log('❌ Scenario retrieval failed:', mockRes.responseData);
    }
    
  } catch (error) {
    console.error('❌ Error testing scenarios:', error.message);
  }
}

// Run tests
async function runTests() {
  console.log('🧪 ECOS Backend Functionality Tests');
  console.log('=' .repeat(60) + '\n');
  
  await testGenerateCriteria();
  await testScenarioRetrieval();
  
  console.log('\n✨ Test suite completed!');
  console.log('\nNext steps:');
  console.log('1. Deploy to Vercel: vercel --prod');
  console.log('2. Test in browser at /teacher page');
  console.log('3. Try modifying a scenario and generating criteria');
}

runTests().catch(console.error);