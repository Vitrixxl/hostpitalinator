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
    type: "Hematologie",
    markers: [
      marker("hemoglobine", "Hemoglobine", "g/dL", "12-16"),
      marker("hematocrite", "Hematocrite", "%", "36-46"),
      marker("erythrocytes", "Erythrocytes", "T/L", "4.0-5.4"),
      marker("vgm", "VGM", "fL", "80-100"),
      marker("tcmh", "TCMH", "pg", "27-32"),
      marker("ccmh", "CCMH", "g/dL", "32-36"),
      marker("leucocytes", "Leucocytes", "G/L", "4.0-10.0"),
      marker("neutrophiles", "Neutrophiles", "G/L", "1.5-7.5"),
      marker("lymphocytes", "Lymphocytes", "G/L", "1.0-4.0"),
      marker("monocytes", "Monocytes", "G/L", "0.2-1.0"),
      marker("eosinophiles", "Eosinophiles", "G/L", "0.0-0.5"),
      marker("basophiles", "Basophiles", "G/L", "0.0-0.2"),
      marker("plaquettes", "Plaquettes", "G/L", "150-400"),
      marker("reticulocytes", "Reticulocytes", "G/L", "25-100"),
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
      marker("calcium_corrige", "Calcium corrige", "mmol/L", "2.20-2.60"),
      marker("phosphore", "Phosphore", "mmol/L", "0.80-1.45"),
      marker("magnesium", "Magnesium", "mmol/L", "0.65-1.05"),
      marker("protides", "Protides", "g/L", "65-80"),
    ],
  },
  {
    type: "Fonction renale",
    markers: [
      marker("creatinine", "Creatinine", "umol/L", "45-84"),
      marker("uree", "Uree", "mmol/L", "2.5-7.5"),
      marker("dfg_estime", "DFG estime", "mL/min/1.73m2", "> 60"),
      marker("clairance_creatinine", "Clairance creatinine", "mL/min", "> 90"),
      marker("cystatine_c", "Cystatine C", "mg/L", "0.53-0.95"),
    ],
  },
  {
    type: "Bilan hepatique",
    markers: [
      marker("asat", "ASAT", "U/L", "< 35"),
      marker("alat", "ALAT", "U/L", "< 45"),
      marker("ggt", "GGT", "U/L", "< 55"),
      marker("pal", "Phosphatases alcalines", "U/L", "30-120"),
      marker("bilirubine_totale", "Bilirubine totale", "umol/L", "< 21"),
      marker("bilirubine_conjuguee", "Bilirubine conjuguee", "umol/L", "< 5"),
      marker("albumine", "Albumine", "g/L", "35-50"),
      marker("proteines_totales", "Proteines totales", "g/L", "65-80"),
      marker("ldh", "LDH", "U/L", "135-225"),
    ],
  },
  {
    type: "Bilan inflammatoire",
    markers: [
      marker("crp", "CRP", "mg/L", "< 5"),
      marker("pct", "Procalcitonine", "ug/L", "< 0.05"),
      marker("vs_1h", "VS 1h", "mm", "< 20"),
      marker("fibrinogene", "Fibrinogene", "g/L", "2.0-4.0"),
      marker("ferritine", "Ferritine", "ug/L", "30-300"),
    ],
  },
  {
    type: "Hemostase",
    markers: [
      marker("tp", "TP", "%", "70-100"),
      marker("inr", "INR", "", "0.8-1.2"),
      marker("tca", "TCA ratio", "", "0.8-1.2"),
      marker("fibrinogene", "Fibrinogene", "g/L", "2.0-4.0"),
      marker("d_dimeres", "D-dimeres", "ng/mL", "< 500"),
      marker("anti_xa", "Activite anti-Xa", "UI/mL", "Selon traitement"),
    ],
  },
  {
    type: "Glycemie",
    markers: [
      marker("glucose", "Glucose", "mmol/L", "3.9-5.8"),
      marker("hba1c", "HbA1c", "%", "< 5.7"),
      marker("cetones", "Cetones", "mmol/L", "< 0.6"),
      marker("insuline", "Insuline", "mUI/L", "2.6-24.9"),
      marker("peptide_c", "Peptide C", "nmol/L", "0.37-1.47"),
    ],
  },
  {
    type: "Bilan lipidique",
    markers: [
      marker("cholesterol_total", "Cholesterol total", "mmol/L", "< 5.2"),
      marker("hdl", "HDL cholesterol", "mmol/L", "> 1.0"),
      marker("ldl", "LDL cholesterol", "mmol/L", "Selon risque"),
      marker("triglycerides", "Triglycerides", "mmol/L", "< 1.7"),
      marker("non_hdl", "Non-HDL cholesterol", "mmol/L", "Selon risque"),
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
      marker("base_excess", "Base excess", "mmol/L", "-2 a +2"),
      marker("fio2", "FiO2", "%", "21"),
    ],
  },
  {
    type: "Enzymes cardiaques",
    markers: [
      marker("troponine", "Troponine", "ng/L", "Selon methode"),
      marker("ck", "CK", "U/L", "< 190"),
      marker("ck_mb", "CK-MB", "ug/L", "< 5"),
      marker("myoglobine", "Myoglobine", "ug/L", "< 72"),
      marker("bnp", "BNP", "pg/mL", "< 100"),
      marker("nt_pro_bnp", "NT-proBNP", "pg/mL", "Selon age"),
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
      textMarker("prelevement", "Type de prelevement", "", "Renseigne"),
      textMarker("examen_direct", "Examen direct", "", "Negatif"),
      textMarker("culture", "Culture", "", "Negative"),
      textMarker("germe", "Germe identifie", "", "Aucun"),
      textMarker("antibiogramme", "Antibiogramme", "", "Selon germe"),
      textMarker("hemocultures", "Hemocultures", "", "Negatives"),
      textMarker("pcr", "PCR ciblee", "", "Negative"),
    ],
  },
  {
    type: "Serologie",
    markers: [
      textMarker("vih", "VIH", "", "Negatif"),
      textMarker("ag_hbs", "Ag HBs", "", "Negatif"),
      textMarker("anti_hbs", "Ac anti-HBs", "UI/L", "Selon immunite"),
      textMarker("anti_hbc", "Ac anti-HBc", "", "Negatif"),
      textMarker("vhc", "VHC", "", "Negatif"),
      textMarker("syphilis", "Syphilis", "", "Negatif"),
      textMarker("ebv", "EBV", "", "Selon contexte"),
      textMarker("cmv", "CMV", "", "Selon contexte"),
      textMarker("toxoplasmose", "Toxoplasmose", "", "Selon contexte"),
    ],
  },
  {
    type: "Toxicologie",
    markers: [
      marker("ethanol", "Ethanol", "g/L", "< 0.10"),
      marker("paracetamol", "Paracetamol", "mg/L", "Selon delai"),
      marker("salicylates", "Salicylates", "mg/L", "< 30"),
      textMarker("benzodiazepines", "Benzodiazepines", "", "Negatif"),
      textMarker("opiaces", "Opiaces", "", "Negatif"),
      textMarker("cannabis", "Cannabis", "", "Negatif"),
      textMarker("cocaine", "Cocaine", "", "Negatif"),
    ],
  },
  {
    type: "Urines",
    markers: [
      marker("ph", "pH urinaire", "", "5.0-8.0"),
      marker("densite", "Densite", "", "1.005-1.030"),
      textMarker("proteines", "Proteines", "", "Negatif"),
      textMarker("glucose", "Glucose", "", "Negatif"),
      textMarker("cetones", "Cetones", "", "Negatif"),
      textMarker("nitrites", "Nitrites", "", "Negatif"),
      textMarker("leucocytes", "Leucocytes", "", "Negatif"),
      textMarker("hematies", "Hematies", "", "Negatif"),
      marker("albuminurie", "Albuminurie", "mg/L", "< 20"),
      marker("creatininurie", "Creatininurie", "mmol/L", "Selon diurese"),
    ],
  },
  {
    type: "Immunologie",
    markers: [
      textMarker("ana", "Anticorps antinucleaires", "", "Negatif"),
      textMarker("anca", "ANCA", "", "Negatif"),
      marker("facteur_rhumatoide", "Facteur rhumatoide", "UI/mL", "< 14"),
      marker("anti_ccp", "Anti-CCP", "U/mL", "< 20"),
      marker("c3", "Complement C3", "g/L", "0.90-1.80"),
      marker("c4", "Complement C4", "g/L", "0.10-0.40"),
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
