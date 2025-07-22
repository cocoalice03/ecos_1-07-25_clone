export const nursingCase01 = {
  id: "nursing-case-001",
  title: "Prise en charge d'un patient diabétique en décompensation",
  category: "Soins infirmiers - Endocrinologie",
  difficulty: "intermediate",
  estimatedTime: 45,
  
  patientInfo: {
    name: "M. Bernard Dubois",
    age: 58,
    gender: "Homme",
    weight: 92,
    height: 175,
    
    chiefComplaint: "Malaise général, soif intense et mictions fréquentes depuis 3 jours",
    
    vitalSigns: {
      bloodPressure: "145/92 mmHg",
      heartRate: 102,
      respiratoryRate: 24,
      temperature: 37.8,
      oxygenSaturation: 96,
      bloodGlucose: 28.5 // mmol/L (très élevé)
    },
    
    medicalHistory: [
      "Diabète de type 2 diagnostiqué il y a 8 ans",
      "Hypertension artérielle",
      "Dyslipidémie",
      "Surpoids (IMC 30.1)"
    ],
    
    currentMedications: [
      "Metformine 850mg 2x/jour",
      "Gliclazide 80mg 1x/jour",
      "Ramipril 5mg 1x/jour",
      "Atorvastatine 20mg 1x/jour"
    ],
    
    allergies: ["Pénicilline (rash cutané)"],
    
    socialHistory: {
      occupation: "Comptable",
      smoking: "Ex-fumeur (arrêt il y a 5 ans)",
      alcohol: "Occasionnel",
      livingConditions: "Vit avec son épouse",
      compliance: "Irrégulière avec son traitement diabétique récemment"
    }
  },
  
  clinicalPresentation: {
    symptoms: [
      "Polyurie (mictions fréquentes, environ 8-10 fois par jour)",
      "Polydipsie (soif intense, boit 4-5 litres par jour)",
      "Fatigue importante",
      "Vision floue intermittente",
      "Perte de poids de 3 kg en 2 semaines",
      "Nausées occasionnelles"
    ],
    
    physicalExamination: {
      general: "Patient conscient, orienté mais fatigué. Muqueuses sèches.",
      cardiovascular: "Tachycardie sinusale, pas de souffle audible",
      respiratory: "Respiration de Kussmaul légère, poumons clairs",
      abdominal: "Souple, indolore, pas d'organomégalie",
      neurological: "Pas de déficit focal, réflexes ostéotendineux normaux",
      skin: "Peau sèche, pli cutané persistant"
    },
    
    labResults: {
      bloodGlucose: "28.5 mmol/L (N: 4-7)",
      HbA1c: "11.2% (N: <7%)",
      ketones: "++ dans les urines",
      sodium: "132 mmol/L (N: 135-145)",
      potassium: "3.2 mmol/L (N: 3.5-5.0)",
      creatinine: "115 μmol/L (N: 60-110)",
      pH: "7.32 (N: 7.35-7.45)"
    }
  },
  
  nursingAssessment: {
    priorityProblems: [
      {
        problem: "Déséquilibre glycémique sévère",
        evidence: "Glycémie à 28.5 mmol/L, cétones urinaires ++",
        priority: 1
      },
      {
        problem: "Déshydratation",
        evidence: "Muqueuses sèches, pli cutané, tachycardie",
        priority: 2
      },
      {
        problem: "Risque d'acidocétose diabétique",
        evidence: "Cétones ++, pH 7.32, respiration de Kussmaul",
        priority: 1
      },
      {
        problem: "Déficit en connaissances sur la gestion du diabète",
        evidence: "Observance médicamenteuse irrégulière",
        priority: 3
      }
    ]
  },
  
  nursingInterventions: [
    {
      intervention: "Surveillance glycémique",
      actions: [
        "Contrôler la glycémie capillaire toutes les heures initialement",
        "Noter les résultats sur la feuille de surveillance",
        "Alerter le médecin si glycémie >30 mmol/L ou <4 mmol/L"
      ],
      rationale: "Permet d'évaluer l'efficacité du traitement et prévenir les complications"
    },
    {
      intervention: "Hydratation",
      actions: [
        "Installer une voie veineuse périphérique",
        "Administrer NaCl 0.9% selon prescription (généralement 1L en 1h puis 500ml/h)",
        "Surveiller les signes de surcharge (dyspnée, œdèmes)",
        "Bilan entrées/sorties strict"
      ],
      rationale: "Corriger la déshydratation et améliorer la perfusion rénale"
    },
    {
      intervention: "Administration d'insuline",
      actions: [
        "Préparer l'insuline rapide selon protocole hospitalier",
        "Vérifier la prescription avec un collègue",
        "Administrer selon le schéma prescrit (généralement perfusion continue)",
        "Surveiller les signes d'hypoglycémie"
      ],
      rationale: "Normaliser la glycémie et stopper la production de cétones"
    },
    {
      intervention: "Surveillance des paramètres vitaux",
      actions: [
        "Prendre les signes vitaux toutes les 2 heures",
        "Surveiller l'état de conscience",
        "Observer le rythme respiratoire",
        "ECG continu si disponible"
      ],
      rationale: "Détecter précocement toute détérioration clinique"
    },
    {
      intervention: "Éducation thérapeutique",
      actions: [
        "Évaluer les connaissances du patient sur le diabète",
        "Expliquer l'importance de l'observance thérapeutique",
        "Démontrer la technique d'auto-surveillance glycémique",
        "Planifier un suivi avec l'infirmière d'éducation diabétique"
      ],
      rationale: "Prévenir les récidives et améliorer l'autogestion"
    }
  ],
  
  expectedOutcomes: [
    {
      timeframe: "4 heures",
      outcomes: [
        "Glycémie < 15 mmol/L",
        "Amélioration de l'état d'hydratation",
        "Stabilité hémodynamique"
      ]
    },
    {
      timeframe: "24 heures",
      outcomes: [
        "Glycémie entre 7-10 mmol/L",
        "Absence de cétones urinaires",
        "Reprise de l'alimentation orale",
        "Patient capable de réaliser une glycémie capillaire"
      ]
    },
    {
      timeframe: "Sortie",
      outcomes: [
        "Glycémies stables sous traitement oral",
        "Patient éduqué sur la gestion du diabète",
        "Rendez-vous de suivi programmé",
        "Observance thérapeutique améliorée"
      ]
    }
  ],
  
  criticalThinkingQuestions: [
    {
      question: "Quels sont les signes cliniques qui vous font suspecter une acidocétose diabétique débutante?",
      expectedElements: [
        "Respiration de Kussmaul",
        "Présence de cétones dans les urines",
        "pH sanguin légèrement acide (7.32)",
        "Hyperglycémie importante",
        "Déshydratation"
      ]
    },
    {
      question: "Pourquoi est-il important de corriger l'hypokaliémie avant d'administrer l'insuline?",
      expectedElements: [
        "L'insuline fait entrer le potassium dans les cellules",
        "Risque d'hypokaliémie sévère",
        "Complications cardiaques potentielles",
        "Nécessité de supplémentation en potassium"
      ]
    },
    {
      question: "Quelles complications devez-vous surveiller pendant le traitement?",
      expectedElements: [
        "Hypoglycémie",
        "Hypokaliémie",
        "Œdème cérébral (rare mais grave)",
        "Surcharge volémique",
        "Troubles du rythme cardiaque"
      ]
    }
  ],
  
  teachingPoints: [
    "Reconnaissance précoce des signes d'hyperglycémie",
    "Importance de la surveillance régulière de la glycémie",
    "Protocoles de réhydratation en contexte diabétique",
    "Gestion sécuritaire de l'insulinothérapie IV",
    "Éducation thérapeutique du patient diabétique",
    "Prévention des complications aiguës du diabète"
  ],
  
  additionalResources: [
    "Protocole institutionnel de prise en charge de l'acidocétose diabétique",
    "Guide de bonnes pratiques - Soins infirmiers au patient diabétique",
    "Fiche technique - Administration d'insuline IV",
    "Outils d'éducation thérapeutique pour patients diabétiques"
  ]
};