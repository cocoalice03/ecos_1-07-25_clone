// Global type declarations for ECOS application

interface Window {
  __ECOS_ELEMENT_PROTECTION__?: {
    metrics(): {
      blocked: number;
      allowed: number;
      errors: number;
      startTime: number;
    };
    registeredElements(): string[];
    disable(): void;
    enable(): void;
  };
}

// Extend global scope for development environment variables
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production';
      REPL_ID?: string;
    }
  }
}

export {};