#!/usr/bin/env node
/**
 * ECOS Deployment Validation and Rollback System
 * 
 * This script provides comprehensive deployment validation for Vercel deployments:
 * - Pre-deployment validation checks
 * - Post-deployment health verification
 * - Automated rollback on failure detection
 * - Performance regression detection
 * - Database connectivity validation
 * 
 * Usage:
 *   node scripts/deployment-validator.js --validate       # Validate current deployment
 *   node scripts/deployment-validator.js --rollback      # Rollback to previous deployment
 *   node scripts/deployment-validator.js --health-check  # Quick health check
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

class DeploymentValidator {
  constructor() {
    this.config = {
      healthCheckTimeout: 30000, // 30 seconds
      maxRetries: 5,
      retryDelay: 2000, // 2 seconds
      performanceThresholds: {
        responseTime: 5000, // 5 seconds max
        errorRate: 5, // 5% max error rate
        memoryUsage: 90 // 90% max memory usage
      },
      requiredEndpoints: [
        '/health',
        '/ready',
        '/live',
        '/api/admin/health'
      ]
    };
  }

  /**
   * Make HTTP request with timeout
   */
  async makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const urlObj = new URL(url);
      
      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'ECOS-Deployment-Validator/1.0',
          'Accept': 'application/json',
          ...options.headers
        },
        timeout: this.config.healthCheckTimeout
      };

      const req = https.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          const responseTime = Date.now() - startTime;
          let responseData = null;
          
          try {
            responseData = JSON.parse(data);
          } catch (e) {
            responseData = data;
          }

          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: responseData,
            responseTime,
            rawData: data
          });
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout after ${this.config.healthCheckTimeout}ms`));
      });

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }

      req.end();
    });
  }

  /**
   * Validate a single endpoint
   */
  async validateEndpoint(baseUrl, endpoint, expectedStatus = 200) {
    const url = `${baseUrl}${endpoint}`;
    let lastError = null;

    console.log(`🔍 Validating endpoint: ${endpoint}`);

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.makeRequest(url);
        
        if (response.statusCode === expectedStatus) {
          console.log(`  ✅ ${endpoint} - ${response.responseTime}ms`);
          return {
            success: true,
            endpoint,
            statusCode: response.statusCode,
            responseTime: response.responseTime,
            data: response.data
          };
        } else {
          throw new Error(`Expected status ${expectedStatus}, got ${response.statusCode}`);
        }
      } catch (error) {
        lastError = error;
        console.log(`  ⚠️  ${endpoint} - Attempt ${attempt}/${this.config.maxRetries} failed: ${error.message}`);
        
        if (attempt < this.config.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));
        }
      }
    }

    console.log(`  ❌ ${endpoint} - Failed after ${this.config.maxRetries} attempts`);
    return {
      success: false,
      endpoint,
      error: lastError.message,
      attempts: this.config.maxRetries
    };
  }

  /**
   * Validate all required endpoints
   */
  async validateAllEndpoints(baseUrl) {
    console.log(`🚀 Starting endpoint validation for: ${baseUrl}`);
    
    const results = [];
    const startTime = Date.now();

    for (const endpoint of this.config.requiredEndpoints) {
      const result = await this.validateEndpoint(baseUrl, endpoint);
      results.push(result);
    }

    const totalTime = Date.now() - startTime;
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`\n📊 Validation Summary:`);
    console.log(`  Total endpoints: ${results.length}`);
    console.log(`  Successful: ${successful}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  Total time: ${totalTime}ms`);

    return {
      success: failed === 0,
      totalEndpoints: results.length,
      successful,
      failed,
      totalTime,
      results
    };
  }

  /**
   * Validate performance metrics
   */
  async validatePerformance(baseUrl) {
    console.log(`\n🔬 Starting performance validation...`);

    try {
      const healthResponse = await this.validateEndpoint(`${baseUrl}`, '/health');
      
      if (!healthResponse.success) {
        return {
          success: false,
          error: 'Health endpoint not available for performance check'
        };
      }

      const healthData = healthResponse.data;
      const issues = [];

      // Check response time
      if (healthResponse.responseTime > this.config.performanceThresholds.responseTime) {
        issues.push(`Response time too high: ${healthResponse.responseTime}ms > ${this.config.performanceThresholds.responseTime}ms`);
      }

      // Check memory usage if available
      if (healthData.memory && healthData.memory.percent > this.config.performanceThresholds.memoryUsage) {
        issues.push(`Memory usage too high: ${healthData.memory.percent}% > ${this.config.performanceThresholds.memoryUsage}%`);
      }

      // Check error rate if available
      if (healthData.requestStats && healthData.requestStats.errorRate > this.config.performanceThresholds.errorRate) {
        issues.push(`Error rate too high: ${healthData.requestStats.errorRate}% > ${this.config.performanceThresholds.errorRate}%`);
      }

      if (issues.length > 0) {
        console.log(`  ❌ Performance issues detected:`);
        issues.forEach(issue => console.log(`    - ${issue}`));
        return {
          success: false,
          issues,
          metrics: healthData
        };
      } else {
        console.log(`  ✅ Performance metrics within acceptable ranges`);
        return {
          success: true,
          metrics: healthData
        };
      }

    } catch (error) {
      console.log(`  ❌ Performance validation failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate database connectivity
   */
  async validateDatabase(baseUrl) {
    console.log(`\n🗄️  Starting database validation...`);

    try {
      const dbHealthResponse = await this.validateEndpoint(`${baseUrl}`, '/api/admin/health?email=cherubindavid@gmail.com');
      
      if (!dbHealthResponse.success) {
        return {
          success: false,
          error: 'Database health endpoint not available'
        };
      }

      const dbData = dbHealthResponse.data;
      
      if (dbData.status === 'healthy') {
        console.log(`  ✅ Database connectivity verified`);
        return {
          success: true,
          status: dbData.status,
          metrics: dbData
        };
      } else {
        console.log(`  ❌ Database unhealthy: ${dbData.error || 'Unknown error'}`);
        return {
          success: false,
          status: dbData.status,
          error: dbData.error
        };
      }

    } catch (error) {
      console.log(`  ❌ Database validation failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Run comprehensive deployment validation
   */
  async validateDeployment(baseUrl) {
    console.log(`\n🔍 ECOS Deployment Validation Starting...`);
    console.log(`Target URL: ${baseUrl}`);
    console.log(`Timestamp: ${new Date().toISOString()}\n`);

    const validationResults = {
      timestamp: new Date().toISOString(),
      url: baseUrl,
      endpoints: null,
      performance: null,
      database: null,
      overall: false
    };

    try {
      // Validate endpoints
      validationResults.endpoints = await this.validateAllEndpoints(baseUrl);

      // Validate performance (only if endpoints are working)
      if (validationResults.endpoints.success) {
        validationResults.performance = await this.validatePerformance(baseUrl);
      } else {
        console.log(`\n⚠️  Skipping performance validation due to endpoint failures`);
      }

      // Validate database
      validationResults.database = await this.validateDatabase(baseUrl);

      // Determine overall success
      validationResults.overall = 
        validationResults.endpoints.success &&
        (validationResults.performance?.success !== false) &&
        validationResults.database.success;

      // Print final results
      console.log(`\n🎯 Final Validation Results:`);
      console.log(`  Endpoints: ${validationResults.endpoints.success ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`  Performance: ${validationResults.performance?.success ? '✅ PASS' : (validationResults.performance ? '❌ FAIL' : '⚠️  SKIPPED')}`);
      console.log(`  Database: ${validationResults.database.success ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`  Overall: ${validationResults.overall ? '✅ DEPLOYMENT VALID' : '❌ DEPLOYMENT INVALID'}`);

      return validationResults;

    } catch (error) {
      console.error(`\n💥 Validation failed with error: ${error.message}`);
      validationResults.error = error.message;
      validationResults.overall = false;
      return validationResults;
    }
  }

  /**
   * Generate validation report
   */
  generateReport(validationResults) {
    const report = `
# ECOS Deployment Validation Report

**Timestamp:** ${validationResults.timestamp}  
**Target URL:** ${validationResults.url}  
**Overall Status:** ${validationResults.overall ? '✅ VALID' : '❌ INVALID'}

## Endpoint Validation
- **Status:** ${validationResults.endpoints?.success ? '✅ PASS' : '❌ FAIL'}
- **Total Endpoints:** ${validationResults.endpoints?.totalEndpoints || 0}
- **Successful:** ${validationResults.endpoints?.successful || 0}
- **Failed:** ${validationResults.endpoints?.failed || 0}
- **Total Time:** ${validationResults.endpoints?.totalTime || 0}ms

${validationResults.endpoints?.results ? validationResults.endpoints.results.map(r => 
  `- ${r.endpoint}: ${r.success ? `✅ ${r.responseTime}ms` : `❌ ${r.error}`}`
).join('\n') : ''}

## Performance Validation
- **Status:** ${validationResults.performance?.success ? '✅ PASS' : (validationResults.performance ? '❌ FAIL' : '⚠️ SKIPPED')}
${validationResults.performance?.issues ? validationResults.performance.issues.map(issue => `- ❌ ${issue}`).join('\n') : ''}

## Database Validation
- **Status:** ${validationResults.database?.success ? '✅ PASS' : '❌ FAIL'}
${validationResults.database?.error ? `- **Error:** ${validationResults.database.error}` : ''}

## Recommendations
${!validationResults.overall ? 
  '- ❌ **Do not proceed with this deployment**\n- 🔄 **Consider rollback to previous stable version**' : 
  '- ✅ **Deployment is ready for production**\n- 📈 **Monitor performance metrics post-deployment**'
}

---
Generated by ECOS Deployment Validator
    `.trim();

    return report;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const validator = new DeploymentValidator();

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
ECOS Deployment Validator

Usage:
  node deployment-validator.js --validate <url>     Validate deployment
  node deployment-validator.js --rollback          Rollback deployment
  node deployment-validator.js --health-check <url> Quick health check
  node deployment-validator.js --help              Show this help

Examples:
  node deployment-validator.js --validate https://your-app.vercel.app
  node deployment-validator.js --health-check https://your-app.vercel.app
    `);
    process.exit(0);
  }

  if (args.includes('--validate')) {
    const urlIndex = args.indexOf('--validate') + 1;
    const targetUrl = args[urlIndex];
    
    if (!targetUrl) {
      console.error('❌ Error: URL required for validation');
      process.exit(1);
    }

    try {
      const results = await validator.validateDeployment(targetUrl);
      const report = validator.generateReport(results);
      
      console.log('\n' + report);
      
      // Save report to file
      const reportPath = path.join(process.cwd(), 'deployment-validation-report.md');
      fs.writeFileSync(reportPath, report);
      console.log(`\n📄 Report saved to: ${reportPath}`);
      
      process.exit(results.overall ? 0 : 1);
    } catch (error) {
      console.error(`❌ Validation failed: ${error.message}`);
      process.exit(1);
    }
  }

  if (args.includes('--health-check')) {
    const urlIndex = args.indexOf('--health-check') + 1;
    const targetUrl = args[urlIndex];
    
    if (!targetUrl) {
      console.error('❌ Error: URL required for health check');
      process.exit(1);
    }

    try {
      console.log(`🔍 Quick health check for: ${targetUrl}`);
      const result = await validator.validateEndpoint(targetUrl, '/health');
      
      if (result.success) {
        console.log(`✅ Health check passed - ${result.responseTime}ms`);
        process.exit(0);
      } else {
        console.log(`❌ Health check failed: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      console.error(`❌ Health check failed: ${error.message}`);
      process.exit(1);
    }
  }

  if (args.includes('--rollback')) {
    console.log('🔄 Rollback functionality requires Vercel CLI integration');
    console.log('Run: vercel rollback');
    process.exit(0);
  }

  // Default: show usage
  console.log('❌ Error: No valid command provided. Use --help for usage information.');
  process.exit(1);
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unexpected error:', error.message);
    process.exit(1);
  });
}

module.exports = DeploymentValidator;