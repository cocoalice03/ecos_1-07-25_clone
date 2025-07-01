
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface StudentDiagnosticProps {
  email: string;
}

interface DiagnosticTest {
  name: string;
  status: 'pending' | 'success' | 'warning' | 'error';
  message: string;
  data?: any;
  rawResponse?: any;
}

export default function StudentDiagnostic({ email }: StudentDiagnosticProps) {
  const [results, setResults] = useState<{
    tests: DiagnosticTest[];
    isRunning: boolean;
    completedAt?: Date;
  }>({
    tests: [],
    isRunning: false
  });

  const runDiagnostic = async () => {
    setResults({ tests: [], isRunning: true });
    const tests: DiagnosticTest[] = [];

    console.log('🔍 Starting comprehensive diagnostic for email:', email);

    // Test 1: Email validation
    tests.push({
      name: "Email Validation",
      status: email && email.includes('@') ? 'success' : 'error',
      message: email && email.includes('@') ? 
        `Valid email: ${email}` : 
        'Invalid email format',
      data: { email, isValid: email && email.includes('@') }
    });

    // Test 2: Direct API call to available scenarios
    try {
      console.log('🔍 Testing available scenarios endpoint directly...');
      const directResponse = await fetch(`/api/ecos/available-scenarios?email=${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const directData = await directResponse.json();
      console.log('🔍 Direct fetch response:', directData);
      
      tests.push({
        name: "Direct API Call - Available Scenarios",
        status: directResponse.ok ? 'success' : 'error',
        message: directResponse.ok ? 
          `Status ${directResponse.status}: Found ${directData.scenarios?.length || 0} scenarios` : 
          `HTTP ${directResponse.status}: ${directData.message || 'Unknown error'}`,
        data: {
          status: directResponse.status,
          scenarios: directData.scenarios || [],
          responseKeys: Object.keys(directData || {})
        },
        rawResponse: directData
      });
    } catch (error: any) {
      tests.push({
        name: "Direct API Call - Available Scenarios",
        status: 'error',
        message: `Network Error: ${error.message}`,
        data: { error: error.toString() }
      });
    }

    // Test 3: Using apiRequest helper
    try {
      console.log('🔍 Testing with apiRequest helper...');
      const helperResponse = await apiRequest('GET', `/api/ecos/available-scenarios?email=${encodeURIComponent(email)}`);
      console.log('🔍 ApiRequest response:', helperResponse);
      
      tests.push({
        name: "ApiRequest Helper - Available Scenarios",
        status: helperResponse?.scenarios ? 'success' : 'warning',
        message: helperResponse?.scenarios ? 
          `Found ${helperResponse.scenarios.length} scenarios via helper` : 
          'No scenarios in helper response',
        data: {
          responseKeys: Object.keys(helperResponse || {}),
          scenariosCount: helperResponse?.scenarios?.length || 0,
          scenarios: helperResponse?.scenarios || []
        },
        rawResponse: helperResponse
      });
    } catch (error: any) {
      tests.push({
        name: "ApiRequest Helper - Available Scenarios",
        status: 'error',
        message: `Helper Error: ${error.message}`,
        data: { error: error.toString() }
      });
    }

    // Test 4: Test sessions endpoint
    try {
      console.log('🔍 Testing sessions endpoint...');
      const sessionsResponse = await apiRequest('GET', `/api/ecos/sessions?email=${encodeURIComponent(email)}`);
      console.log('🔍 Sessions response:', sessionsResponse);
      
      tests.push({
        name: "Sessions Endpoint",
        status: 'success',
        message: `Found ${sessionsResponse.sessions?.length || 0} sessions`,
        data: {
          sessions: sessionsResponse.sessions || []
        }
      });
    } catch (error: any) {
      tests.push({
        name: "Sessions Endpoint",
        status: 'error',
        message: `Sessions Error: ${error.message}`,
        data: { error: error.toString() }
      });
    }

    // Test 5: Test server connectivity
    try {
      console.log('🔍 Testing server connectivity...');
      const pingResponse = await fetch('/api/status?email=test@example.com');
      const pingData = await pingResponse.json();
      
      tests.push({
        name: "Server Connectivity",
        status: pingResponse.ok ? 'success' : 'error',
        message: pingResponse.ok ? 
          `Server responding (${pingResponse.status})` : 
          `Server error (${pingResponse.status})`,
        data: pingData
      });
    } catch (error: any) {
      tests.push({
        name: "Server Connectivity",
        status: 'error',
        message: `Connection Error: ${error.message}`,
        data: { error: error.toString() }
      });
    }

    // Test 6: Check browser environment
    tests.push({
      name: "Browser Environment",
      status: 'success',
      message: `Running in ${typeof window !== 'undefined' ? 'browser' : 'server'} environment`,
      data: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
        currentUrl: typeof window !== 'undefined' ? window.location.href : 'N/A',
        baseUrl: typeof window !== 'undefined' ? window.location.origin : 'N/A'
      }
    });

    setResults({
      tests,
      isRunning: false,
      completedAt: new Date()
    });

    console.log('🔍 Diagnostic completed. Results:', tests);
  };

  useEffect(() => {
    if (email) {
      runDiagnostic();
    }
  }, [email]);

  const getStatusIcon = (status: DiagnosticTest['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />;
    }
  };

  const getStatusColor = (status: DiagnosticTest['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Diagnostic Étudiant ECOS</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Email testé: {email}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                onClick={runDiagnostic} 
                disabled={results.isRunning}
                variant="outline"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${results.isRunning ? 'animate-spin' : ''}`} />
                {results.isRunning ? 'Test en cours...' : 'Relancer le Test'}
              </Button>
              {results.completedAt && (
                <Badge variant="outline">
                  Testé à {results.completedAt.toLocaleTimeString()}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {results.tests.map((test, index) => (
              <Card key={index} className={`border ${getStatusColor(test.status)}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {getStatusIcon(test.status)}
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{test.name}</h4>
                      <p className="text-sm text-gray-600 mt-1">{test.message}</p>
                      
                      {test.data && (
                        <details className="mt-2">
                          <summary className="text-xs text-blue-600 cursor-pointer hover:underline">
                            Voir les détails
                          </summary>
                          <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto max-h-32">
                            {JSON.stringify(test.data, null, 2)}
                          </pre>
                        </details>
                      )}

                      {test.rawResponse && (
                        <details className="mt-2">
                          <summary className="text-xs text-purple-600 cursor-pointer hover:underline">
                            Réponse brute du serveur
                          </summary>
                          <pre className="text-xs bg-purple-50 p-2 rounded mt-2 overflow-auto max-h-40">
                            {JSON.stringify(test.rawResponse, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {results.tests.length === 0 && !results.isRunning && (
            <div className="text-center py-8 text-gray-500">
              Cliquez sur "Relancer le Test" pour démarrer le diagnostic
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      {results.tests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Résumé du Diagnostic</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {results.tests.filter(t => t.status === 'success').length}
                </div>
                <div className="text-sm text-gray-600">Tests Réussis</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {results.tests.filter(t => t.status === 'warning').length}
                </div>
                <div className="text-sm text-gray-600">Avertissements</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {results.tests.filter(t => t.status === 'error').length}
                </div>
                <div className="text-sm text-gray-600">Erreurs</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
