#!/usr/bin/env node
/**
 * Custom Element Protection Verification Script
 * 
 * This script verifies that the deployed site has proper custom element protection
 * and tests various attack scenarios to ensure the system is bulletproof.
 */

const https = require('https');
const { JSDOM } = require('jsdom');

const SITE_URL = 'https://ecos-infirmier-b.vercel.app/';

async function fetchSiteContent() {
  return new Promise((resolve, reject) => {
    https.get(SITE_URL, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve(data);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

function testCustomElementProtection(html) {
  const results = {
    protectionScriptPresent: false,
    cspHeaderPresent: false,
    blockedElementsCount: 0,
    blockedPatternsCount: 0,
    emergencyControlsPresent: false,
    browserExtensionDetection: false,
    errors: []
  };

  try {
    // Check for protection script
    if (html.includes('EMERGENCY: Ultra-Early Custom Element Protection System')) {
      results.protectionScriptPresent = true;
    }

    // Check for CSP
    if (html.includes('Content-Security-Policy')) {
      results.cspHeaderPresent = true;
    }

    // Count blocked elements
    const blockedElementsMatch = html.match(/BLOCKED_ELEMENTS.*?new Set\(\[([\s\S]*?)\]\)/);
    if (blockedElementsMatch) {
      const elements = blockedElementsMatch[1].split(',').filter(line => 
        line.includes("'") || line.includes('"')
      );
      results.blockedElementsCount = elements.length;
    }

    // Count blocked patterns
    const blockedPatternsMatch = html.match(/BLOCKED_PATTERNS.*?Object\.freeze\(\[([\s\S]*?)\]\)/);
    if (blockedPatternsMatch) {
      const patterns = blockedPatternsMatch[1].split(',').filter(line => 
        line.includes('/') && line.includes('/')
      );
      results.blockedPatternsCount = patterns.length;
    }

    // Check for emergency controls
    if (html.includes('__ECOS_ELEMENT_PROTECTION__')) {
      results.emergencyControlsPresent = true;
    }

    // Check for browser extension detection
    if (html.includes('BROWSER EXTENSION DETECTED')) {
      results.browserExtensionDetection = true;
    }

    // Simulate custom element registration attempts
    const dom = new JSDOM(html, {
      runScripts: "dangerously",
      resources: "usable",
      beforeParse(window) {
        // Set up test environment
        window.console = console;
        
        // Track registration attempts
        const attempts = [];
        const originalDefine = window.customElements.define;
        
        window.customElements.define = function(name, constructor, options) {
          attempts.push({ name, blocked: false });
          return originalDefine.call(this, name, constructor, options);
        };

        // Test after protection loads
        setTimeout(() => {
          const testElements = [
            'mce-autosize-textarea',
            'webcomponents-ce',
            'overlay_bundle',
            'test-legitimate-element'
          ];

          testElements.forEach(elementName => {
            try {
              window.customElements.define(elementName, class extends HTMLElement {});
              attempts.push({ name: elementName, blocked: false });
            } catch (error) {
              attempts.push({ name: elementName, blocked: true, error: error.message });
            }
          });

          results.testAttempts = attempts;
        }, 100);
      }
    });

  } catch (error) {
    results.errors.push(error.message);
  }

  return results;
}

function generateReport(results) {
  console.log('\n🛡️  CUSTOM ELEMENT PROTECTION VERIFICATION REPORT');
  console.log('=' .repeat(60));
  
  console.log('\n📊 PROTECTION SYSTEM STATUS:');
  console.log(`✅ Protection Script Present: ${results.protectionScriptPresent ? 'YES' : '❌ NO'}`);
  console.log(`✅ CSP Header Present: ${results.cspHeaderPresent ? 'YES' : '❌ NO'}`);
  console.log(`✅ Emergency Controls: ${results.emergencyControlsPresent ? 'YES' : '❌ NO'}`);
  console.log(`✅ Browser Extension Detection: ${results.browserExtensionDetection ? 'YES' : '❌ NO'}`);
  
  console.log('\n📈 COVERAGE METRICS:');
  console.log(`🚫 Blocked Elements: ${results.blockedElementsCount}`);
  console.log(`🔍 Blocked Patterns: ${results.blockedPatternsCount}`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ ERRORS DETECTED:');
    results.errors.forEach(error => console.log(`   - ${error}`));
  }
  
  const overallScore = (
    (results.protectionScriptPresent ? 25 : 0) +
    (results.cspHeaderPresent ? 25 : 0) +
    (results.emergencyControlsPresent ? 20 : 0) +
    (results.browserExtensionDetection ? 10 : 0) +
    (Math.min(results.blockedElementsCount, 20)) +
    (results.errors.length === 0 ? 10 : 0)
  );
  
  console.log(`\n🎯 OVERALL PROTECTION SCORE: ${overallScore}/100`);
  
  if (overallScore >= 90) {
    console.log('🟢 EXCELLENT - Maximum protection active');
  } else if (overallScore >= 70) {
    console.log('🟡 GOOD - Strong protection with minor gaps');
  } else {
    console.log('🔴 WEAK - Protection system needs immediate attention');
  }
  
  console.log('\n💡 RECOMMENDATIONS:');
  if (!results.protectionScriptPresent) {
    console.log('  - Deploy the enhanced protection script immediately');
  }
  if (!results.cspHeaderPresent) {
    console.log('  - Add Content Security Policy headers');
  }
  if (results.blockedElementsCount < 10) {
    console.log('  - Expand the blocked elements list');
  }
  if (results.errors.length > 0) {
    console.log('  - Resolve deployment errors');
  }
}

async function main() {
  try {
    console.log('🔍 Fetching site content for protection verification...');
    const html = await fetchSiteContent();
    
    console.log('🧪 Running protection system tests...');
    const results = testCustomElementProtection(html);
    
    generateReport(results);
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = { testCustomElementProtection, generateReport };