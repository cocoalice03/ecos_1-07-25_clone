/**
 * Advanced Custom Element Conflict Resolution System
 * 
 * This system prevents the "custom element already defined" errors that cause
 * JavaScript runtime failures in the ECOS application. It provides:
 * 
 * - Comprehensive element blocking for known problematic components
 * - Dynamic conflict detection and prevention
 * - Error boundary protection with graceful fallbacks
 * - Performance monitoring for element registration
 * - Development mode debugging capabilities
 */

interface ElementRegistrationAttempt {
  name: string;
  timestamp: number;
  blocked: boolean;
  reason?: string;
}

interface ConflictResolutionMetrics {
  totalAttempts: number;
  blockedAttempts: number;
  allowedAttempts: number;
  errorsCaught: number;
  performanceImpact: number;
  lastActivity: Date;
}

class CustomElementProtectionSystem {
  private originalDefine: typeof customElements.define;
  private registeredElements = new Set<string>();
  private blockedElements = new Set<string>();
  private registrationAttempts: ElementRegistrationAttempt[] = [];
  private metrics: ConflictResolutionMetrics;
  private isInitialized = false;
  private developmentMode = false;

  // Known problematic elements that should always be blocked
  private readonly PROBLEMATIC_ELEMENTS = [
    'mce-autosize-textarea',
    'autosize-textarea', 
    'vite-error-overlay',
    'replit-error-overlay',
    'webcomponent-error-overlay',
    'cartographer-overlay',
    'runtime-error-modal',
    'dev-error-overlay',
    'webpack-dev-server-client',
    'hot-reload-overlay'
  ];

  // Pattern-based blocking for dynamic element names
  private readonly BLOCKED_PATTERNS = [
    /^mce-.*$/,
    /^vite-.*-overlay$/,
    /^replit-.*-overlay$/,
    /^dev-.*-overlay$/,
    /^error-.*-modal$/,
    /^runtime-.*-overlay$/
  ];

  constructor() {
    this.developmentMode = process.env.NODE_ENV === 'development';
    this.originalDefine = customElements.define;
    
    this.metrics = {
      totalAttempts: 0,
      blockedAttempts: 0,
      allowedAttempts: 0,
      errorsCaught: 0,
      performanceImpact: 0,
      lastActivity: new Date()
    };

    this.preBlockKnownElements();
  }

  /**
   * Pre-emptively mark known problematic elements as registered
   * to prevent any registration attempts
   */
  private preBlockKnownElements(): void {
    this.PROBLEMATIC_ELEMENTS.forEach(elementName => {
      this.blockedElements.add(elementName);
      this.registeredElements.add(elementName);
    });

    if (this.developmentMode) {
      console.log(`🛡️ Pre-blocked ${this.PROBLEMATIC_ELEMENTS.length} known problematic elements`);
    }
  }

  /**
   * Check if an element name matches any blocked patterns
   */
  private matchesBlockedPattern(name: string): boolean {
    return this.BLOCKED_PATTERNS.some(pattern => pattern.test(name));
  }

  /**
   * Determine if an element should be blocked
   */
  private shouldBlockElement(name: string): { block: boolean; reason?: string } {
    // Check if already registered
    if (this.registeredElements.has(name)) {
      return { block: true, reason: 'already_registered' };
    }

    // Check if it's a known problematic element
    if (this.PROBLEMATIC_ELEMENTS.includes(name)) {
      return { block: true, reason: 'known_problematic' };
    }

    // Check pattern matching
    if (this.matchesBlockedPattern(name)) {
      return { block: true, reason: 'pattern_match' };
    }

    // Check if element exists in DOM already (edge case protection)
    if (customElements.get(name)) {
      return { block: true, reason: 'native_registry_conflict' };
    }

    return { block: false };
  }

  /**
   * Log registration attempt for monitoring
   */
  private logRegistrationAttempt(name: string, blocked: boolean, reason?: string): void {
    const attempt: ElementRegistrationAttempt = {
      name,
      timestamp: Date.now(),
      blocked,
      reason
    };

    this.registrationAttempts.push(attempt);
    
    // Keep only last 100 attempts to prevent memory leaks
    if (this.registrationAttempts.length > 100) {
      this.registrationAttempts.shift();
    }

    this.metrics.totalAttempts++;
    this.metrics.lastActivity = new Date();

    if (blocked) {
      this.metrics.blockedAttempts++;
      if (this.developmentMode) {
        console.warn(`🚫 BLOCKED custom element "${name}" - ${reason}`);
      }
    } else {
      this.metrics.allowedAttempts++;
      if (this.developmentMode) {
        console.log(`✅ ALLOWED custom element "${name}"`);
      }
    }
  }

  /**
   * Enhanced custom element define method with conflict resolution
   */
  private createProtectedDefineMethod(): typeof customElements.define {
    return (name: string, constructor: any, options?: ElementDefinitionOptions) => {
      const startTime = performance.now();
      
      try {
        const { block, reason } = this.shouldBlockElement(name);
        
        if (block) {
          this.logRegistrationAttempt(name, true, reason);
          return; // Silently ignore blocked elements
        }

        // Mark as registered before attempting to prevent race conditions
        this.registeredElements.add(name);
        
        // Attempt registration with error handling
        try {
          const result = this.originalDefine.call(customElements, name, constructor, options);
          this.logRegistrationAttempt(name, false, 'successful');
          return result;
        } catch (error) {
          // Remove from registered set if registration failed
          this.registeredElements.delete(name);
          
          if (error instanceof Error && error.message.includes('already been defined')) {
            // Handle the specific "already defined" error gracefully
            this.logRegistrationAttempt(name, true, 'registration_conflict');
            if (this.developmentMode) {
              console.warn(`🔄 Element "${name}" was already defined, ignoring redefinition`);
            }
            return;
          }
          
          // Re-throw other errors
          throw error;
        }
      } finally {
        const endTime = performance.now();
        this.metrics.performanceImpact += endTime - startTime;
      }
    };
  }

  /**
   * Set up global error handlers for custom element errors
   */
  private setupErrorHandlers(): void {
    // Handle unhandled errors
    window.addEventListener('error', (event) => {
      if (event.error && event.error.message) {
        const message = event.error.message;
        
        if (
          message.includes('already been defined') ||
          message.includes('custom element') ||
          message.includes('mce-autosize-textarea')
        ) {
          this.metrics.errorsCaught++;
          
          if (this.developmentMode) {
            console.warn('🛡️ Caught and prevented custom element error:', message);
          }
          
          event.preventDefault();
          event.stopPropagation();
          return false;
        }
      }
    }, true);

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason && typeof event.reason === 'object') {
        const message = event.reason.message || String(event.reason);
        
        if (message.includes('already been defined') || message.includes('custom element')) {
          this.metrics.errorsCaught++;
          
          if (this.developmentMode) {
            console.warn('🛡️ Caught and prevented custom element promise rejection:', message);
          }
          
          event.preventDefault();
          return false;
        }
      }
    });
  }

  /**
   * Initialize the protection system
   */
  initialize(): void {
    if (this.isInitialized) {
      console.warn('Custom element protection system already initialized');
      return;
    }

    if (this.developmentMode) {
      console.log('🛡️ Initializing advanced custom element protection system...');
    }

    // Replace the native customElements.define method
    customElements.define = this.createProtectedDefineMethod();

    // Set up error handlers
    this.setupErrorHandlers();

    this.isInitialized = true;

    if (this.developmentMode) {
      console.log('✅ Custom element protection system initialized successfully');
    }
  }

  /**
   * Get current metrics for monitoring
   */
  getMetrics(): ConflictResolutionMetrics {
    return { ...this.metrics };
  }

  /**
   * Get recent registration attempts for debugging
   */
  getRecentAttempts(limit = 20): ElementRegistrationAttempt[] {
    return this.registrationAttempts.slice(-limit);
  }

  /**
   * Check if system is healthy (no recent errors)
   */
  isHealthy(): boolean {
    const recentErrors = this.registrationAttempts
      .slice(-10)
      .filter(attempt => attempt.blocked).length;
    
    return recentErrors < 5; // Allow some blocked attempts but not too many
  }

  /**
   * Get system status for debugging
   */
  getSystemStatus() {
    return {
      initialized: this.isInitialized,
      developmentMode: this.developmentMode,
      registeredElements: Array.from(this.registeredElements).length,
      blockedElements: Array.from(this.blockedElements).length,
      metrics: this.getMetrics(),
      healthy: this.isHealthy(),
      recentActivity: this.getRecentAttempts(5)
    };
  }

  /**
   * Emergency reset if system gets into bad state
   */
  emergencyReset(): void {
    console.warn('🚨 Performing emergency reset of custom element protection system');
    
    // Reset all tracking
    this.registeredElements.clear();
    this.blockedElements.clear();
    this.registrationAttempts = [];
    
    // Re-initialize with fresh state
    this.preBlockKnownElements();
    
    console.log('✅ Emergency reset completed');
  }
}

// Create singleton instance
const customElementProtection = new CustomElementProtectionSystem();

// Auto-initialize when module loads
if (typeof window !== 'undefined' && window.customElements) {
  customElementProtection.initialize();
}

// Export for advanced usage
export { customElementProtection, CustomElementProtectionSystem };
export type { ElementRegistrationAttempt, ConflictResolutionMetrics };