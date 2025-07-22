import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { 
  Stethoscope, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  User,
  Activity,
  FileText,
  BookOpen
} from 'lucide-react';

interface NursingCase {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  estimated_time: number;
  patient_info: any;
  clinical_presentation: any;
  nursing_assessment: any;
  nursing_interventions: any;
  expected_outcomes: any;
  critical_thinking_questions: any;
  teaching_points: string[];
  additional_resources: string[];
}

export default function NursingCasesPage() {
  const [cases, setCases] = useState<NursingCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<NursingCase | null>(null);
  const [initializing, setInitializing] = useState(false);

  const fetchCases = async () => {
    try {
      const response = await fetch('/api/nursing-cases');
      const data = await response.json();
      
      if (response.ok) {
        setCases(data.cases || []);
      } else {
        toast({
          title: "Erreur",
          description: data.message || "Impossible de récupérer les cas",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error fetching cases:', error);
      toast({
        title: "Erreur",
        description: "Erreur de connexion au serveur",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const initializeCase = async () => {
    setInitializing(true);
    try {
      const response = await fetch('/api/nursing-cases/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Succès",
          description: "Cas infirmier créé et hébergé dans Supabase",
        });
        fetchCases(); // Refresh the list
      } else {
        toast({
          title: "Erreur",
          description: data.message || "Impossible de créer le cas",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error initializing case:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de l'initialisation",
        variant: "destructive"
      });
    } finally {
      setInitializing(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Cas Infirmiers</h1>
        <p className="text-muted-foreground">
          Études de cas pour la formation en soins infirmiers
        </p>
      </div>

      {cases.length === 0 ? (
        <Card className="text-center p-12">
          <Stethoscope className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <CardTitle className="mb-2">Aucun cas disponible</CardTitle>
          <CardDescription className="mb-6">
            Cliquez sur le bouton ci-dessous pour créer un cas infirmier d'exemple
          </CardDescription>
          <Button 
            onClick={initializeCase}
            disabled={initializing}
            className="mx-auto"
          >
            {initializing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Création en cours...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Créer un cas d'exemple
              </>
            )}
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cases.map((nursingCase) => (
            <Card 
              key={nursingCase.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedCase(nursingCase)}
            >
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                  <Badge className={getDifficultyColor(nursingCase.difficulty)}>
                    {nursingCase.difficulty}
                  </Badge>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="h-4 w-4 mr-1" />
                    {nursingCase.estimated_time} min
                  </div>
                </div>
                <CardTitle className="text-lg">{nursingCase.title}</CardTitle>
                <CardDescription>{nursingCase.category}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center text-sm">
                    <User className="h-4 w-4 mr-2 text-muted-foreground" />
                    {nursingCase.patient_info.name} - {nursingCase.patient_info.age} ans
                  </div>
                  <div className="flex items-center text-sm">
                    <Activity className="h-4 w-4 mr-2 text-muted-foreground" />
                    {nursingCase.patient_info.chiefComplaint}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Case Detail Modal */}
      {selectedCase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold">{selectedCase.title}</h2>
                  <p className="text-muted-foreground">{selectedCase.category}</p>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedCase(null)}
                >
                  ✕
                </Button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Patient Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <User className="h-5 w-5 mr-2" />
                    Information Patient
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <strong>Nom:</strong> {selectedCase.patient_info.name}
                    </div>
                    <div>
                      <strong>Âge:</strong> {selectedCase.patient_info.age} ans
                    </div>
                    <div>
                      <strong>Poids:</strong> {selectedCase.patient_info.weight} kg
                    </div>
                    <div>
                      <strong>Taille:</strong> {selectedCase.patient_info.height} cm
                    </div>
                  </div>
                  <div className="mt-4">
                    <strong>Motif de consultation:</strong>
                    <p className="mt-1">{selectedCase.patient_info.chiefComplaint}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Vital Signs */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Activity className="h-5 w-5 mr-2" />
                    Signes Vitaux
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <strong>PA:</strong> {selectedCase.patient_info.vitalSigns.bloodPressure}
                    </div>
                    <div>
                      <strong>FC:</strong> {selectedCase.patient_info.vitalSigns.heartRate} bpm
                    </div>
                    <div>
                      <strong>FR:</strong> {selectedCase.patient_info.vitalSigns.respiratoryRate}/min
                    </div>
                    <div>
                      <strong>T°:</strong> {selectedCase.patient_info.vitalSigns.temperature}°C
                    </div>
                    <div>
                      <strong>SpO2:</strong> {selectedCase.patient_info.vitalSigns.oxygenSaturation}%
                    </div>
                    <div>
                      <strong>Glycémie:</strong> {selectedCase.patient_info.vitalSigns.bloodGlucose} mmol/L
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Nursing Interventions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Interventions Infirmières
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {selectedCase.nursing_interventions.map((intervention: any, index: number) => (
                      <div key={index} className="border-l-4 border-primary pl-4">
                        <h4 className="font-semibold">{intervention.intervention}</h4>
                        <ul className="mt-2 space-y-1">
                          {intervention.actions.map((action: string, actionIndex: number) => (
                            <li key={actionIndex} className="text-sm text-muted-foreground">
                              • {action}
                            </li>
                          ))}
                        </ul>
                        <p className="text-sm italic mt-2">
                          <strong>Justification:</strong> {intervention.rationale}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Teaching Points */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BookOpen className="h-5 w-5 mr-2" />
                    Points d'Enseignement
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {selectedCase.teaching_points.map((point: string, index: number) => (
                      <li key={index} className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-green-600 flex-shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}