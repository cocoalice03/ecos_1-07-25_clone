
// Utility to prevent custom element redefinition errors
export function preventCustomElementConflicts() {
  // Store original define method
  const originalDefine = window.customElements.define;
  
  // Track which elements we've already seen
  const definedElements = new Set<string>();
  
  // Override the define method to prevent redefinition
  window.customElements.define = function(name: string, constructor: any, options?: any) {
    // Check if element is already defined in the registry OR we've seen it before
    if (window.customElements.get(name) || definedElements.has(name)) {
      console.warn(`🚫 Custom element "${name}" already exists. Preventing redefinition.`);
      return;
    }
    
    // Mark this element as defined
    definedElements.add(name);
    
    // If not defined, proceed with original define
    try {
      console.log(`✅ Defining new custom element: "${name}"`);
      return originalDefine.call(this, name, constructor, options);
    } catch (error) {
      console.error(`❌ Error defining custom element "${name}":`, error);
      // Remove from our tracking since it failed
      definedElements.delete(name);
      
      // If it's a redefinition error, just warn and continue
      if (error instanceof Error && error.message.includes('already been defined')) {
        console.warn(`🔄 Element "${name}" was already defined by another source. Continuing...`);
        return;
      }
      
      throw error;
    }
  };
  
  // Pre-emptively handle known problematic elements
  const problematicElements = [
    'vite-error-overlay', 
    'autosize-textarea', 
    'mce-autosize-textarea',
    'replit-error-overlay',
    'webcomponent-error-overlay'
  ];
  
  // Check if any problematic elements are already defined
  problematicElements.forEach(elementName => {
    if (window.customElements.get(elementName)) {
      console.debug(`🔥 Problematic element "${elementName}" is already defined. Blocking further definitions.`);
      definedElements.add(elementName);
    }
  });
  
  // Immediately block known problematic elements from being defined again
  problematicElements.forEach(elementName => {
    definedElements.add(elementName);
  });

  // Enhanced error handling for custom element conflicts
  const originalErrorHandler = window.addEventListener;
  
  // Intercept error events
  window.addEventListener('error', function(event) {
    if (event.error && event.error.message && event.error.message.includes('already been defined')) {
      console.warn('Prevented custom element redefinition error:', event.error.message);
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  }, true);
  
  // Intercept unhandled promise rejections
  window.addEventListener('unhandledrejection', function(event) {
    if (event.reason && event.reason.message && event.reason.message.includes('already been defined')) {
      console.warn('Prevented custom element redefinition promise rejection:', event.reason.message);
      event.preventDefault();
      return false;
    }
  });
}

// Function to scan and log all current custom elements
export function logCustomElements() {
  console.group('Custom Elements Registry Analysis');
  
  const knownProblematic = ['autosize-textarea', 'vite-error-overlay'];
  
  knownProblematic.forEach(name => {
    const element = window.customElements.get(name);
    if (element) {
      console.debug(`🚨 Problematic element "${name}" is defined:`, element);
    } else {
      console.debug(`✅ Element "${name}" is not defined`);
    }
  });
  
  console.groupEnd();
}

// Function to detect the source of custom element definitions
export function detectCustomElementSources() {
  console.group('Script Sources Analysis');
  
  const scripts = Array.from(document.querySelectorAll('script'));
  const suspiciousSources = ['replit', 'overlay', 'webcomponents', 'vite'];
  
  scripts.forEach((script, index) => {
    const src = script.src || 'inline script';
    const isSuspicious = suspiciousSources.some(keyword => src.toLowerCase().includes(keyword));
    
    if (isSuspicious) {
      console.debug(`🔍 Suspicious script ${index + 1}:`, src);
    } else {
      console.debug(`📄 Script ${index + 1}:`, src);
    }
  });
  
  console.groupEnd();
}
