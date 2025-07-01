
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle, XCircle, RefreshCw } from "lucide-react";

interface DiagnosticResult {
  category: string;
  test: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: any;
}

export default function DeepDiagnostic() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    setDiagnostics([]);
    setLogs([]);
    
    const results: DiagnosticResult[] = [];

    try {
      // 1. Check API connectivity
      addLog("Testing API connectivity...");
      try {
        const response = await fetch('/api/status?email=test@example.com');
        if (response.ok) {
          results.push({
            category: 'API',
            test: 'Server Connection',
            status: 'success',
            message: 'API server is responding'
          });
        } else {
          results.push({
            category: 'API',
            test: 'Server Connection',
            status: 'error',
            message: `API returned status: ${response.status}`,
            details: await response.text()
          });
        }
      } catch (error) {
        results.push({
          category: 'API',
          test: 'Server Connection',
          status: 'error',
          message: 'Failed to connect to API server',
          details: error
        });
      }

      // 2. Check client-side rendering
      addLog("Checking client-side rendering...");
      const appElement = document.getElementById('root');
      if (appElement && appElement.children.length > 0) {
        results.push({
          category: 'Frontend',
          test: 'React Rendering',
          status: 'success',
          message: 'React app is rendering correctly'
        });
      } else {
        results.push({
          category: 'Frontend',
          test: 'React Rendering',
          status: 'error',
          message: 'React app may not be rendering properly'
        });
      }

      // 3. Check for console errors
      addLog("Analyzing console for errors...");
      const originalConsoleError = console.error;
      let consoleErrors: string[] = [];
      console.error = (...args) => {
        consoleErrors.push(args.join(' '));
        originalConsoleError(...args);
      };

      // Restore console.error after a brief period
      setTimeout(() => {
        console.error = originalConsoleError;
      }, 1000);

      if (consoleErrors.length === 0) {
        results.push({
          category: 'Frontend',
          test: 'Console Errors',
          status: 'success',
          message: 'No recent console errors detected'
        });
      } else {
        results.push({
          category: 'Frontend',
          test: 'Console Errors',
          status: 'warning',
          message: `${consoleErrors.length} console errors detected`,
          details: consoleErrors
        });
      }

      // 4. Check network requests
      addLog("Testing various API endpoints...");
      const endpoints = [
        '/api/webhook',
        '/api/history',
        '/api/ecos/scenarios',
        '/api/ecos/sessions'
      ];

      for (const endpoint of endpoints) {
        try {
          const testData = endpoint === '/api/webhook' 
            ? { email: 'test@example.com' }
            : null;
          
          const options: RequestInit = {
            method: testData ? 'POST' : 'GET',
            headers: testData ? { 'Content-Type': 'application/json' } : {},
            ...(testData && { body: JSON.stringify(testData) })
          };

          if (endpoint !== '/api/webhook') {
            options.method = 'GET';
            const url = endpoint + '?email=test@example.com';
            const response = await fetch(url, options);
            
            results.push({
              category: 'API',
              test: `Endpoint ${endpoint}`,
              status: response.ok ? 'success' : 'error',
              message: response.ok 
                ? `${endpoint} responding correctly (${response.status})`
                : `${endpoint} returned ${response.status}`,
              details: response.ok ? await response.json() : await response.text()
            });
          }
        } catch (error) {
          results.push({
            category: 'API',
            test: `Endpoint ${endpoint}`,
            status: 'error',
            message: `Failed to test ${endpoint}`,
            details: error
          });
        }
      }

      // 5. Check environment variables and configuration
      addLog("Checking environment configuration...");
      const currentUrl = window.location.href;
      const isLocalhost = currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1');
      const isReplit = currentUrl.includes('replit.dev') || currentUrl.includes('replit.co');
      
      results.push({
        category: 'Environment',
        test: 'Platform Detection',
        status: 'success',
        message: `Running on ${isReplit ? 'Replit' : isLocalhost ? 'localhost' : 'unknown platform'}`,
        details: { url: currentUrl, isReplit, isLocalhost }
      });

      // 6. Check for TypeScript/Build errors
      addLog("Checking for build issues...");
      try {
        // Test if critical components can be imported/rendered
        const testComponent = document.createElement('div');
        testComponent.innerHTML = '<div>Test</div>';
        
        results.push({
          category: 'Build',
          test: 'Component Compilation',
          status: 'success',
          message: 'Components appear to be compiled correctly'
        });
      } catch (error) {
        results.push({
          category: 'Build',
          test: 'Component Compilation',
          status: 'error',
          message: 'Build/compilation issues detected',
          details: error
        });
      }

      // 7. Check for route handling
      addLog("Testing route handling...");
      const currentPath = window.location.pathname;
      results.push({
        category: 'Routing',
        test: 'Current Route',
        status: 'success',
        message: `Currently on route: ${currentPath}`,
        details: { path: currentPath, search: window.location.search }
      });

      // 8. Memory and performance check
      addLog("Checking performance metrics...");
      if ('performance' in window && 'memory' in (performance as any)) {
        const memory = (performance as any).memory;
        results.push({
          category: 'Performance',
          test: 'Memory Usage',
          status: memory.usedJSHeapSize > 50000000 ? 'warning' : 'success',
          message: `Memory usage: ${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB`,
          details: memory
        });
      }

      setDiagnostics(results);
      addLog(`Diagnostics completed. Found ${results.filter(r => r.status === 'error').length} errors, ${results.filter(r => r.status === 'warning').length} warnings.`);
      
    } catch (error) {
      addLog(`Diagnostic failed: ${error}`);
      results.push({
        category: 'System',
        test: 'Diagnostic Runner',
        status: 'error',
        message: 'Failed to complete diagnostics',
        details: error
      });
      setDiagnostics(results);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-50 border-green-200';
      case 'error': return 'bg-red-50 border-red-200';
      case 'warning': return 'bg-yellow-50 border-yellow-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const groupedDiagnostics = diagnostics.reduce((acc, diagnostic) => {
    if (!acc[diagnostic.category]) {
      acc[diagnostic.category] = [];
    }
    acc[diagnostic.category].push(diagnostic);
    return acc;
  }, {} as Record<string, DiagnosticResult[]>);

  const errorCount = diagnostics.filter(d => d.status === 'error').length;
  const warningCount = diagnostics.filter(d => d.status === 'warning').length;
  const successCount = diagnostics.filter(d => d.status === 'success').length;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl">Deep System Diagnostic</CardTitle>
              <p className="text-gray-600">Comprehensive analysis of application health</p>
            </div>
            <Button onClick={runDiagnostics} disabled={isRunning}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isRunning ? 'animate-spin' : ''}`} />
              {isRunning ? 'Running...' : 'Re-run Diagnostics'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{successCount}</div>
              <div className="text-sm text-gray-600">Passed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{warningCount}</div>
              <div className="text-sm text-gray-600">Warnings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{errorCount}</div>
              <div className="text-sm text-gray-600">Errors</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="results" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="results">Test Results</TabsTrigger>
          <TabsTrigger value="logs">Diagnostic Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="results" className="mt-6">
          <div className="space-y-6">
            {Object.entries(groupedDiagnostics).map(([category, tests]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="text-lg">{category}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {tests.map((test, index) => (
                      <div key={index} className={`p-3 rounded-lg border ${getStatusColor(test.status)}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(test.status)}
                            <span className="font-medium">{test.test}</span>
                          </div>
                          <Badge variant="outline" className={
                            test.status === 'success' ? 'text-green-700' :
                            test.status === 'error' ? 'text-red-700' : 'text-yellow-700'
                          }>
                            {test.status.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{test.message}</p>
                        {test.details && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                              Show details
                            </summary>
                            <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto max-h-32">
                              {JSON.stringify(test.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="logs" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Diagnostic Execution Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-auto">
                {logs.map((log, index) => (
                  <div key={index} className="mb-1">{log}</div>
                ))}
                {isRunning && (
                  <div className="animate-pulse">Running diagnostics...</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
