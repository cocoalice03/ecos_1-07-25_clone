import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, AlertCircle, TrendingUp, TrendingDown } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface EvaluationReportProps {
  sessionId: number;
  email: string;
}

interface EvaluationData {
  sessionId: number;
  overallScore: number;
  criteria: Array<{
    id: string;
    name: string;
    score: number;
    maxScore: number;
    feedback: string;
  }>;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export default function EvaluationReport({ sessionId, email }: EvaluationReportProps) {
  // Fetch evaluation data
  const { data: evaluation, isLoading, error } = useQuery({
    queryKey: ['ecos-evaluation', sessionId],
    queryFn: async () => {
      const response = await apiRequest('POST', '/api/ecos/evaluate', {
        email,
        sessionId
      });
      return response as EvaluationData;
    }
  });

  // Transform evaluation data to match expected structure
  const transformedEvaluation = evaluation ? (() => {
    const evalData = evaluation.evaluation || evaluation;
    return {
      ...evaluation,
      ...evalData,
      criteria: evalData.criteria || (evalData.scores ? Object.entries(evalData.scores).map(([key, score]) => ({
        id: key,
        name: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
        score: typeof score === 'number' ? score : 0,
        maxScore: 4,
        feedback: evalData.comments?.[key] || 'Aucun commentaire'
      })) : [])
    };
  })() : null;

  console.log('🔍 Raw evaluation data:', evaluation);
  console.log('🔍 Transformed evaluation:', transformedEvaluation);

  // Calculate overall score percentage
  const calculateOverallScore = (evaluation: any) => {
    console.log('📊 Evaluation data for score calculation:', evaluation);

    if (!evaluation) return 0;

    // Check if scores exist in the evaluation object - handle nested structure
    let scores: number[] = [];

    // First check if evaluation has nested evaluation object (from API response)
    const evalData = evaluation.evaluation || evaluation;

    if (evalData.scores && typeof evalData.scores === 'object') {
      scores = Object.values(evalData.scores).filter(score => typeof score === 'number') as number[];
    } else if (evalData.criteria && Array.isArray(evalData.criteria)) {
      scores = evalData.criteria.map((c: any) => c.score).filter((score: any) => typeof score === 'number');
    }

    console.log('📊 Extracted scores:', scores);

    if (scores.length === 0) return 0;

    const totalScore = scores.reduce((sum, score) => sum + score, 0);
    const maxPossibleScore = scores.length * 4;
    const percentage = Math.round((totalScore / maxPossibleScore) * 100);

    console.log(`📊 Score calculation: ${totalScore}/${maxPossibleScore} = ${percentage}%`);

    return percentage;
  };

  const overallScore = transformedEvaluation ? calculateOverallScore(transformedEvaluation) : 0;

  // Fetch session report
  const { data: report } = useQuery({
    queryKey: ['ecos-report', sessionId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/ecos/sessions/${sessionId}/report?email=${email}`);
      return response.report;
    }
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Génération de l'évaluation en cours...</p>
              <p className="text-sm text-gray-500 mt-2">
                Cette opération peut prendre quelques secondes
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    const errorMessage = error.message || 'Impossible de charger l\'évaluation';
    const isInsufficientContent = errorMessage.includes('assez d\'échanges') || errorMessage.includes('Aucune question');

    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              {isInsufficientContent ? (
                <>
                  <AlertCircle className="w-16 h-16 mx-auto mb-4 text-blue-500" />
                  <h3 className="text-lg font-semibold mb-2 text-gray-800">Évaluation non disponible</h3>
                  <p className="text-gray-600 mb-4">
                    L'évaluation n'est pas disponible car la session était vide.
                  </p>
                  <p className="text-sm text-gray-500">
                    Aucune interaction entre l'étudiant et le patient n'a été enregistrée pour cette session.
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
                  <h3 className="text-lg font-semibold mb-2">Erreur lors du chargement</h3>
                  <p className="text-gray-600">{errorMessage}</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getScoreColor = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return "text-green-600";
    if (percentage >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreIcon = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return <CheckCircle className="w-5 h-5 text-green-600" />;
    if (percentage >= 60) return <AlertCircle className="w-5 h-5 text-yellow-600" />;
    return <XCircle className="w-5 h-5 text-red-600" />;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Overall Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Résultat Global</span>
            <Badge variant="outline" className="text-lg px-3 py-1">
              {overallScore}%
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Progress value={overallScore} className="h-3" />
          </div>
          {report?.summary && (
            <p className="text-gray-700">{report.summary}</p>
          )}
        </CardContent>
      </Card>

      {/* Detailed Criteria Scores */}
      <Card>
        <CardHeader>
          <CardTitle>Évaluation Détaillée</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {transformedEvaluation.criteria.map((criterion) => (
            <div key={criterion.id} className="border-b border-gray-100 pb-4 last:border-b-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {getScoreIcon(criterion.score, criterion.maxScore)}
                  <h4 className="font-medium">{criterion.name}</h4>
                </div>
                <span className={`font-semibold ${getScoreColor(criterion.score, criterion.maxScore)}`}>
                  {criterion.score}/{criterion.maxScore}
                </span>
              </div>
              <Progress value={(criterion.score / criterion.maxScore) * 100} className="mb-2" />
              {criterion.feedback && (
                <p className="text-sm text-gray-600">{criterion.feedback}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Strengths and Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strengths */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-green-700">
              <TrendingUp className="w-5 h-5" />
              <span>Points Forts</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report?.strengths && report.strengths.length > 0 ? (
              <ul className="space-y-2">
                {report.strengths.map((strength: string, index: number) => (
                  <li key={index} className="flex items-start space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{strength}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">Aucun point fort identifié.</p>
            )}
          </CardContent>
        </Card>

        {/* Weaknesses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-red-700">
              <TrendingDown className="w-5 h-5" />
              <span>Points à Améliorer</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report?.weaknesses && report.weaknesses.length > 0 ? (
              <ul className="space-y-2">
                {report.weaknesses.map((weakness: string, index: number) => (
                  <li key={index} className="flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{weakness}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">Aucune faiblesse identifiée.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      {report?.recommendations && report.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recommandations pour l'Amélioration</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {report.recommendations.map((recommendation: string, index: number) => (
                <li key={index} className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
                    {index + 1}
                  </div>
                  <span className="text-gray-700">{recommendation}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}