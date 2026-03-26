export interface IsoQuestion {
  index: number
  question: string
  options: string[]
  /** hazards triggered by specific answer choices */
  triggers: Record<string, string[]>
}

export interface IsoModule {
  module: number
  name: string
  questions: IsoQuestion[]
}

export const ISO_MODULES: IsoModule[] = [
  {
    module: 1,
    name: 'Device Role & Intended Use',
    questions: [
      {
        index: 1,
        question: 'What is the primary purpose of your device?',
        options: ['Diagnosis', 'Treatment / Therapy', 'Monitoring', 'Life support', 'Other'],
        triggers: {},
      },
      {
        index: 2,
        question: 'Is the device in direct contact with the patient (skin, tissue, blood, or body fluid)?',
        options: ['Yes', 'No'],
        triggers: { Yes: ['Biological Hazards', 'Chemical Hazards'] },
      },
      {
        index: 3,
        question: 'Does the device sustain or support life (e.g. ventilator, pacemaker, infusion pump)?',
        options: ['Yes', 'No'],
        triggers: { Yes: ['Critical Failure Mode Hazards'] },
      },
      {
        index: 4,
        question: 'If the device fails, is special clinical intervention required (e.g. emergency surgery, ICU admission)?',
        options: ['Yes', 'No'],
        triggers: { Yes: ['High-Severity Failure Hazards'] },
      },
      {
        index: 5,
        question: 'Who are the primary users of the device?',
        options: ['Clinical professional', 'Non-clinical staff', 'Patient / lay user (self-administered)', 'Paediatric or vulnerable population'],
        triggers: {
          'Patient / lay user (self-administered)': ['Use Error / Human Factors Hazards'],
          'Paediatric or vulnerable population': ['Use Error / Human Factors Hazards'],
        },
      },
    ],
  },
  {
    module: 2,
    name: 'Energy Hazards',
    questions: [
      {
        index: 1,
        question: 'Does the device deliver electrical energy to or through the patient?',
        options: ['Yes', 'No'],
        triggers: { Yes: ['Electrical Energy Hazards'] },
      },
      {
        index: 2,
        question: 'Does the device have moving parts, pressurised fluid, springs, or cutting elements?',
        options: ['Yes', 'No'],
        triggers: { Yes: ['Mechanical Energy Hazards'] },
      },
      {
        index: 3,
        question: 'Does the device generate or apply heat or cold to the patient?',
        options: ['Yes', 'No'],
        triggers: { Yes: ['Thermal Energy Hazards'] },
      },
      {
        index: 4,
        question: 'Does the device emit radiation (X-ray, laser, ultrasound, RF, UV, etc.)?',
        options: ['Yes', 'No'],
        triggers: { Yes: ['Radiation / Acoustic Energy Hazards'] },
      },
      {
        index: 5,
        question: 'Does the device contain flammable, pressurised, or explosive materials (e.g. battery, gas cartridge)?',
        options: ['Yes', 'No'],
        triggers: { Yes: ['Chemical Energy Hazards'] },
      },
    ],
  },
  {
    module: 3,
    name: 'Biological & Chemical Hazards',
    questions: [
      {
        index: 1,
        question: 'Does the device incorporate biological materials (animal-derived, human tissue, cells)?',
        options: ['Yes', 'No'],
        triggers: { Yes: ['Biological Contamination Hazards'] },
      },
      {
        index: 2,
        question: 'Is the device intended to be sterile or is sterility critical to safe use?',
        options: ['Yes', 'No'],
        triggers: { Yes: ['Sterility Breach Hazards'] },
      },
      {
        index: 3,
        question: 'Does the device contain chemical substances (coatings, adhesives, leachables, dyes)?',
        options: ['Yes', 'No'],
        triggers: { Yes: ['Chemical Substance Hazards'] },
      },
      {
        index: 4,
        question: 'Is the device implantable or in prolonged contact with the patient (>24 hours)?',
        options: ['Yes', 'No'],
        triggers: { Yes: ['Chronic Biological Hazards', 'Implant Corrosion / Carcinogenicity Hazards'] },
      },
    ],
  },
  {
    module: 4,
    name: 'Software, Cybersecurity & Data Hazards',
    questions: [
      {
        index: 1,
        question: 'Does the device include software, firmware, or a companion app?',
        options: ['Yes', 'No'],
        triggers: { Yes: ['Software / Information Hazards'] },
      },
      {
        index: 2,
        question: 'Is the device connected to a network or other devices (wired or wireless)?',
        options: ['Yes', 'No'],
        triggers: { Yes: ['Cybersecurity Hazards'] },
      },
      {
        index: 3,
        question: 'Does the device store or transmit patient data?',
        options: ['Yes', 'No'],
        triggers: { Yes: ['Data Privacy & Integrity Hazards'] },
      },
      {
        index: 4,
        question: 'Can the device firmware or software be updated remotely or by the user?',
        options: ['Yes', 'No'],
        triggers: { Yes: ['Software Update Hazards'] },
      },
    ],
  },
  {
    module: 5,
    name: 'AI / ML Hazards',
    questions: [
      {
        index: 1,
        question: 'Does the device use AI or machine learning for clinical decisions or diagnosis?',
        options: ['Yes', 'No'],
        triggers: { Yes: ['AI/ML Algorithmic Bias Hazards', 'AI/ML Model Drift Hazards'] },
      },
      {
        index: 2,
        question: 'Is the AI algorithm adaptive (continues learning after deployment)?',
        options: ['Yes', 'No', 'Not applicable'],
        triggers: { Yes: ['AI/ML Model Drift Hazards'] },
      },
      {
        index: 3,
        question: 'Does the device act autonomously without mandatory clinician review before action?',
        options: ['Yes', 'No'],
        triggers: { Yes: ['Autonomous Decision Hazards'] },
      },
    ],
  },
  {
    module: 6,
    name: 'Use Environment & Human Factors',
    questions: [
      {
        index: 1,
        question: 'Where will the device primarily be used?',
        options: ['Hospital / clinical setting', 'Home / self-care', 'Emergency / EMS', 'MRI environment', 'Other'],
        triggers: {
          'Home / self-care': ['Environmental Hazards', 'Use Error / Human Factors Hazards'],
          'MRI environment': ['Magnetic Field Hazards'],
        },
      },
      {
        index: 2,
        question: 'Will the device be used alongside other devices that could cause electromagnetic interference?',
        options: ['Yes', 'No'],
        triggers: { Yes: ['Electromagnetic Interference (EMC) Hazards'] },
      },
      {
        index: 3,
        question: 'Could a user reasonably misuse the device (wrong patient, wrong dose, ignoring alarms)?',
        options: ['Yes', 'No'],
        triggers: { Yes: ['Use Error / Misuse Hazards'] },
      },
      {
        index: 4,
        question: 'Does the device produce waste requiring special disposal (sharps, biological, chemical)?',
        options: ['Yes', 'No'],
        triggers: { Yes: ['Disposal / Contamination Hazards'] },
      },
    ],
  },
]

/**
 * Compute triggered hazard categories from a map of answers.
 * Key format: `${module}-${questionIndex}`, value: selected option string.
 */
export function computeHazardCategories(answers: Record<string, string>): string[] {
  const hazards = new Set<string>()
  for (const mod of ISO_MODULES) {
    for (const q of mod.questions) {
      const key = `${mod.module}-${q.index}`
      const answer = answers[key]
      if (!answer) continue
      const triggered = q.triggers[answer]
      if (triggered) triggered.forEach(h => hazards.add(h))
    }
  }
  return Array.from(hazards)
}
