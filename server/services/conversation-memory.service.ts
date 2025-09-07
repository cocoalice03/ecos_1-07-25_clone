/**
 * Conversation Memory Service
 * 
 * Manages short-term memory for virtual patient conversations
 * - In-memory cache for active sessions
 * - Context preservation and role recognition
 * - TTL-based cleanup for inactive conversations
 */

interface ConversationMessage {
  content: string;
  role: 'student' | 'patient';
  timestamp: Date;
  metadata?: {
    messageType?: string;
    medicalContext?: string;
  };
}

interface ConversationMemory {
  sessionId: string;
  studentEmail: string;
  scenarioId: number;
  studentRole: 'infirmier' | 'docteur' | 'étudiant';
  patientPersona?: string;
  conversationHistory: ConversationMessage[];
  contextSummary?: string;
  lastActivity: Date;
  medicalContext?: {
    symptomsDiscussed: string[];
    proceduresPerformed: string[];
    questionsAsked: string[];
  };
}

export class ConversationMemoryService {
  private cache: Map<string, ConversationMemory> = new Map();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_HISTORY_MESSAGES = 20; // Keep last 20 messages
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Start cleanup timer - every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000);
  }

  /**
   * Initialize or retrieve conversation memory
   */
  async initializeConversation(
    sessionId: string,
    studentEmail: string,
    scenarioId: number,
    patientPrompt?: string
  ): Promise<ConversationMemory> {
    const existing = this.cache.get(sessionId);
    
    if (existing) {
      existing.lastActivity = new Date();
      return existing;
    }

    const memory: ConversationMemory = {
      sessionId,
      studentEmail,
      scenarioId,
      studentRole: 'étudiant', // Default, will be detected
      patientPersona: patientPrompt,
      conversationHistory: [],
      lastActivity: new Date(),
      medicalContext: {
        symptomsDiscussed: [],
        proceduresPerformed: [],
        questionsAsked: []
      }
    };

    this.cache.set(sessionId, memory);
    console.log(`💭 Initialized conversation memory for session ${sessionId}`);
    return memory;
  }

  /**
   * Add message to conversation history
   */
  addMessage(
    sessionId: string,
    content: string,
    role: 'student' | 'patient',
    metadata?: any
  ): void {
    const memory = this.cache.get(sessionId);
    if (!memory) {
      console.warn(`⚠️ No memory found for session ${sessionId}`);
      return;
    }

    const message: ConversationMessage = {
      content,
      role,
      timestamp: new Date(),
      metadata
    };

    memory.conversationHistory.push(message);
    memory.lastActivity = new Date();

    // Keep only recent messages to prevent memory bloat
    if (memory.conversationHistory.length > this.MAX_HISTORY_MESSAGES) {
      memory.conversationHistory = memory.conversationHistory.slice(-this.MAX_HISTORY_MESSAGES);
    }

    // Extract medical context from student messages
    if (role === 'student') {
      this.extractMedicalContext(memory, content);
    }

    console.log(`💭 Added ${role} message to session ${sessionId} memory`);
  }

  /**
   * Detect student role from introduction
   */
  detectStudentRole(content: string): 'infirmier' | 'docteur' | 'étudiant' {
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('infirmier') || lowerContent.includes('infirmière')) {
      return 'infirmier';
    }
    
    if (lowerContent.includes('docteur') || lowerContent.includes('médecin')) {
      return 'docteur';
    }
    
    return 'étudiant';
  }

  /**
   * Update student role in conversation memory
   */
  updateStudentRole(sessionId: string, content: string): void {
    const memory = this.cache.get(sessionId);
    if (!memory) return;

    const detectedRole = this.detectStudentRole(content);
    if (detectedRole !== 'étudiant') {
      memory.studentRole = detectedRole;
      console.log(`🎭 Detected student role: ${detectedRole} for session ${sessionId}`);
    }
  }

  /**
   * Get conversation memory
   */
  getConversationMemory(sessionId: string): ConversationMemory | null {
    const memory = this.cache.get(sessionId);
    if (memory) {
      memory.lastActivity = new Date();
    }
    return memory || null;
  }

  /**
   * Get conversation context for AI prompt
   */
  getConversationContext(sessionId: string): {
    history: string;
    role: string;
    medicalContext: string;
  } {
    const memory = this.cache.get(sessionId);
    if (!memory) {
      return { history: '', role: 'étudiant', medicalContext: '' };
    }

    // Build conversation history summary
    const recentMessages = memory.conversationHistory.slice(-10); // Last 10 messages
    const history = recentMessages.map(msg => 
      `${msg.role === 'student' ? 'Étudiant' : 'Patient'}: ${msg.content}`
    ).join('\n');

    // Build medical context summary
    const medicalContext = [
      memory.medicalContext?.symptomsDiscussed.length ? 
        `Symptômes discutés: ${memory.medicalContext.symptomsDiscussed.join(', ')}` : '',
      memory.medicalContext?.questionsAsked.length ? 
        `Questions posées: ${memory.medicalContext.questionsAsked.join(', ')}` : ''
    ].filter(Boolean).join('\n');

    return {
      history,
      role: memory.studentRole,
      medicalContext
    };
  }

  /**
   * Get appropriate addressing for student role
   */
  getStudentAddressing(sessionId: string): string {
    const memory = this.cache.get(sessionId);
    if (!memory) return '';

    switch (memory.studentRole) {
      case 'infirmier':
        return 'infirmier';
      case 'docteur':
        return 'docteur';
      default:
        return '';
    }
  }

  /**
   * Extract medical context from conversation
   */
  private extractMedicalContext(memory: ConversationMemory, content: string): void {
    const lowerContent = content.toLowerCase();
    
    // Extract symptoms mentioned
    const symptomKeywords = ['douleur', 'mal', 'symptôme', 'fièvre', 'nausée', 'fatigue', 'toux'];
    symptomKeywords.forEach(symptom => {
      if (lowerContent.includes(symptom) && !memory.medicalContext?.symptomsDiscussed.includes(symptom)) {
        memory.medicalContext?.symptomsDiscussed.push(symptom);
      }
    });

    // Extract questions asked
    if (lowerContent.includes('?') || lowerContent.startsWith('comment') || lowerContent.startsWith('pourquoi')) {
      const question = content.substring(0, 50) + (content.length > 50 ? '...' : '');
      if (memory.medicalContext && !memory.medicalContext.questionsAsked.includes(question)) {
        memory.medicalContext.questionsAsked.push(question);
      }
    }
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = new Date().getTime();
    let cleanedCount = 0;

    for (const [sessionId, memory] of this.cache.entries()) {
      const lastActivity = memory.lastActivity.getTime();
      if (now - lastActivity > this.CACHE_TTL) {
        this.cache.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired conversation sessions`);
    }
  }

  /**
   * Get memory stats for monitoring
   */
  getMemoryStats(): {
    activeSessions: number;
    totalMessages: number;
    oldestSession: Date | null;
  } {
    let totalMessages = 0;
    let oldestSession: Date | null = null;

    for (const memory of this.cache.values()) {
      totalMessages += memory.conversationHistory.length;
      if (!oldestSession || memory.lastActivity < oldestSession) {
        oldestSession = memory.lastActivity;
      }
    }

    return {
      activeSessions: this.cache.size,
      totalMessages,
      oldestSession
    };
  }

  /**
   * Clear specific session
   */
  clearSession(sessionId: string): boolean {
    const result = this.cache.delete(sessionId);
    if (result) {
      console.log(`🗑️ Cleared conversation memory for session ${sessionId}`);
    }
    return result;
  }

  /**
   * Cleanup service
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
    console.log('🛑 Conversation memory service destroyed');
  }
}

// Export singleton instance
export const conversationMemoryService = new ConversationMemoryService();