
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";

interface EcosDebuggerProps {
  email: string;
}

export default function EcosDebugger({ email }: EcosDebuggerProps) {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runDiagnostic = async () => {
    setLoading(true);
    try {
      console.log("Testing ECOS scenarios endpoint with email:", email);
      
      // Test the scenarios endpoint
      const response = await fetch(`/api/ecos/scenarios?email=${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.text();
      
      setDebugInfo({
        email: email,
        requestUrl: `/api/ecos/scenarios?email=${encodeURIComponent(email)}`,
        status: response.status,
        statusText: response.statusText,
        responseHeaders: Object.fromEntries(response.headers.entries()),
        responseBody: data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      setDebugInfo({
        email: email,
        error: error.message || String(error),
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          ECOS Scenarios Debug Info
          <Button onClick={runDiagnostic} disabled={loading}>
            {loading ? "Testing..." : "Run Diagnostic"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <strong>Current Email:</strong> <Badge variant="outline">{email}</Badge>
          </div>
          
          {debugInfo && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Diagnostic Results:</h3>
              <pre className="text-xs overflow-auto max-h-96">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
