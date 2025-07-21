import { db, ecosScenarios, trainingSessions, trainingSessionScenarios, trainingSessionStudents } from '../db';
import { eq } from 'drizzle-orm';

export class SampleDataService {
  
  async createSampleData(): Promise<void> {
    try {
      console.log('🌱 Creating sample data for testing...');

      // Create sample scenarios
      const sampleScenarios = [
        {
          title: "Consultation en cardiologie",
          description: "Patient de 65 ans présentant des douleurs thoraciques",
          patientPrompt: "Vous êtes un patient de 65 ans qui consulte pour des douleurs thoraciques depuis 2 jours. Vous êtes inquiet car votre père est décédé d'un infarctus.",
          evaluationCriteria: {
            communication: { weight: 30, description: "Qualité de la communication avec le patient" },
            examination: { weight: 40, description: "Qualité de l'examen clinique" },
            diagnostic: { weight: 30, description: "Pertinence du diagnostic et des examens complémentaires" }
          },
          pineconeIndex: "sample_scenario_1",
          imageUrl: "/images/cardiology.jpg",
          createdBy: "system"
        },
        {
          title: "Urgence pédiatrique",
          description: "Enfant de 5 ans avec fièvre et difficultés respiratoires",
          patientPrompt: "Vous accompagnez votre enfant de 5 ans qui a de la fièvre depuis la nuit dernière et qui a du mal à respirer. Vous êtes très anxieux.",
          evaluationCriteria: {
            approche_pediatrique: { weight: 25, description: "Adaptation de l'approche à l'âge de l'enfant" },
            communication_parents: { weight: 25, description: "Communication avec les parents" },
            examen_clinique: { weight: 25, description: "Examen clinique adapté" },
            prise_en_charge: { weight: 25, description: "Décisions thérapeutiques appropriées" }
          },
          pineconeIndex: "sample_scenario_2",
          imageUrl: "/images/pediatrics.jpg",
          createdBy: "system"
        },
        {
          title: "Consultation gynécologique",
          description: "Femme de 35 ans pour suivi gynécologique de routine",
          patientPrompt: "Vous êtes une femme de 35 ans venue pour votre consultation gynécologique annuelle. Vous avez quelques questions sur la contraception.",
          evaluationCriteria: {
            respect_intimite: { weight: 35, description: "Respect de l'intimité et de la pudeur" },
            communication: { weight: 30, description: "Communication bienveillante" },
            examen_clinique: { weight: 35, description: "Examen gynécologique approprié" }
          },
          pineconeIndex: "sample_scenario_3",
          imageUrl: "/images/gynecology.jpg",
          createdBy: "system"
        }
      ];

      // Insert scenarios and get their IDs
      const insertedScenarios = [];
      for (const scenario of sampleScenarios) {
        const [insertedScenario] = await db
          .insert(ecosScenarios)
          .values(scenario)
          .returning();
        insertedScenarios.push(insertedScenario);
        console.log(`✅ Created scenario: ${scenario.title}`);
      }

      // Create a sample training session
      const [trainingSession] = await db
        .insert(trainingSessions)
        .values({
          title: "Formation ECOS - Session Printemps 2025",
          description: "Session de formation pour les étudiants en médecine - ECOS simulation",
          startDate: new Date('2025-03-01'),
          endDate: new Date('2025-06-30'),
          createdBy: "cherubindavid@gmail.com"
        })
        .returning();

      console.log(`✅ Created training session: ${trainingSession.title}`);

      // Link scenarios to training session
      for (const scenario of insertedScenarios) {
        await db
          .insert(trainingSessionScenarios)
          .values({
            trainingSessionId: trainingSession.id,
            scenarioId: scenario.id
          });
      }

      // Add some sample students to the training session
      const sampleStudents = [
        'cherubindavid@gmail.com',
        'colombemadoungou@gmail.com',
        'etudiant1@example.com',
        'etudiant2@example.com'
      ];

      for (const studentEmail of sampleStudents) {
        await db
          .insert(trainingSessionStudents)
          .values({
            trainingSessionId: trainingSession.id,
            studentEmail: studentEmail
          });
        console.log(`✅ Added student to training session: ${studentEmail}`);
      }

      console.log('🌱 Sample data creation completed successfully!');

    } catch (error) {
      console.error('❌ Error creating sample data:', error);
      throw error;
    }
  }

  async getScenariosForStudent(email: string): Promise<any[]> {
    try {
      // Get training sessions for this student
      const studentSessions = await db
        .select()
        .from(trainingSessionStudents)
        .where(eq(trainingSessionStudents.studentEmail, email));

      if (studentSessions.length === 0) {
        return [];
      }

      // Get scenarios for these training sessions
      const scenarios = [];
      for (const session of studentSessions) {
        const sessionScenarios = await db
          .select({
            id: ecosScenarios.id,
            title: ecosScenarios.title,
            description: ecosScenarios.description,
            imageUrl: ecosScenarios.imageUrl,
            trainingSessionId: trainingSessionScenarios.trainingSessionId
          })
          .from(trainingSessionScenarios)
          .innerJoin(
            ecosScenarios,
            eq(trainingSessionScenarios.scenarioId, ecosScenarios.id)
          )
          .where(eq(trainingSessionScenarios.trainingSessionId, session.trainingSessionId));

        scenarios.push(...sessionScenarios);
      }

      return scenarios;
    } catch (error) {
      console.error('Error getting scenarios for student:', error);
      throw error;
    }
  }
}

export const sampleDataService = new SampleDataService();