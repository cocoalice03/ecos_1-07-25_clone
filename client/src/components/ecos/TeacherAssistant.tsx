
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit, Plus, Wand2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface EcosScenario {
  id: number;
  title: string;
  description: string;
  patientPrompt: string;
  evaluationCriteria: any;
  createdBy: string;
  createdAt: string;
}

interface TeacherAssistantProps {
  email: string;
}

export default function TeacherAssistant({ email }: TeacherAssistantProps) {
  const [selectedScenario, setSelectedScenario] = useState<EcosScenario | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState("scenarios");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    patientPrompt: "",
    evaluationCriteria: ""
  });

  // Fetch scenarios
  const { data: scenarios, isLoading, refetch: refetchScenarios } = useQuery({
    queryKey: ['ecos-scenarios', email],
    queryFn: async () => {
      try {
        console.log('Fetching scenarios for email:', email);
        const response = await apiRequest('GET', `/api/ecos/scenarios?email=${encodeURIComponent(email)}`);
        console.log('Scenarios response:', response);
        return response.scenarios || [];
      } catch (error) {
        console.error('Error fetching scenarios:', error);
        throw error;
      }
    },
    enabled: !!email,
  });

  // Create scenario mutation
  const createScenarioMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("Sending scenario creation request:", { email, ...data });
      return apiRequest('POST', '/api/ecos/scenarios', {
        email,
        ...data
      });
    },
    onSuccess: (response) => {
      console.log("Scenario created successfully:", response);
      refetchScenarios();
      setIsCreating(false);
      setFormData({ title: "", description: "", patientPrompt: "", evaluationCriteria: "" });
      // Switch to scenarios tab to show the new scenario
      setActiveTab("scenarios");
      alert("Scénario créé avec succès !");
    },
    onError: (error) => {
      console.error("Error creating scenario:", error);
      alert("Erreur lors de la création du scénario. Veuillez réessayer.");
    }
  });

  // Delete scenario mutation
  const deleteScenarioMutation = useMutation({
    mutationFn: async (scenarioId: number) => {
      return apiRequest('DELETE', `/api/ecos/scenarios/${scenarioId}?email=${email}`);
    },
    onSuccess: () => {
      refetchScenarios();
      setSelectedScenario(null);
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

  const handleCreateScenario = () => {
    console.log("Creating scenario with email:", email);
    
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
      evaluationCriteria: criteria
    });
  };

  const handleGeneratePrompt = () => {
    if (formData.description) {
      generatePromptMutation.mutate(formData.description);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Assistant Enseignant ECOS</h1>
        <p className="text-gray-600">Créez et gérez vos scénarios d'examen clinique</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="scenarios">Mes Scénarios</TabsTrigger>
          <TabsTrigger value="create">Créer un Scénario</TabsTrigger>
        </TabsList>

        <TabsContent value="scenarios" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Scénarios ECOS</h2>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nouveau Scénario
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded"></div>
                      <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scenarios?.map((scenario: EcosScenario) => (
                <Card key={scenario.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">{scenario.title}</CardTitle>
                    <Badge variant="secondary" className="w-fit">
                      {new Date(scenario.createdAt).toLocaleDateString()}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                      {scenario.description}
                    </p>
                    <div className="flex justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedScenario(scenario)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Modifier
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteScenarioMutation.mutate(scenario.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Créer un Nouveau Scénario</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Titre du Scénario</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ex: Consultation cardiologique"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Décrivez le contexte clinique, les symptômes du patient, etc."
                  rows={4}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label htmlFor="patientPrompt">Prompt du Patient</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGeneratePrompt}
                    disabled={!formData.description || generatePromptMutation.isPending}
                  >
                    <Wand2 className="w-4 h-4 mr-1" />
                    Générer avec IA
                  </Button>
                </div>
                <Textarea
                  id="patientPrompt"
                  value={formData.patientPrompt}
                  onChange={(e) => setFormData(prev => ({ ...prev, patientPrompt: e.target.value }))}
                  placeholder="Instructions pour l'IA qui jouera le rôle du patient..."
                  rows={6}
                />
              </div>

              <div>
                <Label htmlFor="evaluationCriteria">Critères d'Évaluation (JSON)</Label>
                <Textarea
                  id="evaluationCriteria"
                  value={formData.evaluationCriteria}
                  onChange={(e) => setFormData(prev => ({ ...prev, evaluationCriteria: e.target.value }))}
                  placeholder='{"anamnese": 20, "examen_physique": 30, "diagnostic": 25, "plan_therapeutique": 25}'
                  rows={4}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Format JSON requis. Exemple : {"{"}"anamnese": 20, "examen_physique": 30{"}"}
                </p>
              </div>

              <Button
                onClick={handleCreateScenario}
                disabled={!formData.title || !formData.description || createScenarioMutation.isPending}
                className="w-full"
              >
                {createScenarioMutation.isPending ? "Création..." : "Créer le Scénario"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
