import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Clock, Send, User, Bot } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface PatientSimulatorProps {
  sessionId: number;
  email: string;
  onSessionEnd: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export default function PatientSimulator({ sessionId, email, onSessionEnd }: PatientSimulatorProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuery, setCurrentQuery] = useState("");
  const [sessionStartTime] = useState(new Date());
  const [remainingTime, setRemainingTime] = useState(8 * 60); // 8 minutes in seconds

  // Countdown timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          // Time's up - automatically end session
          endSessionMutation.mutate();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Fetch session details
  const { data: session } = useQuery({
    queryKey: ['ecos-session', sessionId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/ecos/sessions/${sessionId}?email=${email}`);
      return response.session;
    }
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (query: string) => {
      return apiRequest('POST', '/api/ecos/patient-simulator', {
        email,
        sessionId,
        query
      });
    },
    onSuccess: (data) => {
      // Add user message
      const userMessage: Message = {
        id: Date.now().toString() + '-user',
        role: 'user',
        content: currentQuery,
        timestamp: new Date().toISOString()
      };

      // Add assistant response
      const assistantMessage: Message = {
        id: Date.now().toString() + '-assistant',
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, userMessage, assistantMessage]);
      setCurrentQuery("");
    }
  });

  // End session mutation
  const endSessionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('PUT', `/api/ecos/sessions/${sessionId}`, {
        email,
        status: 'completed'
      });
    },
    onSuccess: () => {
      onSessionEnd();
    },
    onError: (error) => {
      console.error('Error ending session:', error);
    }
  });

  const handleSendMessage = () => {
    if (currentQuery.trim()) {
      sendMessageMutation.mutate(currentQuery);
    }
  };

  const handleEndSession = () => {
    endSessionMutation.mutate();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Session Header */}
      <Card className="mb-6 border-2 border-blue-500">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-xl">{session?.scenario?.title}</CardTitle>
              <p className="text-gray-600 mt-1">{session?.scenario?.description}</p>
            </div>
            <div className="flex items-center space-x-4">
              <Badge 
                variant="outline" 
                className={`flex items-center space-x-1 ${remainingTime <= 60 ? 'bg-red-50 text-red-700 border-red-200' : ''}`}
              >
                <Clock className="w-4 h-4" />
                <span>{formatTime(remainingTime)}</span>
              </Badge>
              <Button 
                onClick={handleEndSession}
                disabled={endSessionMutation.isPending}
              >
                {endSessionMutation.isPending ? 'Fermeture...' : 'Terminer la Session'}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Chat Interface */}
      <Card className="h-[600px] flex flex-col border-2 border-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span>Simulation Patient</span>
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 p-4 bg-gray-50 rounded-lg">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                
                <p>Bonjour Docteur, je suis votre patient pour cet examen.</p>
                <p className="text-sm">Commencez votre consultation en me posant des questions.</p>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] p-3 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white border border-gray-200'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    {message.role === 'user' ? (
                      <User className="w-4 h-4" />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                    <span className="text-xs opacity-75">
                      {message.role === 'user' ? 'Vous' : 'Patient'}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}

            {sendMessageMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 p-3 rounded-lg max-w-[70%]">
                  <div className="flex items-center space-x-2">
                    <Bot className="w-4 h-4" />
                    <span className="text-xs text-gray-500">Patient</span>
                  </div>
                  <div className="flex space-x-1 mt-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="flex space-x-2">
            <Textarea
              value={currentQuery}
              onChange={(e) => setCurrentQuery(e.target.value)}
              placeholder="Posez votre question au patient..."
              className="flex-1 border-2 border-blue-500"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!currentQuery.trim() || sendMessageMutation.isPending}
              className="self-end"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}