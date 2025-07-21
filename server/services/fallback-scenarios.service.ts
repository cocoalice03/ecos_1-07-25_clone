// Fallback scenarios service that provides sample data without database dependency
export class FallbackScenariosService {
  
  private scenarios = [
    {
      id: 1,
      title: "Consultation en cardiologie",
      description: "Patient de 65 ans présentant des douleurs thoraciques",
      patientPrompt: "Vous êtes un patient de 65 ans qui consulte pour des douleurs thoraciques depuis 2 jours. Vous êtes inquiet car votre père est décédé d'un infarctus.",
      evaluationCriteria: {
        communication: { weight: 30, description: "Qualité de la communication avec le patient" },
        examination: { weight: 40, description: "Qualité de l'examen clinique" },
        diagnostic: { weight: 30, description: "Pertinence du diagnostic et des examens complémentaires" }
      },
      imageUrl: "/images/cardiology.jpg",
      createdBy: "system",
      createdAt: new Date('2025-01-01')
    },
    {
      id: 2,
      title: "Urgence pédiatrique",
      description: "Enfant de 5 ans avec fièvre et difficultés respiratoires",
      patientPrompt: "Vous accompagnez votre enfant de 5 ans qui a de la fièvre depuis la nuit dernière et qui a du mal à respirer. Vous êtes très anxieux.",
      evaluationCriteria: {
        approche_pediatrique: { weight: 25, description: "Adaptation de l'approche à l'âge de l'enfant" },
        communication_parents: { weight: 25, description: "Communication avec les parents" },
        examen_clinique: { weight: 25, description: "Examen clinique adapté" },
        prise_en_charge: { weight: 25, description: "Décisions thérapeutiques appropriées" }
      },
      imageUrl: "/images/pediatrics.jpg",
      createdBy: "system",
      createdAt: new Date('2025-01-01')
    },
    {
      id: 3,
      title: "Consultation gynécologique",
      description: "Femme de 35 ans pour suivi gynécologique de routine",
      patientPrompt: "Vous êtes une femme de 35 ans venue pour votre consultation gynécologique annuelle. Vous avez quelques questions sur la contraception.",
      evaluationCriteria: {
        respect_intimite: { weight: 35, description: "Respect de l'intimité et de la pudeur" },
        communication: { weight: 30, description: "Communication bienveillante" },
        examen_clinique: { weight: 35, description: "Examen gynécologique approprié" }
      },
      imageUrl: "/images/gynecology.jpg",
      createdBy: "system",
      createdAt: new Date('2025-01-01')
    }
  ];

  async getAvailableScenarios(): Promise<any[]> {
    return this.scenarios.map(scenario => ({
      id: scenario.id,
      title: scenario.title,
      description: scenario.description,
      imageUrl: scenario.imageUrl,
      createdBy: scenario.createdBy,
      createdAt: scenario.createdAt
    }));
  }

  async getScenarioById(id: number): Promise<any | null> {
    return this.scenarios.find(scenario => scenario.id === id) || null;
  }

  async getScenariosForStudent(email: string): Promise<any[]> {
    // For demo purposes, return all scenarios for any student
    return this.scenarios;
  }
}

export const fallbackScenariosService = new FallbackScenariosService();