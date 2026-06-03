export const LAB_STATUSES = ["normal", "alerte", "critique", "a verifier"] as const

export type LabStatus = (typeof LAB_STATUSES)[number]

export type LabMarkerDefinition = {
  key: string
  label: string
  unit: string
  referenceInterval: string
  valueType: "number" | "text"
}

export const LAB_PANEL_DEFINITIONS = [
  {
    type: "Hématologie",
    markers: [
      marker("hemoglobine", "Hémoglobine", "g/dL", "12-16"),
      marker("hematocrite", "Hématocrite", "%", "36-46"),
      marker("erythrocytes", "Érythrocytes", "T/L", "4.0-5.4"),
      marker("vgm", "VGM", "fL", "80-100"),
      marker("tcmh", "TCMH", "pg", "27-32"),
      marker("ccmh", "CCMH", "g/dL", "32-36"),
      marker("leucocytes", "Leucocytes", "G/L", "4.0-10.0"),
      marker("neutrophiles", "Neutrophiles", "G/L", "1.5-7.5"),
      marker("lymphocytes", "Lymphocytes", "G/L", "1.0-4.0"),
      marker("monocytes", "Monocytes", "G/L", "0.2-1.0"),
      marker("eosinophiles", "Éosinophiles", "G/L", "0.0-0.5"),
      marker("basophiles", "Basophiles", "G/L", "0.0-0.2"),
      marker("plaquettes", "Plaquettes", "G/L", "150-400"),
      marker("reticulocytes", "Réticulocytes", "G/L", "25-100"),
    ],
  },
  {
    type: "Ionogramme sanguin",
    markers: [
      marker("sodium", "Sodium", "mmol/L", "135-145"),
      marker("potassium", "Potassium", "mmol/L", "3.5-5.0"),
      marker("chlore", "Chlore", "mmol/L", "98-107"),
      marker("bicarbonates", "Bicarbonates", "mmol/L", "22-29"),
      marker("calcium", "Calcium total", "mmol/L", "2.20-2.60"),
      marker("calcium_corrige", "Calcium corrigé", "mmol/L", "2.20-2.60"),
      marker("phosphore", "Phosphore", "mmol/L", "0.80-1.45"),
      marker("magnesium", "Magnésium", "mmol/L", "0.65-1.05"),
      marker("protides", "Protides", "g/L", "65-80"),
    ],
  },
  {
    type: "Fonction rénale",
    markers: [
      marker("creatinine", "Créatinine", "umol/L", "45-84"),
      marker("uree", "Urée", "mmol/L", "2.5-7.5"),
      marker("dfg_estime", "DFG estimé", "mL/min/1.73m2", "> 60"),
      marker("clairance_creatinine", "Clairance créatinine", "mL/min", "> 90"),
      marker("cystatine_c", "Cystatine C", "mg/L", "0.53-0.95"),
    ],
  },
  {
    type: "Bilan hépatique",
    markers: [
      marker("asat", "ASAT", "U/L", "< 35"),
      marker("alat", "ALAT", "U/L", "< 45"),
      marker("ggt", "GGT", "U/L", "< 55"),
      marker("pal", "Phosphatases alcalines", "U/L", "30-120"),
      marker("bilirubine_totale", "Bilirubine totale", "umol/L", "< 21"),
      marker("bilirubine_conjuguee", "Bilirubine conjuguée", "umol/L", "< 5"),
      marker("albumine", "Albumine", "g/L", "35-50"),
      marker("proteines_totales", "Protéines totales", "g/L", "65-80"),
      marker("ldh", "LDH", "U/L", "135-225"),
    ],
  },
  {
    type: "Bilan inflammatoire",
    markers: [
      marker("crp", "CRP", "mg/L", "< 5"),
      marker("pct", "Procalcitonine", "ug/L", "< 0.05"),
      marker("vs_1h", "VS 1h", "mm", "< 20"),
      marker("fibrinogene", "Fibrinogène", "g/L", "2.0-4.0"),
      marker("ferritine", "Ferritine", "ug/L", "30-300"),
    ],
  },
  {
    type: "Hémostase",
    markers: [
      marker("tp", "TP", "%", "70-100"),
      marker("inr", "INR", "", "0.8-1.2"),
      marker("tca", "Ratio TCA", "", "0.8-1.2"),
      marker("fibrinogene", "Fibrinogène", "g/L", "2.0-4.0"),
      marker("d_dimeres", "D-dimères", "ng/mL", "< 500"),
      marker("anti_xa", "Activité anti-Xa", "UI/mL", "Selon traitement"),
    ],
  },
  {
    type: "Glycémie",
    markers: [
      marker("glucose", "Glucose", "mmol/L", "3.9-5.8"),
      marker("hba1c", "HbA1c", "%", "< 5.7"),
      marker("cetones", "Cétones", "mmol/L", "< 0.6"),
      marker("insuline", "Insuline", "mUI/L", "2.6-24.9"),
      marker("peptide_c", "Peptide C", "nmol/L", "0.37-1.47"),
    ],
  },
  {
    type: "Bilan lipidique",
    markers: [
      marker("cholesterol_total", "Cholestérol total", "mmol/L", "< 5.2"),
      marker("hdl", "Cholestérol HDL", "mmol/L", "> 1.0"),
      marker("ldl", "Cholestérol LDL", "mmol/L", "Selon risque"),
      marker("triglycerides", "Triglycérides", "mmol/L", "< 1.7"),
      marker("non_hdl", "Cholestérol non-HDL", "mmol/L", "Selon risque"),
    ],
  },
  {
    type: "Gaz du sang",
    markers: [
      marker("ph", "pH", "", "7.35-7.45"),
      marker("pao2", "PaO2", "mmHg", "80-100"),
      marker("paco2", "PaCO2", "mmHg", "35-45"),
      marker("hco3", "HCO3-", "mmol/L", "22-26"),
      marker("sao2", "SaO2", "%", "95-100"),
      marker("lactates", "Lactates", "mmol/L", "< 2.0"),
      marker("base_excess", "Excès de base", "mmol/L", "-2 à +2"),
      marker("fio2", "FiO2", "%", "21"),
    ],
  },
  {
    type: "Enzymes cardiaques",
    markers: [
      marker("troponine", "Troponine", "ng/L", "Selon méthode"),
      marker("ck", "CK", "U/L", "< 190"),
      marker("ck_mb", "CK-MB", "ug/L", "< 5"),
      marker("myoglobine", "Myoglobine", "ug/L", "< 72"),
      marker("bnp", "BNP", "pg/mL", "< 100"),
      marker("nt_pro_bnp", "NT-proBNP", "pg/mL", "Selon âge"),
    ],
  },
  {
    type: "Endocrinologie",
    markers: [
      marker("tsh", "TSH", "mUI/L", "0.4-4.0"),
      marker("t4_libre", "T4 libre", "pmol/L", "10-22"),
      marker("t3_libre", "T3 libre", "pmol/L", "3.1-6.8"),
      marker("cortisol", "Cortisol", "nmol/L", "Selon heure"),
      marker("pth", "PTH", "ng/L", "15-65"),
      marker("vitamine_d", "Vitamine D", "ng/mL", "30-60"),
      marker("prolactine", "Prolactine", "ug/L", "Selon sexe"),
    ],
  },
  {
    type: "Microbiologie",
    markers: [
      textMarker("prelevement", "Type de prélèvement", "", "Renseigné"),
      textMarker("examen_direct", "Examen direct", "", "Négatif"),
      textMarker("culture", "Culture", "", "Négative"),
      textMarker("germe", "Germe identifié", "", "Aucun"),
      textMarker("antibiogramme", "Antibiogramme", "", "Selon germe"),
      textMarker("hemocultures", "Hémocultures", "", "Négatives"),
      textMarker("pcr", "PCR ciblée", "", "Négative"),
    ],
  },
  {
    type: "Sérologie",
    markers: [
      textMarker("vih", "VIH", "", "Négatif"),
      textMarker("ag_hbs", "Ag HBs", "", "Négatif"),
      textMarker("anti_hbs", "Ac anti-HBs", "UI/L", "Selon immunité"),
      textMarker("anti_hbc", "Ac anti-HBc", "", "Négatif"),
      textMarker("vhc", "VHC", "", "Négatif"),
      textMarker("syphilis", "Syphilis", "", "Négatif"),
      textMarker("ebv", "EBV", "", "Selon contexte"),
      textMarker("cmv", "CMV", "", "Selon contexte"),
      textMarker("toxoplasmose", "Toxoplasmose", "", "Selon contexte"),
    ],
  },
  {
    type: "Toxicologie",
    markers: [
      marker("ethanol", "Éthanol", "g/L", "< 0.10"),
      marker("paracetamol", "Paracétamol", "mg/L", "Selon délai"),
      marker("salicylates", "Salicylates", "mg/L", "< 30"),
      textMarker("benzodiazepines", "Benzodiazépines", "", "Négatif"),
      textMarker("opiaces", "Opiacés", "", "Négatif"),
      textMarker("cannabis", "Cannabis", "", "Négatif"),
      textMarker("cocaine", "Cocaïne", "", "Négatif"),
    ],
  },
  {
    type: "Urines",
    markers: [
      marker("ph", "pH urinaire", "", "5.0-8.0"),
      marker("densite", "Densité", "", "1.005-1.030"),
      textMarker("proteines", "Protéines", "", "Négatif"),
      textMarker("glucose", "Glucose", "", "Négatif"),
      textMarker("cetones", "Cétones", "", "Négatif"),
      textMarker("nitrites", "Nitrites", "", "Négatif"),
      textMarker("leucocytes", "Leucocytes", "", "Négatif"),
      textMarker("hematies", "Hématies", "", "Négatif"),
      marker("albuminurie", "Albuminurie", "mg/L", "< 20"),
      marker("creatininurie", "Créatininurie", "mmol/L", "Selon diurèse"),
    ],
  },
  {
    type: "Immunologie",
    markers: [
      textMarker("ana", "Anticorps antinucléaires", "", "Négatif"),
      textMarker("anca", "ANCA", "", "Négatif"),
      marker("facteur_rhumatoide", "Facteur rhumatoïde", "UI/mL", "< 14"),
      marker("anti_ccp", "Anti-CCP", "U/mL", "< 20"),
      marker("c3", "Complément C3", "g/L", "0.90-1.80"),
      marker("c4", "Complément C4", "g/L", "0.10-0.40"),
      marker("igg", "IgG", "g/L", "7-16"),
      marker("iga", "IgA", "g/L", "0.7-4.0"),
      marker("igm", "IgM", "g/L", "0.4-2.3"),
    ],
  },
] as const

export type LabPanelType = (typeof LAB_PANEL_DEFINITIONS)[number]["type"]

export const LAB_PANEL_TYPES = LAB_PANEL_DEFINITIONS.map(
  (definition) => definition.type
) as LabPanelType[]

export type LabPanelResult = {
  id: string
  labPanelId: string
  markerKey: string
  markerLabel: string
  value: string
  unit: string
  referenceInterval: string
  status: LabStatus | string
  sortOrder: number
}

export type LabPanel = {
  id: string
  patientId: string
  sampledAt: string
  panelType: LabPanelType | string
  status: LabStatus | string
  createdAt: string
  results: LabPanelResult[]
}

export type LabResult = LabPanel

export function labPanelDefinition(panelType: LabPanelType | string) {
  return (
    LAB_PANEL_DEFINITIONS.find((definition) => definition.type === panelType) ??
    LAB_PANEL_DEFINITIONS[0]
  )
}

function marker(
  key: string,
  label: string,
  unit: string,
  referenceInterval: string
): LabMarkerDefinition {
  return { key, label, unit, referenceInterval, valueType: "number" }
}

function textMarker(
  key: string,
  label: string,
  unit: string,
  referenceInterval: string
): LabMarkerDefinition {
  return { key, label, unit, referenceInterval, valueType: "text" }
}
