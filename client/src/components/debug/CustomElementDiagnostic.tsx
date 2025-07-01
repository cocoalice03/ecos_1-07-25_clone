
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CustomElementInfo {
  name: string;
  constructor: any;
  defined: boolean;
  redefinitionAttempts: number;
}

interface ScriptInfo {
  src: string;
  type: string;
  loaded: boolean;
  error?: string;
}

export default function CustomElementDiagnostic() {
  const [customElements, setCustomElements] = useState<CustomElementInfo[]>([]);
  const [scripts, setScripts] = useState<ScriptInfo[]>([]);
  const [errorLog, setErrorLog] = useState<string[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const analyzeCustomElements = () => {
    const elements: CustomElementInfo[] = [];
    
    // Check for known problematic elements
    const knownElements = [
      'autosize-textarea',
      'vite-error-overlay',
      'replit-custom-element'
    ];

    knownElements.forEach(name => {
      const isDefined = window.customElements.get(name) !== undefined;
      elements.push({
        name,
        constructor: window.customElements.get(name),
        defined: isDefined,
        redefinitionAttempts: 0
      });
    });

    // Try to detect all custom elements by checking the registry
    try {
      // This is a hack to access the internal registry
      const registry = (window.customElements as any)._registry;
      if (registry) {
        for (const [name, constructor] of registry) {
          if (!elements.find(el => el.name === name)) {
            elements.push({
              name,
              constructor,
              defined: true,
              redefinitionAttempts: 0
            });
          }
        }
      }
    } catch (e) {
      console.log('Could not access custom elements registry:', e);
    }

    setCustomElements(elements);
  };

  const analyzeScripts = () => {
    const scriptList: ScriptInfo[] = [];
    
    document.querySelectorAll('script').forEach(script => {
      scriptList.push({
        src: script.src || 'inline',
        type: script.type || 'text/javascript',
        loaded: script.src ? true : false,
        error: (script as any).error ? 'Load error' : undefined
      });
    });

    setScripts(scriptList);
  };

  const startMonitoring = () => {
    setIsMonitoring(true);
    setErrorLog([]);

    // Monitor custom element definitions
    const originalDefine = window.customElements.define;
    let defineCallCount = 0;

    window.customElements.define = function(name: string, constructor: any, options?: any) {
      defineCallCount++;
      const timestamp = new Date().toISOString();
      
      if (window.customElements.get(name)) {
        const errorMsg = `[${timestamp}] CONFLICT: Attempt ${defineCallCount} to redefine existing custom element: ${name}`;
        setErrorLog(prev => [...prev, errorMsg]);
        console.error(errorMsg);
        
        // Don't call the original define to prevent the error
        return;
      } else {
        const successMsg = `[${timestamp}] SUCCESS: Defining new custom element: ${name} (attempt ${defineCallCount})`;
        setErrorLog(prev => [...prev, successMsg]);
        console.log(successMsg);
        
        return originalDefine.call(this, name, constructor, options);
      }
    };

    // Monitor for errors
    const originalErrorHandler = window.onerror;
    window.onerror = function(message, source, lineno, colno, error) {
      if (typeof message === 'string' && message.includes('already been defined')) {
        const errorMsg = `[${new Date().toISOString()}] ERROR CAUGHT: ${message} at ${source}:${lineno}:${colno}`;
        setErrorLog(prev => [...prev, errorMsg]);
      }
      
      if (originalErrorHandler) {
        return originalErrorHandler(message, source, lineno, colno, error);
      }
      return false;
    };

    // Monitor unhandled promise rejections
    const originalRejectionHandler = window.onunhandledrejection;
    window.onunhandledrejection = function(event) {
      if (event.reason && event.reason.message && event.reason.message.includes('already been defined')) {
        const errorMsg = `[${new Date().toISOString()}] PROMISE REJECTION: ${event.reason.message}`;
        setErrorLog(prev => [...prev, errorMsg]);
      }
      
      if (originalRejectionHandler) {
        return originalRejectionHandler(event);
      }
    };
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    // Note: In a real implementation, you'd want to restore the original handlers
  };

  const checkForConflictingSources = () => {
    const suspiciousSources = [
      'replit-dev-banner.js',
      'webcomponents-ce.js',
      'overlay_bundle.js',
      'vite',
      '@vite/client'
    ];

    const foundSources = scripts.filter(script => 
      suspiciousSources.some(suspicious => 
        script.src.includes(suspicious) || script.src.includes('overlay')
      )
    );

    return foundSources;
  };

  useEffect(() => {
    analyzeCustomElements();
    analyzeScripts();
  }, []);

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Custom Element Conflict Diagnostic</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={analyzeCustomElements}>Analyze Custom Elements</Button>
            <Button onClick={analyzeScripts}>Analyze Scripts</Button>
            <Button 
              onClick={isMonitoring ? stopMonitoring : startMonitoring}
              variant={isMonitoring ? "destructive" : "default"}
            >
              {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
            </Button>
          </div>

          {/* Custom Elements Analysis */}
          <div>
            <h3 className="font-semibold mb-2">Custom Elements Registry:</h3>
            <div className="space-y-2">
              {customElements.map((element, index) => (
                <div 
                  key={index} 
                  className={`p-2 rounded border ${element.defined ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}
                >
                  <div className="font-mono text-sm">
                    <strong>{element.name}</strong> - 
                    {element.defined ? ' ✗ ALREADY DEFINED' : ' ✓ Available'}
                  </div>
                  {element.constructor && (
                    <div className="text-xs text-gray-600 mt-1">
                      Constructor: {element.constructor.name || 'Anonymous'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Script Analysis */}
          <div>
            <h3 className="font-semibold mb-2">Scripts Analysis:</h3>
            <div className="space-y-1">
              {scripts.map((script, index) => (
                <div key={index} className="text-sm font-mono p-1 border rounded">
                  <span className={script.src.includes('overlay') || script.src.includes('replit') ? 'text-red-600' : 'text-gray-600'}>
                    {script.src} ({script.type})
                  </span>
                  {script.error && <span className="text-red-500 ml-2">ERROR: {script.error}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Conflicting Sources */}
          <div>
            <h3 className="font-semibold mb-2">Potentially Conflicting Sources:</h3>
            <div className="space-y-1">
              {checkForConflictingSources().map((script, index) => (
                <div key={index} className="text-sm font-mono p-2 bg-yellow-50 border border-yellow-200 rounded">
                  ⚠️ {script.src}
                </div>
              ))}
            </div>
          </div>

          {/* Error Log */}
          {errorLog.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Live Error Log:</h3>
              <div className="bg-black text-green-400 p-3 rounded font-mono text-xs max-h-64 overflow-y-auto">
                {errorLog.map((log, index) => (
                  <div key={index}>{log}</div>
                ))}
              </div>
            </div>
          )}

          {/* Status */}
          {isMonitoring && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              🔍 Monitoring active - watching for custom element conflicts...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
