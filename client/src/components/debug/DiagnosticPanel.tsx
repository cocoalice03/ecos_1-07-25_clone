
import React, { useState, useEffect } from 'react';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { AlertTriangle, CheckCircle, XCircle, RefreshCw } from "lucide-react";

interface DiagnosticPanelProps {
  email: string;
}

export default function DiagnosticPanel({ email }: DiagnosticPanelProps) {
  const [diagnosticHistory, setDiagnosticHistory] = useState<any[]>([]);
  const [refreshCount, setRefreshCount] = useState(0);

  // Fetch dashboard data with detailed logging
  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError, refetch } = useQuery({
    queryKey: ['diagnostic-dashboard', email, refreshCount],
    queryFn: async () => {
      const timestamp = new Date().toISOString();
      console.log(`[DIAGNOSTIC ${timestamp}] Starting fetch for email:`, email);
      
      if (!email) {
        throw new Error('Email is required');
      }
      
      try {
        const [scenarios, sessions] = await Promise.all([
          apiRequest('GET', `/api/ecos/scenarios?email=${email}`),
          apiRequest('GET', `/api/ecos/sessions?email=${email}`)
        ]);
        
        const result = {
          scenarios: scenarios.scenarios || [],
          sessions: sessions.sessions || [],
          timestamp,
          email,
          scenariosRaw: scenarios,
          sessionsRaw: sessions
        };
        
        console.log(`[DIAGNOSTIC ${timestamp}] Raw scenarios response:`, scenarios);
        console.log(`[DIAGNOSTIC ${timestamp}] Raw sessions response:`, sessions);
        console.log(`[DIAGNOSTIC ${timestamp}] Processed result:`, result);
        
        // Add to diagnostic history
        setDiagnosticHistory(prev => [
          {
            timestamp,
            success: true,
            data: result,
            scenarios: result.scenarios,
            sessions: result.sessions,
            scenariosCount: result.scenarios.length,
            sessionsCount: result.sessions.length
          },
          ...prev.slice(0, 9) // Keep last 10 entries
        ]);
        
        return result;
      } catch (error) {
        console.error(`[DIAGNOSTIC ${timestamp}] Error:`, error);
        setDiagnosticHistory(prev => [
          {
            timestamp,
            success: false,
            error: error.message,
            email
          },
          ...prev.slice(0, 9)
        ]);
        throw error;
      }
    },
    enabled: !!email,
    retry: 1,
    refetchOnWindowFocus: false
  });

  // Calculate stats with detailed logging
  const diagnosticStats = React.useMemo(() => {
    const timestamp = new Date().toISOString();
    console.log(`[DIAGNOSTIC ${timestamp}] Calculating stats...`);
    console.log(`[DIAGNOSTIC ${timestamp}] Dashboard data:`, dashboardData);
    console.log(`[DIAGNOSTIC ${timestamp}] Dashboard loading:`, dashboardLoading);
    console.log(`[DIAGNOSTIC ${timestamp}] Dashboard error:`, dashboardError);
    
    if (!dashboardData) {
      console.log(`[DIAGNOSTIC ${timestamp}] No dashboard data available`);
      return null;
    }
    
    const scenarios = Array.isArray(dashboardData.scenarios) ? dashboardData.scenarios : [];
    const sessions = Array.isArray(dashboardData.sessions) ? dashboardData.sessions : [];
    
    console.log(`[DIAGNOSTIC ${timestamp}] Scenarios array:`, scenarios);
    console.log(`[DIAGNOSTIC ${timestamp}] Sessions array:`, sessions);
    
    const stats = {
      totalScenarios: scenarios.length,
      activeSessions: sessions.filter((s: any) => s && s.status === 'in_progress').length,
      completedSessions: sessions.filter((s: any) => s && s.status === 'completed').length,
      totalStudents: new Set(sessions.filter((s: any) => s && s.studentEmail).map((s: any) => s.studentEmail)).size,
      timestamp,
      rawData: {
        scenarios,
        sessions,
        dashboardData
      }
    };
    
    console.log(`[DIAGNOSTIC ${timestamp}] Calculated stats:`, stats);
    return stats;
  }, [dashboardData, dashboardLoading, dashboardError]);

  const handleForceRefresh = () => {
    console.log('[DIAGNOSTIC] Force refresh triggered');
    setRefreshCount(prev => prev + 1);
    refetch();
  };

  // Monitor component state changes
  useEffect(() => {
    const timestamp = new Date().toISOString();
    console.log(`[DIAGNOSTIC ${timestamp}] Component state changed:`, {
      email,
      dashboardLoading,
      dashboardError: dashboardError?.message,
      hasData: !!dashboardData,
      statsCalculated: !!diagnosticStats
    });
  }, [email, dashboardLoading, dashboardError, dashboardData, diagnosticStats]);

  return (
    <div className="space-y-6 p-6 bg-gray-50 border rounded-lg">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">🔍 Panneau de Diagnostic</h2>
        <Button onClick={handleForceRefresh} size="sm" className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Force Refresh ({refreshCount})
        </Button>
      </div>

      {/* Current State */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            État Actuel
            {dashboardLoading ? (
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                Chargement
              </Badge>
            ) : dashboardError ? (
              <Badge variant="outline" className="bg-red-50 text-red-700">
                <XCircle className="w-3 h-3 mr-1" />
                Erreur
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-green-50 text-green-700">
                <CheckCircle className="w-3 h-3 mr-1" />
                OK
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Email:</strong> {email || 'NON DÉFINI'}
            </div>
            <div>
              <strong>Timestamp:</strong> {new Date().toLocaleTimeString()}
            </div>
            <div>
              <strong>Dashboard Loading:</strong> {dashboardLoading ? 'OUI' : 'NON'}
            </div>
            <div>
              <strong>Dashboard Error:</strong> {dashboardError ? dashboardError.message : 'AUCUNE'}
            </div>
            <div>
              <strong>Has Data:</strong> {dashboardData ? 'OUI' : 'NON'}
            </div>
            <div>
              <strong>Stats Calculated:</strong> {diagnosticStats ? 'OUI' : 'NON'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Raw Data Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Analyse des Données Brutes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Dashboard Data:</h4>
              <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-32">
                {JSON.stringify(dashboardData, null, 2)}
              </pre>
            </div>
            
            {dashboardData && (
              <>
                <div>
                  <h4 className="font-medium mb-2">Scenarios ({dashboardData.scenarios?.length || 0}):</h4>
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-32">
                    {JSON.stringify(dashboardData.scenarios, null, 2)}
                  </pre>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Sessions ({dashboardData.sessions?.length || 0}):</h4>
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-32">
                    {JSON.stringify(dashboardData.sessions, null, 2)}
                  </pre>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Debugging */}
      {diagnosticStats && (
        <Card>
          <CardHeader>
            <CardTitle>Calcul des Statistiques</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-3 rounded">
                <div className="text-sm text-blue-600">Total Scénarios</div>
                <div className="text-2xl font-bold text-blue-900">{diagnosticStats.totalScenarios}</div>
              </div>
              <div className="bg-green-50 p-3 rounded">
                <div className="text-sm text-green-600">Sessions Actives</div>
                <div className="text-2xl font-bold text-green-900">{diagnosticStats.activeSessions}</div>
              </div>
              <div className="bg-purple-50 p-3 rounded">
                <div className="text-sm text-purple-600">Sessions Terminées</div>
                <div className="text-2xl font-bold text-purple-900">{diagnosticStats.completedSessions}</div>
              </div>
              <div className="bg-orange-50 p-3 rounded">
                <div className="text-sm text-orange-600">Étudiants Uniques</div>
                <div className="text-2xl font-bold text-orange-900">{diagnosticStats.totalStudents}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des Requêtes ({diagnosticHistory.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-64 overflow-auto">
            {diagnosticHistory.map((entry, index) => (
              <div key={index} className={`p-2 rounded text-sm ${entry.success ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="flex justify-between items-center">
                  <span className="font-medium">
                    {entry.success ? '✅' : '❌'} {entry.timestamp}
                  </span>
                  {entry.success && (
                    <span className="text-xs">
                      {entry.scenariosCount} scénarios, {entry.sessionsCount} sessions
                    </span>
                  )}
                </div>
                {!entry.success && (
                  <div className="text-red-600 text-xs mt-1">{entry.error}</div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Network Status */}
      <Card>
        <CardHeader>
          <CardTitle>État du Réseau & Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Connexion:</strong> {navigator.onLine ? 'CONNECTÉ' : 'DÉCONNECTÉ'}
            </div>
            <div>
              <strong>User Agent:</strong> {navigator.userAgent.substring(0, 50)}...
            </div>
            <div>
              <strong>Timezone:</strong> {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </div>
            <div>
              <strong>Language:</strong> {navigator.language}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
