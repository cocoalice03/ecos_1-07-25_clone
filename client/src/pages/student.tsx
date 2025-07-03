import { useState } from "react";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Clock, CheckCircle2, AlertCircle, BarChart3, FileText, Calendar, CheckCircle, BookOpen, TrendingUp } from "lucide-react";
import PatientSimulator from "@/components/ecos/PatientSimulator";
import EvaluationReport from "@/components/ecos/EvaluationReport";
import StudentDiagnostic from "@/components/debug/StudentDiagnostic";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";

interface StudentPageProps {
  email: string;
}

export default function StudentPage({ email }: StudentPageProps) {
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [viewingReport, setViewingReport] = useState<number | null>(null);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);

  // Check for scenario parameter in URL
  const urlParams = new URLSearchParams(window.location.search);
  const scenarioParam = urlParams.get('scenario');

  // Decode email if it comes from URL (in case it's URL encoded)
  const decodedEmail = email ? decodeURIComponent(email) : email;

  // Auto-create student account when accessing via URL
  React.useEffect(() => {
    const autoCreateAccount = async () => {
      if (decodedEmail && !accountCreated) {
        try {
          console.log('🚀 Auto-creating student account for:', decodedEmail);

          const response = await apiRequest('POST', '/api/student/auto-register', {
            email: decodedEmail
          });

          console.log('✅ Student account created/updated:', response);
          
          // If this is a new user, also create webhook session for integration
          if (response.isNewUser) {
            try {
              await apiRequest('POST', '/api/webhook', {
                email: decodedEmail
              });
              console.log('🔗 Webhook session created for new user:', decodedEmail);
            } catch (webhookError) {
              console.log('⚠️ Webhook integration warning:', webhookError);
            }
          }
          
          setAccountCreated(true);
        } catch (error) {
          console.error('❌ Error auto-creating student account:', error);
          // Continue anyway - the existing fallback in available-scenarios will handle it
          setAccountCreated(true);
        }
      }
    };

    autoCreateAccount();
  }, [decodedEmail, accountCreated]);

  // Fetch available scenarios from student endpoint (filtered by training sessions)
  const { data: studentData, isLoading: scenariosLoading } = useQuery({
    queryKey: ['student-scenarios', decodedEmail],
    queryFn: async () => {
      console.log('Fetching available scenarios for email:', decodedEmail);
      const response = await apiRequest('GET', `/api/student/available-scenarios?email=${encodeURIComponent(decodedEmail)}`);
      console.log('Available scenarios response:', response);
      console.log('Number of scenarios received:', response.scenarios?.length || 0);
      return response;
    },
    enabled: !!decodedEmail,
  });

  const scenarios = studentData?.scenarios || [];
  const trainingSessions = studentData?.trainingSessions || [];

  // Fetch student sessions
  const { data: sessions, isLoading: sessionsLoading, refetch: refetchSessions } = useQuery({
    queryKey: ['student-sessions', decodedEmail],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/ecos/sessions?email=${decodedEmail}`);
      return response.sessions || [];
    }
  });


  // Start session mutation
  const startSessionMutation = useMutation({
    mutationFn: async (scenarioId: number) => {
      console.log('Starting session with decoded email:', decodedEmail, 'and scenario:', scenarioId);
      return apiRequest('POST', '/api/ecos/sessions', {
        email: decodedEmail,
        scenarioId
      });
    },
    onSuccess: (data) => {
      setActiveSessionId(data.sessionId);
      refetchSessions();
    }
  });

  const handleStartSession = (scenarioId: number) => {
    startSessionMutation.mutate(scenarioId);
  };

  // Auto-start session if scenario parameter is provided in URL
  React.useEffect(() => {
    if (scenarioParam && !activeSessionId && scenarios && scenarios.length > 0) {
      const scenarioId = parseInt(scenarioParam);
      const scenarioExists = scenarios.find((s: any) => s.id === scenarioId);
      if (scenarioExists) {
        console.log('Auto-starting scenario:', scenarioId);
        handleStartSession(scenarioId);
      }
    }
  }, [scenarioParam, scenarios, activeSessionId]);

  const handleSessionEnd = () => {
    setActiveSessionId(null);
    refetchSessions();

    // Clear the scenario parameter from URL to prevent auto-restart
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('scenario')) {
      urlParams.delete('scenario');
      const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
      window.history.replaceState({}, '', newUrl);
    }
  };

  const handleViewReport = (sessionId: number) => {
    setViewingReport(sessionId);
  };

  // If viewing diagnostic
  if (showDiagnostic) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 mb-6">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">Diagnostic Étudiant</h1>
              <Button variant="outline" onClick={() => setShowDiagnostic(false)}>
                Retour au Dashboard
              </Button>
            </div>
          </div>
        </div>
        <StudentDiagnostic email={decodedEmail} />
      </div>
    );
  }

  // If viewing report
  if (viewingReport) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 mb-6">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">Rapport d'Évaluation</h1>
              <Button variant="outline" onClick={() => setViewingReport(null)}>
                Retour au Dashboard
              </Button>
            </div>
          </div>
        </div>
        <EvaluationReport sessionId={viewingReport} email={decodedEmail} />
      </div>
    );
  }

  // If in active session
  if (activeSessionId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PatientSimulator 
          sessionId={activeSessionId} 
          email={decodedEmail} 
          onSessionEnd={handleSessionEnd}
        />
      </div>
    );
  }

  const stats = {
    completedSessions: sessions?.filter((s: any) => s.status === 'completed').length || 0,
    inProgressSessions: sessions?.filter((s: any) => s.status === 'in_progress').length || 0,
    availableScenarios: scenarios?.length || 0
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard Étudiant ECOS</h1>
              <p className="text-gray-600">Bienvenue, {decodedEmail}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Mode Étudiant
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section - Main Section */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <section className="hero bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg mb-8">
          <div className="px-6 py-12">
            <div className="hero-content flex items-center gap-12">
              <div className="flex-1">
                <div className="hero-text">
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">L'Avenir de la Formation Médicale</h2>
                  <p className="text-gray-600 text-lg leading-relaxed mb-6">
                    Plateforme d'apprentissage nouvelle génération avec simulations IA, évaluations intelligentes et suivi personnalisé pour les professionnels de santé
                  </p>
                </div>
              </div>
              <div className="flex-1">
                <img 
                  src="/images/happy_student.jpg"
                  alt="Étudiant heureux"
                  className="w-full h-64 object-cover rounded-lg shadow-lg"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Scénarios Disponibles</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.availableScenarios}</p>
                </div>
                <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden">
                  <img 
                    src="/images/cahier.png"
                    alt="Scénarios disponibles"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Sessions en Cours</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.inProgressSessions}</p>
                </div>
                <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden">
                  <img 
                    src="/images/horloge.png"
                    alt="Sessions en cours"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Sessions Terminées</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.completedSessions}</p>
                </div>
                <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden">
                  <img 
                    src="/images/vraie.png"
                    alt="Sessions terminées"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="scenarios" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-20 p-2">
            <TabsTrigger value="scenarios" className="h-16 px-8 py-4 mx-1 tabs-trigger-enhanced">Nouveaux Examens</TabsTrigger>
            <TabsTrigger value="history" className="h-16 px-8 py-4 mx-1 tabs-trigger-enhanced">Historique</TabsTrigger>
          </TabsList>

          <TabsContent value="scenarios" className="mt-6">
          {/* Training Sessions Info */}
          {!activeSessionId && !viewingReport && trainingSessions?.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Sessions de Formation Actives
                </CardTitle>
                <CardDescription>
                  Vous participez actuellement aux sessions de formation suivantes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {trainingSessions.map((session: any) => (
                    <div key={session.sessionId} className="flex items-center gap-2 p-2 bg-green-50 rounded border border-green-200">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">{session.sessionTitle}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Available Scenarios */}
          {!activeSessionId && !viewingReport && (
            <Card>
              <CardHeader>
                <CardTitle>Scénarios Disponibles</CardTitle>
              </CardHeader>
              <CardContent>
                {scenariosLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => (
                      <Card key={i} className="animate-pulse">
                        <CardContent className="p-6">
                          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-full mb-4"></div>
                          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : scenarios?.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun scénario disponible</h3>
                      <p className="text-gray-600">
                        {studentData?.message || "Aucun scénario ECOS n'est actuellement disponible pour vous."}
                      </p>
                      {trainingSessions?.length === 0 && (
                        <p className="text-sm text-gray-500 mt-2">
                          Vous n'êtes inscrit à aucune session de formation active. Contactez votre enseignant pour plus d'informations.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {scenarios?.map((scenario: any) => (
                      <div key={scenario.id} className="feature-card feature-card-overlay">
                        {/* Photo panoramique en haut */}
                        <div className="relative">
                          {scenario.id === 1 ? (
                            <img 
                              src="/images/douleur_thoracique.png"
                              className="feature-header-image"
                              alt="Consultation d'urgence - Douleur thoracique"
                            />
                          ) : scenario.id === 2 ? (
                            <img 
                              src="/images/douleur_thoracic.png"
                              className="feature-header-image"
                              alt="Examen de l'épaule douloureuse"
                            />
                          ) : scenario.id === 3 ? (
                            <img 
                              src="/images/trauma_poignet.png"
                              className="feature-header-image"
                              alt="Traumatisme du poignet"
                            />
                          ) : scenario.id === 4 ? (
                            <img 
                              src="/images/arthrose_de_la_main.png"
                              className="feature-header-image"
                              alt="Arthrose de la main"
                            />
                          ) : scenario.id === 5 ? (
                            <img 
                              src="/images/syndrome_du_canal_carpien.png"
                              className="feature-header-image"
                              alt="Syndrome du canal carpien"
                            />
                          ) : (
                            <img 
                              src="/images/cahier.png"
                              className="feature-header-image"
                              alt="Scénario d'examen"
                            />
                          )}

                          {/* Overlay qui apparaît au hover */}
                          <div className="feature-overlay-content">
                            <div className="feature-overlay-text">
                              <Play className="w-8 h-8 mx-auto mb-2" />
                              Commencer l'Examen
                            </div>
                          </div>
                        </div>

                        {/* Contenu de la carte */}
                        <div className="feature-content">
                          <h3 className="feature-title">{scenario.title}</h3>
                          <p className="feature-description line-clamp-3">
                            {scenario.description}
                          </p>
                          <Button
                            onClick={() => handleStartSession(scenario.id)}
                            disabled={startSessionMutation.isPending}
                            className="w-full mt-4"
                            style={{ background: 'hsl(var(--primary) / 0.9)' }}
                          >
                            <Play className="w-4 h-4 mr-2" />
                            {startSessionMutation.isPending ? "Démarrage..." : "Commencer l'Examen"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Historique des Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                {sessionsLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="border border-gray-200 rounded-lg p-4 animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                      </div>
                    ))}
                  </div>
                ) : sessions?.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Aucune session trouvée</p>
                ) : (
                  <div className="space-y-4">
                    {sessions?.map((session: any) => (
                      <div key={session.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-medium">{session.scenarioTitle}</h4>
                            <p className="text-sm text-gray-500">
                              {session.status === 'completed' ? 'Terminée' : 'En cours'} • {' '}
                              {new Date(session.startTime).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge 
                              variant="outline" 
                              className={session.status === 'completed' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}
                            >
                              {session.status === 'completed' ? 'Terminée' : 'En cours'}
                            </Badge>
                            {session.status === 'completed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewReport(session.id)}
                              >
                                <TrendingUp className="w-4 h-4 mr-1" />
                                Voir Résultats
                              </Button>
                            )}
                            {session.status === 'in_progress' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setActiveSessionId(session.id)}
                              >
                                <Play className="w-4 h-4 mr-1" />
                                Reprendre
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}