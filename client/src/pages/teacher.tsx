import React, { useState, useEffect } from 'react';
import { FirestoreService } from '../lib/firestore.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, BookOpen, TrendingUp, Clock, Play, Pause, RotateCcw, Wand2, Calendar, UserPlus, CheckCircle } from "lucide-react";
import { useDashboardData, useAvailableIndexes, useTeacherStudents } from '@/lib/api';
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import TeacherAssistant from "@/components/ecos/TeacherAssistant";
import { AdminButton } from "@/components/layout/AdminButton";
import { apiRequest } from "@/lib/queryClient";
import TrainingSessionsTab from "@/components/ecos/TrainingSessionsTab";

interface ScenarioCreationFormProps {
  email: string;
  onSuccess: () => void;
  editingScenario?: any;
  onCancelEdit?: () => void;
}

function ScenarioCreationForm({ email, onSuccess, editingScenario, onCancelEdit }: ScenarioCreationFormProps) {
  const { data: availableIndexes } = useAvailableIndexes(email);
  const [formData, setFormData] = useState({
    title: editingScenario?.title || "",
    description: editingScenario?.description || "",
    patientPrompt: editingScenario?.patientPrompt || "",
    evaluationCriteria: editingScenario?.evaluationCriteria ? JSON.stringify(editingScenario.evaluationCriteria, null, 2) : "",
    pineconeIndex: editingScenario?.pineconeIndex || "",
    criteriaText: editingScenario?.criteriaText || ""
  });

  // Update form data when editing scenario changes
  useEffect(() => {
    if (editingScenario) {
      setFormData({
        title: editingScenario.title || "",
        description: editingScenario.description || "",
        patientPrompt: editingScenario.patientPrompt || "",
        evaluationCriteria: editingScenario.evaluationCriteria ? JSON.stringify(editingScenario.evaluationCriteria, null, 2) : "",
        pineconeIndex: editingScenario.pineconeIndex || "",
        criteriaText: editingScenario?.criteriaText || ""
      });
    }
  }, [editingScenario]);

  const queryClient = useQueryClient();

  // Create/Update scenario mutation
  const createScenarioMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingScenario) {
        console.log("Updating scenario:", { email, id: editingScenario.id, ...data });
        return apiRequest('PUT', `/api/ecos/scenarios/${editingScenario.id}`, {
          email,
          ...data
        });
      } else {
        console.log("Creating scenario:", { email, ...data });
        return apiRequest('POST', '/api/ecos/scenarios', {
          email,
          ...data
        });
      }
    },
    onSuccess: (response) => {
      console.log(`Scenario ${editingScenario ? 'updated' : 'created'} successfully:`, response);
      queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
      setFormData({ title: "", description: "", patientPrompt: "", evaluationCriteria: "", pineconeIndex: "", criteriaText: "" });
      if (onCancelEdit) onCancelEdit();
      onSuccess();
      alert(`Scénario ${editingScenario ? 'modifié' : 'créé'} avec succès !`);
    },
    onError: (error) => {
      console.error(`Error ${editingScenario ? 'updating' : 'creating'} scenario:`, error);
      alert(`Erreur lors de la ${editingScenario ? 'modification' : 'création'} du scénario. Veuillez réessayer.`);
    }
  });

  // Generate prompt mutation
  const generatePromptMutation = useMutation({
    mutationFn: async (input: string) => {
      return apiRequest('POST', '/api/ecos/prompt-assistant', {
        email,
        input,
        contextDocs: []
      });
    },
    onSuccess: (data) => {
      setFormData(prev => ({ ...prev, patientPrompt: data.prompt }));
    }
  });

  const generateCriteriaMutation = useMutation({
    mutationFn: async () => {
      if (!formData.criteriaText) {
        throw new Error('Veuillez décrire les critères d\'évaluation');
      }

      return apiRequest('POST', '/api/ecos/generate-criteria', {
        email,
        description: formData.criteriaText,
      });
    },
    onSuccess: (data) => {
      setFormData(prev => ({
        ...prev,
        evaluationCriteria: JSON.stringify(data.criteria, null, 2)
      }));
    },
    onError: (error) => {
      console.error('Error generating criteria:', error);
      alert('Erreur lors de la génération des critères: ' + error.message);
    }
  });

  const handleGenerateCriteria = () => {
    generateCriteriaMutation.mutate();
  };

  const handleCreateScenario = () => {
    if (!formData.title || !formData.description) {
      alert("Veuillez remplir au moins le titre et la description du scénario.");
      return;
    }

    let criteria = undefined;

    if (formData.evaluationCriteria && formData.evaluationCriteria.trim()) {
      try {
        criteria = JSON.parse(formData.evaluationCriteria);
      } catch (error) {
        alert("Erreur : Les critères d'évaluation doivent être au format JSON valide. Exemple : {\"anamnese\": 20, \"examen_physique\": 30}");
        return;
      }
    }

    createScenarioMutation.mutate({
      title: formData.title,
      description: formData.description,
      patientPrompt: formData.patientPrompt || undefined,
      evaluationCriteria: criteria,
      pineconeIndex: formData.pineconeIndex || undefined
    });
  };

  const handleCancel = () => {
    setFormData({ title: "", description: "", patientPrompt: "", evaluationCriteria: "", pineconeIndex: "", criteriaText: "" });
    if (onCancelEdit) onCancelEdit();
  };

  const handleGeneratePrompt = () => {
    if (formData.description) {
      generatePromptMutation.mutate(formData.description);
    } else {
      alert("Veuillez d'abord saisir une description du scénario.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="title">Titre du Scénario *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Ex: Consultation cardiologique - Douleur thoracique"
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="description">Description du Scénario *</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Décrivez le contexte clinique : patient, symptômes, antécédents, situation d'urgence, etc."
          rows={4}
          className="mt-1"
        />
        <p className="text-xs text-gray-500 mt-1">
          Décrivez précisément la situation clinique que l'étudiant devra gérer.
        </p>
      </div>

      <div>
        <Label htmlFor="pineconeIndex">Index de Connaissances (Optionnel)</Label>
        <Select value={formData.pineconeIndex} onValueChange={(value) => setFormData(prev => ({ ...prev, pineconeIndex: value }))}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Sélectionner un index Pinecone" />
          </SelectTrigger>
          <SelectContent>
            {availableIndexes?.map((index: any) => (
              <SelectItem key={index.name} value={index.name}>
                {index.name} ({index.status})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 mt-1">
          Choisissez l'index Pinecone contenant les connaissances spécifiques pour ce scénario.
        </p>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <Label htmlFor="patientPrompt">Prompt du Patient Virtuel</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGeneratePrompt}
            disabled={!formData.description || generatePromptMutation.isPending}
          >
            <Wand2 className="w-4 h-4 mr-1" />
            {generatePromptMutation.isPending ? "Génération..." : "Générer avec IA"}
          </Button>
        </div>
        <Textarea
          id="patientPrompt"
          value={formData.patientPrompt}
          onChange={(e) => setFormData(prev => ({ ...prev, patientPrompt: e.target.value }))}
          placeholder="Instructions détaillées pour l'IA qui jouera le rôle du patient. Incluez la personnalité, les réponses aux questions, l'état émotionnel, etc."
          rows={8}
          className="mt-1"
        />
        <p className="text-xs text-gray-500 mt-1">
          Si laissé vide, un prompt sera généré automatiquement basé sur la description.
        </p>
      </div>

      <div>
        <Label htmlFor="criteriaText">Décrivez les Critères d'Évaluation</Label>
        <Textarea
          id="criteriaText"
          value={formData.criteriaText || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, criteriaText: e.target.value }))}
          placeholder="Décrivez les critères que vous souhaitez évaluer. Par exemple: L'étudiant doit être capable de mener une anamnèse complète, réaliser un examen physique systématique, poser des questions pertinentes sur les antécédents, établir un diagnostic différentiel..."
          rows={3}
          className="mt-1"
        />

        <Button
          onClick={handleGenerateCriteria}
          disabled={!formData.criteriaText || generateCriteriaMutation.isPending}
          variant="outline"
          className="mt-2"
        >
          {generateCriteriaMutation.isPending ? "Génération..." : "Générer les Critères JSON"}
        </Button>

        <div className="mt-4">
          <Label htmlFor="evaluationCriteria">Critères d'Évaluation (JSON généré)</Label>
          <Textarea
            id="evaluationCriteria"
            value={formData.evaluationCriteria}
            onChange={(e) => setFormData(prev => ({ ...prev, evaluationCriteria: e.target.value }))}
            placeholder={`{
  "communication": 20,
  "anamnese": 25,
  "examen_physique": 25,
  "raisonnement_clinique": 30
}`}
            rows={6}
            className="mt-1 font-mono text-sm"
            readOnly={generateCriteriaMutation.isPending}
          />
          <p className="text-xs text-gray-500 mt-1">
            Critères générés automatiquement ou modifiés manuellement
          </p>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          onClick={handleCreateScenario}
          disabled={!formData.title || !formData.description || createScenarioMutation.isPending}
          className="flex-1"
        >
          {createScenarioMutation.isPending 
            ? (editingScenario ? "Modification en cours..." : "Création en cours...") 
            : (editingScenario ? "Modifier le Scénario" : "Créer le Scénario")
          }
        </Button>

        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={createScenarioMutation.isPending}
        >
          {editingScenario ? "Annuler" : "Réinitialiser"}
        </Button>
      </div>
    </div>
  );
}

interface TeacherPageProps {
  email?: string;
}

function TeacherPage({ email }: TeacherPageProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [editingScenario, setEditingScenario] = useState<any>(null);
  const [deletingScenario, setDeletingScenario] = useState<any>(null);
  const [viewingSessionDetails, setViewingSessionDetails] = useState<any>(null);
  const [viewingReport, setViewingReport] = useState<number | null>(null);

  // Add debugging for authentication issues - MUST be before any conditional returns
  React.useEffect(() => {
    if (!email) {
      console.warn('No email detected for teacher dashboard');
    }
  }, [email]);

  console.log('TeacherPage rendering with email:', email);

  const { data: dashboardData, error: dashboardError, isLoading: isDashboardLoading } = useDashboardData(email || '');
  const { data: assignedStudents, isLoading: isStudentsLoading } = useTeacherStudents(email || '');

  // Service Firestore déjà importé en haut du fichier
  // Fallback pour récupérer les scénarios si le dashboard échoue
  const { data: fallbackScenarios } = useQuery({
    queryKey: ['fallback-scenarios', email],
    queryFn: async () => {
      try {
        // Utilisation de FirestoreService au lieu de l'API backend
        const scenarios = await FirestoreService.getScenarios(email || '');
        return scenarios || [];
      } catch (error) {
        console.error('Fallback scenarios fetch failed:', error);
        return [];
      }
    },
    enabled: !!email && (!!dashboardError || !dashboardData?.scenarios?.length),
  });

  // Query pour récupérer les détails du rapport
  const { data: reportData, isLoading: isReportLoading } = useQuery({
    queryKey: ['session-report', viewingReport],
    queryFn: async () => {
      if (!viewingReport || !email) return null;
      return apiRequest('GET', `/api/ecos/sessions/${viewingReport}/report?email=${encodeURIComponent(email)}`);
    },
    enabled: !!viewingReport && !!email,
  });

  // Check if we have actual errors vs just partial data
  // La propriété partial est simulée dans les stats pour compatibilité
  const hasRealError = dashboardError || (dashboardData?.stats?.partial === true && dashboardData?.scenarios?.length === 0);

  console.log('Dashboard data:', dashboardData);
  console.log('Dashboard loading:', isDashboardLoading);
  console.log('Dashboard error:', dashboardError);

  // Provide fallback data structure
  const scenarios = dashboardData?.scenarios || fallbackScenarios || [];
  const sessions = dashboardData?.sessions || [];

  console.log('Scenarios:', scenarios);
  console.log('Sessions:', sessions);
  console.log('Dashboard stats from API:', dashboardData?.stats);

  // Use stats from API if available, otherwise calculate fallback
  const stats = dashboardData?.stats || {
    totalScenarios: scenarios.length,
    activeSessions: sessions.filter((s: any) => s.status === 'in_progress').length,
    completedSessions: sessions.filter((s: any) => s.status === 'completed').length,
    totalStudents: new Set(sessions.map((s: any) => s.student_id || s.studentEmail)).size
  };

  console.log('Final stats for display:', stats);

  const queryClient = useQueryClient();

  // Delete scenario mutation
  const deleteScenarioMutation = useMutation({
    mutationFn: async (scenarioId: number) => {
      return apiRequest('DELETE', `/api/ecos/scenarios/${scenarioId}?email=${encodeURIComponent(email || '')}`, { email });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
      setDeletingScenario(null);
      alert("Scénario supprimé avec succès !");
    },
    onError: (error) => {
      console.error("Error deleting scenario:", error);
      alert("Erreur lors de la suppression du scénario.");
    }
  });

  const handleDeleteScenario = (scenario: any) => {
    setDeletingScenario(scenario);
  };

  const confirmDelete = () => {
    if (deletingScenario) {
      deleteScenarioMutation.mutate(deletingScenario.id);
    }
  };

  const handleEditScenario = (scenario: any) => {
    setEditingScenario(scenario);
    setActiveTab('create');
  };

  const handleViewSessionDetails = (session: any) => {
    setViewingSessionDetails(session);
  };

  if (isDashboardLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  // Show error state but still render dashboard with fallback data
  if (dashboardError && !dashboardData) {
    console.error('Dashboard error:', dashboardError);
  }

  return (
    <>
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 border-b border-blue-200 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Tableau de bord Enseignant ECOS</h1>
              <p className="text-blue-100 text-lg">Gérez vos scénarios et suivez les progrès de vos étudiants</p>
              {email && <p className="text-sm text-blue-200 mt-2 font-medium">Connecté en tant que: {email}</p>}
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="bg-white/10 text-white border-white/20 backdrop-blur-sm px-4 py-2 text-sm font-medium">
                Mode Enseignant
              </Badge>
              <AdminButton email={email || ''} />
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section - Main Section */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <section className="hero bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl mb-8 border border-blue-100 shadow-sm">
          <div className="px-6 py-12">
            <div className="hero-content flex items-center gap-12">
              <div className="flex-1">
                <div className="hero-text">
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">Plateforme Pédagogique Avancée</h2>
                  <p className="text-gray-600 text-lg leading-relaxed mb-6">
                    Créez des scénarios ECOS immersifs, organisez vos sessions de formation et évaluez vos étudiants avec notre système intelligent basé sur l'IA
                  </p>
                </div>
              </div>
              <div className="flex-1">
                <img 
                  src="/images/teacher_professional.jpg"
                  alt="Enseignante professionnelle"
                  className="w-full h-64 object-cover rounded-lg shadow-lg"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Scénarios Actifs</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalScenarios}</p>
                </div>
                <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden">
                  <img 
                    src="/images/cahier.png"
                    alt="Scénarios actifs"
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
                  <p className="text-sm font-medium text-gray-600">Sessions Actives</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.activeSessions}</p>
                </div>
                <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden">
                  <img 
                    src="/images/horloge.png"
                    alt="Sessions actives"
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
                  <p className="text-sm font-medium text-gray-600">Sessions Complétées</p>
                  <span className="text-lg font-bold text-green-600">{stats?.completedSessions || 0}</span>
                </div>
                <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden">
                  <img 
                    src="/images/vraie.png"
                    alt="Sessions complétées"
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
                  <p className="text-sm font-medium text-gray-600">Étudiants Uniques</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalStudents}</p>
                </div>
                <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden bg-blue-50">
                  <Users className="w-8 h-8 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different sections */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-5 w-fit bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
            <TabsTrigger value="overview" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="scenarios" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200">Scénarios</TabsTrigger>
            <TabsTrigger value="create" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200">Créer</TabsTrigger>
            <TabsTrigger value="training-sessions" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200">Sessions Formation</TabsTrigger>
            <TabsTrigger value="sessions" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200">Sessions ECOS</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-sm bg-white">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold text-gray-900">Activité Récente</CardTitle>
                  <CardDescription className="text-sm text-gray-500">Dernières sessions des étudiants</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {sessions.length > 0 ? (
                    <div className="space-y-3">
                      {sessions.slice(0, 5).map((session: any) => (
                        <div 
                          key={session.id} 
                          className="flex items-center justify-between py-3 px-0 border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors rounded-sm"
                          onClick={() => session.status === 'completed' && setViewingReport(session.id)}
                        >
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 text-sm">Consultation #{session.id}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Étudiant: {session.studentEmail || 'Non défini'}
                            </p>
                          </div>
                          <Badge 
                            variant={session.status === 'completed' ? 'default' : 'secondary'}
                            className={`ml-3 px-3 py-1 text-xs font-medium rounded-full ${
                              session.status === 'completed' 
                                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {session.status === 'completed' ? 'Terminée' : 'En cours'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-400 text-sm">Aucune consultation récente</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm bg-white">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold text-gray-900">Performances</CardTitle>
                  <CardDescription className="text-sm text-gray-500">Statistiques des évaluations</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-gray-600">Taux de completion</span>
                      <span className="text-lg font-bold text-gray-900">
                        {sessions.length > 0 
                          ? Math.round(((stats?.completedSessions || 0) / sessions.length) * 100)
                          : 0}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-gray-600">Sessions actives</span>
                      <span className="text-lg font-bold text-gray-900">{stats?.activeSessions || 0}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-gray-600">Étudiants engagés</span>
                      <span className="text-lg font-bold text-gray-900">{stats?.totalStudents || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="scenarios">
            <Card className="border-0 shadow-sm bg-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900">Gestion des Scénarios</CardTitle>
                  <CardDescription className="text-sm text-gray-500 mt-1">Créez et gérez vos scénarios ECOS</CardDescription>
                </div>
                <Button 
                  onClick={() => setActiveTab('create')}
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Nouveau Scénario
                </Button>
              </CardHeader>
              <CardContent>
                {scenarios.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {scenarios.map((scenario: any) => (
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
                              Tester le Scénario
                            </div>
                          </div>
                        </div>

                        {/* Contenu de la carte */}
                        <div className="feature-content">
                          <h3 className="feature-title">{scenario.title || `Scénario ${scenario.id}`}</h3>
                          <p className="feature-description line-clamp-3">
                            {scenario.description || 'Description non disponible'}
                          </p>
                          {scenario.pineconeIndex && (
                            <Badge variant="outline" className="w-fit mt-2">
                              Index: {scenario.pineconeIndex}
                            </Badge>
                          )}
                          <div className="flex gap-2 mt-4">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => window.open(`/student/${encodeURIComponent(email || '')}?scenario=${scenario.id}`, '_blank')}
                              className="flex-1"
                            >
                              <Play className="h-4 w-4 mr-1" />
                              Tester
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleEditScenario(scenario)}
                            >
                              Modifier
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => handleDeleteScenario(scenario)}
                            >
                              Supprimer
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun scénario</h3>
                    <p className="text-gray-600 mb-4">Commencez par créer votre premier scénario ECOS</p>
                    <Button onClick={() => setActiveTab('create')}>
                      <BookOpen className="h-4 w-4 mr-2" />
                      Créer un scénario
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="create">
            <div className="space-y-6">
              <Card className="border-0 shadow-sm bg-white">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold text-gray-900">
                    {editingScenario ? "Modifier le Scénario ECOS" : "Créer un Nouveau Scénario ECOS"}
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-500 mt-1">
                    {editingScenario 
                      ? "Modifiez les détails de votre scénario d'examen clinique structuré"
                      : "Définissez un nouveau scénario d'examen clinique structuré"
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ScenarioCreationForm 
                    email={email || ''} 
                    onSuccess={() => {
                      setEditingScenario(null);
                      setActiveTab('scenarios');
                    }}
                    editingScenario={editingScenario}
                    onCancelEdit={() => {
                      setEditingScenario(null);
                      setActiveTab('scenarios');
                    }}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="training-sessions">
            <TrainingSessionsTab email={email || ''} />
          </TabsContent>

          <TabsContent value="sessions">
            <Card className="border-0 shadow-sm bg-white">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold text-gray-900">Sessions ECOS des Étudiants</CardTitle>
                <CardDescription className="text-sm text-gray-500 mt-1">Suivez les sessions d'examen en cours et terminées</CardDescription>
              </CardHeader>
              <CardContent>
                {isStudentsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Chargement des étudiants...</p>
                  </div>
                ) : assignedStudents && assignedStudents.length > 0 ? (
                  <div className="space-y-4">
                    {/* Group students by email */}
                    {Object.entries(
                      assignedStudents.reduce((acc: any, student: any) => {
                        if (!acc[student.studentEmail]) {
                          acc[student.studentEmail] = [];
                        }
                        acc[student.studentEmail].push(student);
                        return acc;
                      }, {})
                    ).map(([studentEmail, studentSessions]: [string, any]) => (
                      <div key={studentEmail} className="border border-gray-100 rounded-lg p-4 bg-white shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-medium text-gray-900">{studentEmail}</h4>
                            <p className="text-sm text-gray-500">
                              Session de formation: {studentSessions[0].trainingSessionTitle}
                            </p>
                          </div>
                          <Badge 
                            variant="outline"
                            className="bg-green-50 text-green-700 border-green-200"
                          >
                            <UserPlus className="w-3 h-3 mr-1" />
                            Assigné
                          </Badge>
                        </div>
                        
                        {/* Show ECOS sessions for this student */}
                        <div className="space-y-2">
                          {studentSessions.filter((s: any) => s.ecosSessionId).length > 0 ? (
                            studentSessions
                              .filter((s: any) => s.ecosSessionId)
                              .map((session: any) => (
                                <div key={session.ecosSessionId} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                  <div>
                                    <p className="font-medium">Session ECOS #{session.ecosSessionId}</p>
                                    <p className="text-sm text-gray-600">
                                      Scénario: {session.ecosScenarioTitle}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      Démarrée: {new Date(session.ecosSessionStartTime).toLocaleString('fr-FR')}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant={session.ecosSessionStatus === 'completed' ? 'default' : 'secondary'}>
                                      {session.ecosSessionStatus === 'completed' ? 'Terminée' : 'En cours'}
                                    </Badge>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => handleViewSessionDetails(session)}
                                    >
                                      Détails
                                    </Button>
                                  </div>
                                </div>
                              ))
                          ) : (
                            <div className="p-3 bg-blue-50 rounded text-center">
                              <p className="text-sm text-blue-700">Aucune session ECOS démarrée</p>
                              <p className="text-xs text-blue-600">L'étudiant peut commencer un examen depuis son interface</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun étudiant assigné</h3>
                    <p className="text-gray-600">Les étudiants assignés aux sessions de formation apparaîtront ici</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          
        </Tabs>
      </div>

        {/* Delete Confirmation Dialog */}
        {deletingScenario && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">Confirmer la suppression</h3>
              <p className="text-gray-600 mb-6">
                Êtes-vous sûr de vouloir supprimer le scénario "{deletingScenario.title}" ? 
                Cette action est irréversible et supprimera également toutes les sessions associées.
              </p>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setDeletingScenario(null)}
                  disabled={deleteScenarioMutation.isPending}
                >
                  Annuler
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDelete}
                  disabled={deleteScenarioMutation.isPending}
                >
                  {deleteScenarioMutation.isPending ? "Suppression..." : "Supprimer"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Session Details Modal */}
        {viewingSessionDetails && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Détails de la Session #{viewingSessionDetails.id}</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewingSessionDetails(null)}
                >
                  Fermer
                </Button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Statut</label>
                    <div className="mt-1">
                      <Badge variant={viewingSessionDetails.status === 'completed' ? 'default' : 'secondary'}>
                        {viewingSessionDetails.status === 'completed' ? 'Terminée' : 'En cours'}
                      </Badge>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-600">Scénario</label>
                    <p className="mt-1 text-sm">{viewingSessionDetails.scenarioTitle || `Scénario #${viewingSessionDetails.scenarioId}`}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-600">Étudiant</label>
                    <p className="mt-1 text-sm">{viewingSessionDetails.student_id}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-600">Durée</label>
                    <p className="mt-1 text-sm">
                      {viewingSessionDetails.endTime 
                        ? `${Math.round((new Date(viewingSessionDetails.endTime).getTime() - new Date(viewingSessionDetails.startTime).getTime()) / 1000 / 60)} minutes`
                        : 'En cours'
                      }
                    </p>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Heure de début</label>
                  <p className="mt-1 text-sm">{new Date(viewingSessionDetails.startTime).toLocaleString('fr-FR')}</p>
                </div>
                
                {viewingSessionDetails.endTime && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Heure de fin</label>
                    <p className="mt-1 text-sm">{new Date(viewingSessionDetails.endTime).toLocaleString('fr-FR')}</p>
                  </div>
                )}
                
                {viewingSessionDetails.status === 'completed' && (
                  <div className="pt-4 border-t">
                    <Button
                      onClick={() => window.open(`/student/${encodeURIComponent(email || '')}?report=${viewingSessionDetails.id}`, '_blank')}
                      className="w-full"
                    >
                      Voir le Rapport d'Évaluation
                    </Button>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Si la session était vide, le rapport indiquera que l'évaluation n'est pas disponible
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal pour afficher les résultats de l'étudiant */}
        {viewingReport && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Résultats de la Consultation #{viewingReport}</h2>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setViewingReport(null)}
                  >
                    ✕
                  </Button>
                </div>
              </div>
              
              <div className="p-6">
                {isReportLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p>Chargement du rapport...</p>
                  </div>
                ) : reportData?.report ? (
                  <div className="space-y-6">
                    {/* Check if it's an insufficient content report */}
                    {reportData.report.isInsufficientContent ? (
                      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                        <h3 className="font-semibold mb-2 text-yellow-800">Session incomplète</h3>
                        <p className="text-sm text-yellow-700 mb-2">{reportData.report.message}</p>
                        <p className="text-xs text-yellow-600">{reportData.report.details}</p>
                      </div>
                    ) : (
                      <>
                        {/* Informations générales */}
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <h3 className="font-semibold mb-3">Informations de la consultation</h3>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Session ID:</span>
                              <p>#{reportData.report.sessionId}</p>
                            </div>
                            <div>
                              <span className="font-medium">Date d'évaluation:</span>
                              <p>{reportData.report.timestamp ? new Date(reportData.report.timestamp).toLocaleString('fr-FR') : 'Non définie'}</p>
                            </div>
                            <div>
                              <span className="font-medium">Score global:</span>
                              <p className="font-semibold text-blue-600">{reportData.report.globalScore || 0}/100</p>
                            </div>
                          </div>
                        </div>

                        {/* Feedback général */}
                        {reportData.report.feedback && (
                          <div>
                            <h3 className="font-semibold mb-3">Feedback général</h3>
                            <div className="bg-blue-50 p-4 rounded-lg">
                              <p className="text-sm">{reportData.report.feedback}</p>
                            </div>
                          </div>
                        )}

                        {/* Scores détaillés */}
                        {reportData.report.scores && Object.keys(reportData.report.scores).length > 0 && (
                          <div>
                            <h3 className="font-semibold mb-3">Scores détaillés</h3>
                            <div className="bg-gray-50 p-4 rounded-lg">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {Object.entries(reportData.report.scores).map(([criterion, score]: [string, any]) => (
                                  <div key={criterion} className="flex justify-between items-center p-2 bg-white rounded border">
                                    <span className="text-sm font-medium">{criterion}</span>
                                    <span className="text-sm font-bold text-blue-600">{score}/4</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Résumé de l'évaluation */}
                        {reportData.report.summary && (
                          <div>
                            <h3 className="font-semibold mb-3">Résumé de l'évaluation</h3>
                            <div className="bg-blue-50 p-4 rounded-lg">
                              <p className="text-sm">{reportData.report.summary}</p>
                            </div>
                          </div>
                        )}

                        {/* Points forts */}
                        {reportData.report.strengths && reportData.report.strengths.length > 0 && (
                          <div>
                            <h3 className="font-semibold mb-3 text-green-700">Points forts</h3>
                            <div className="bg-green-50 p-4 rounded-lg">
                              <ul className="list-disc list-inside space-y-2 text-sm">
                                {reportData.report.strengths.map((strength: string, index: number) => (
                                  <li key={index} className="leading-relaxed">{strength}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}

                        {/* Points à améliorer */}
                        {reportData.report.weaknesses && reportData.report.weaknesses.length > 0 && (
                          <div>
                            <h3 className="font-semibold mb-3 text-orange-700">Points à améliorer</h3>
                            <div className="bg-orange-50 p-4 rounded-lg">
                              <ul className="list-disc list-inside space-y-2 text-sm">
                                {reportData.report.weaknesses.map((weakness: string, index: number) => (
                                  <li key={index} className="leading-relaxed">{weakness}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}

                        {/* Recommandations */}
                        {reportData.report.recommendations && reportData.report.recommendations.length > 0 && (
                          <div>
                            <h3 className="font-semibold mb-3 text-blue-700">Recommandations</h3>
                            <div className="bg-blue-50 p-4 rounded-lg">
                              <ul className="list-disc list-inside space-y-2 text-sm">
                                {reportData.report.recommendations.map((recommendation: string, index: number) => (
                                  <li key={index} className="leading-relaxed">{recommendation}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Aucun rapport disponible pour cette consultation.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default TeacherPage;