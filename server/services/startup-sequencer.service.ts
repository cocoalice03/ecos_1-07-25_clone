import { unifiedDb } from './unified-database.service.js';

interface ServiceStatus {
  name: string;
  status: 'pending' | 'initializing' | 'ready' | 'failed';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  error?: string;
}

/**
 * Startup Sequencer Service
 * 
 * Ensures deterministic service initialization order.
 * Prevents API endpoints from accepting requests before services are ready.
 * Provides readiness gates for load balancers.
 */
export class StartupSequencerService {
  private services: Map<string, ServiceStatus> = new Map();
  private isReady = false;
  private readinessPromise: Promise<void> | null = null;
  private startupStartTime = new Date();

  constructor() {
    // Define services and their initialization order
    this.services.set('database', { name: 'Database', status: 'pending' });
    this.services.set('scenarios', { name: 'Scenarios', status: 'pending' });
  }

  /**
   * Initialize all services in sequence
   */
  async initialize(): Promise<void> {
    if (this.isReady) return;
    
    if (this.readinessPromise) {
      return this.readinessPromise;
    }
    
    this.readinessPromise = this._performSequentialInitialization();
    return this.readinessPromise;
  }

  private async _performSequentialInitialization(): Promise<void> {
    console.log('🚀 Starting application initialization sequence...');
    
    try {
      // Phase 1: Initialize Database
      await this._initializeService('database', async () => {
        await unifiedDb.initialize();
      });

      // Phase 2: Initialize Scenarios (depends on database)
      await this._initializeService('scenarios', async () => {
        // Test scenario loading
        const scenarios = await unifiedDb.getScenarios();
        console.log(`✅ Loaded ${scenarios.length} scenarios`);
      });

      // All services ready
      this.isReady = true;
      const totalDuration = Date.now() - this.startupStartTime.getTime();
      console.log(`✅ All services initialized successfully in ${totalDuration}ms`);
      
    } catch (error: any) {
      console.error('❌ Service initialization failed:', error.message);
      this.markServiceFailed('startup', error.message);
      throw error;
    }
  }

  private async _initializeService(serviceKey: string, initFunction: () => Promise<void>): Promise<void> {
    const service = this.services.get(serviceKey);
    if (!service) throw new Error(`Unknown service: ${serviceKey}`);

    console.log(`🔄 Initializing ${service.name}...`);
    
    service.status = 'initializing';
    service.startTime = new Date();
    
    try {
      await initFunction();
      
      service.status = 'ready';
      service.endTime = new Date();
      service.duration = service.endTime.getTime() - service.startTime!.getTime();
      
      console.log(`✅ ${service.name} ready (${service.duration}ms)`);
    } catch (error: any) {
      service.status = 'failed';
      service.endTime = new Date();
      service.error = error.message;
      service.duration = service.endTime.getTime() - service.startTime!.getTime();
      
      console.error(`❌ ${service.name} failed after ${service.duration}ms:`, error.message);
      throw error;
    }
  }

  private markServiceFailed(serviceKey: string, error: string): void {
    const service = this.services.get(serviceKey);
    if (service) {
      service.status = 'failed';
      service.error = error;
      service.endTime = new Date();
    }
  }

  /**
   * Check if all services are ready
   */
  areServicesReady(): boolean {
    return this.isReady;
  }

  /**
   * Get service status for monitoring
   */
  getServiceStatus(): Record<string, ServiceStatus> {
    const status: Record<string, ServiceStatus> = {};
    this.services.forEach((service, key) => {
      status[key] = { ...service };
    });
    return status;
  }

  /**
   * Wait for all services to be ready (with timeout)
   */
  async waitForReady(timeoutMs: number = 30000): Promise<void> {
    if (this.isReady) return;

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Startup timeout after ${timeoutMs}ms`)), timeoutMs);
    });

    try {
      await Promise.race([
        this.initialize(),
        timeoutPromise
      ]);
    } catch (error: any) {
      console.error('❌ Startup sequence failed or timed out:', error.message);
      throw error;
    }
  }

  /**
   * Get readiness status for health checks
   */
  getReadinessStatus(): {
    ready: boolean;
    services: Record<string, ServiceStatus>;
    uptime: number;
  } {
    return {
      ready: this.isReady,
      services: this.getServiceStatus(),
      uptime: Date.now() - this.startupStartTime.getTime()
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('🔄 Initiating graceful shutdown...');
    this.isReady = false;
    
    // Reset all services
    this.services.forEach(service => {
      service.status = 'pending';
      service.startTime = undefined;
      service.endTime = undefined;
      service.duration = undefined;
      service.error = undefined;
    });
    
    console.log('✅ Graceful shutdown completed');
  }
}

// Export singleton instance
export const startupSequencer = new StartupSequencerService();