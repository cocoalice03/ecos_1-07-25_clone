
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AuthDebuggerProps {
  email: string;
}

export default function AuthDebugger({ email }: AuthDebuggerProps) {
  const [authInfo, setAuthInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const debugAuth = async () => {
    setLoading(true);
    try {
      // Test different ways the email might be sent
      const tests = [
        { name: "Query param", url: `/api/ecos/scenarios?email=${encodeURIComponent(email)}` },
        { name: "Direct admin check", url: `/api/diagnostic/auth-check?email=${encodeURIComponent(email)}` }
      ];

      const results = [];
      
      for (const test of tests) {
        try {
          const response = await fetch(test.url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          let data;
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            data = await response.json();
          } else {
            data = await response.text();
          }
          
          results.push({
            test: test.name,
            url: test.url,
            status: response.status,
            statusText: response.statusText,
            response: typeof data === 'object' ? JSON.stringify(data, null, 2) : data,
            isJson: typeof data === 'object'
          });
        } catch (error) {
          results.push({
            test: test.name,
            url: test.url,
            error: error.message,
          });
        }
      }

      setAuthInfo({
        email: email,
        emailType: typeof email,
        emailLength: email.length,
        emailLowerCase: email.toLowerCase(),
        tests: results,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      setAuthInfo({
        error: error.message || String(error),
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Authorization Debugger</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={debugAuth} disabled={loading}>
            {loading ? "Testing..." : "Debug Authorization"}
          </Button>
        </div>
        
        {authInfo && (
          <div className="bg-gray-50 p-4 rounded text-sm">
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(authInfo, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
