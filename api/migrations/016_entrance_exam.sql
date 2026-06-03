CREATE TABLE IF NOT EXISTS clinical_references (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('pathology', 'medical_act')),
  source TEXT NOT NULL CHECK (source IN ('CIM-10', 'CCAM')),
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  search_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (source, code)
);

CREATE INDEX IF NOT EXISTS idx_clinical_references_kind_search
  ON clinical_references(kind, search_text);

CREATE TABLE IF NOT EXISTS entrance_exams (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  visit_id TEXT NOT NULL,
  service TEXT NOT NULL,
  lifestyle TEXT,
  disease_history TEXT,
  synthesis TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (patient_id, visit_id)
);

CREATE INDEX IF NOT EXISTS idx_entrance_exams_patient_visit
  ON entrance_exams(patient_id, visit_id);

CREATE TABLE IF NOT EXISTS patient_antecedents (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  category TEXT NOT NULL CHECK (category IN ('pathology', 'medical_act', 'heavy_treatment')),
  source TEXT,
  code TEXT,
  label TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_patient_antecedents_patient_category
  ON patient_antecedents(patient_id, category, created_at DESC);

INSERT OR IGNORE INTO clinical_references (id, kind, source, code, label, search_text) VALUES
  ('cim10-i10', 'pathology', 'CIM-10', 'I10', 'Hypertension essentielle (primitive)', 'i10 hypertension essentielle primitive'),
  ('cim10-e119', 'pathology', 'CIM-10', 'E11.9', 'Diabete sucre de type 2 sans complication', 'e11 9 diabete sucre type 2 sans complication'),
  ('cim10-j459', 'pathology', 'CIM-10', 'J45.9', 'Asthme, sans precision', 'j45 9 asthme sans precision'),
  ('cim10-i251', 'pathology', 'CIM-10', 'I25.1', 'Cardiopathie arteriosclereuse', 'i25 1 cardiopathie arteriosclereuse coronaropathie'),
  ('cim10-i509', 'pathology', 'CIM-10', 'I50.9', 'Insuffisance cardiaque, sans precision', 'i50 9 insuffisance cardiaque sans precision'),
  ('cim10-n189', 'pathology', 'CIM-10', 'N18.9', 'Insuffisance renale chronique, sans precision', 'n18 9 insuffisance renale chronique sans precision'),
  ('cim10-c349', 'pathology', 'CIM-10', 'C34.9', 'Tumeur maligne des bronches ou du poumon, sans precision', 'c34 9 tumeur maligne bronches poumon cancer sans precision'),
  ('cim10-f329', 'pathology', 'CIM-10', 'F32.9', 'Episode depressif, sans precision', 'f32 9 episode depressif depression sans precision'),
  ('cim10-k219', 'pathology', 'CIM-10', 'K21.9', 'Reflux gastro-oesophagien sans oesophagite', 'k21 9 reflux gastro oesophagien sans oesophagite'),
  ('cim10-m545', 'pathology', 'CIM-10', 'M54.5', 'Lombalgie basse', 'm54 5 lombalgie basse'),
  ('cim10-e785', 'pathology', 'CIM-10', 'E78.5', 'Hyperlipidemie, sans precision', 'e78 5 hyperlipidemie dyslipidemie sans precision'),
  ('cim10-e669', 'pathology', 'CIM-10', 'E66.9', 'Obesite, sans precision', 'e66 9 obesite sans precision'),
  ('cim10-j449', 'pathology', 'CIM-10', 'J44.9', 'Maladie pulmonaire obstructive chronique, sans precision', 'j44 9 maladie pulmonaire obstructive chronique bpco sans precision'),
  ('cim10-i489', 'pathology', 'CIM-10', 'I48.9', 'Fibrillation et flutter auriculaires, sans precision', 'i48 9 fibrillation flutter auriculaire sans precision'),
  ('cim10-i639', 'pathology', 'CIM-10', 'I63.9', 'Infarctus cerebral, sans precision', 'i63 9 infarctus cerebral avc ischemique sans precision'),
  ('cim10-g409', 'pathology', 'CIM-10', 'G40.9', 'Epilepsie, sans precision', 'g40 9 epilepsie sans precision'),
  ('cim10-k746', 'pathology', 'CIM-10', 'K74.6', 'Cirrhose du foie, autre et sans precision', 'k74 6 cirrhose foie sans precision'),
  ('cim10-b182', 'pathology', 'CIM-10', 'B18.2', 'Hepatite virale chronique C', 'b18 2 hepatite virale chronique c'),
  ('cim10-c509', 'pathology', 'CIM-10', 'C50.9', 'Tumeur maligne du sein, sans precision', 'c50 9 tumeur maligne sein cancer sans precision'),
  ('cim10-f419', 'pathology', 'CIM-10', 'F41.9', 'Trouble anxieux, sans precision', 'f41 9 trouble anxieux anxiete sans precision'),
  ('cim10-m179', 'pathology', 'CIM-10', 'M17.9', 'Gonarthrose, sans precision', 'm17 9 gonarthrose arthrose genou sans precision'),
  ('cim10-n40', 'pathology', 'CIM-10', 'N40', 'Hyperplasie de la prostate', 'n40 hyperplasie prostate hypertrophie benigne'),
  ('cim10-d509', 'pathology', 'CIM-10', 'D50.9', 'Anemie par carence en fer, sans precision', 'd50 9 anemie carence fer martiale sans precision'),
  ('ccam-hhfa001', 'medical_act', 'CCAM', 'HHFA001', 'Appendicectomie, par abord de la fosse iliaque', 'hhfa001 appendicectomie abord fosse iliaque'),
  ('ccam-hhfa016', 'medical_act', 'CCAM', 'HHFA016', 'Appendicectomie, par coelioscopie ou par laparotomie avec preparation par coelioscopie', 'hhfa016 appendicectomie coelioscopie laparotomie preparation coelioscopie'),
  ('ccam-hhfa025', 'medical_act', 'CCAM', 'HHFA025', 'Appendicectomie avec toilette peritoneale pour peritonite aigue generalisee', 'hhfa025 appendicectomie toilette peritoneale peritonite aigue generalisee'),
  ('ccam-hmfc004', 'medical_act', 'CCAM', 'HMFC004', 'Cholecystectomie, par coelioscopie', 'hmfc004 cholecystectomie coelioscopie'),
  ('ccam-hmfc001', 'medical_act', 'CCAM', 'HMFC001', 'Cholecystectomie avec ablation transcystique de calcul de la voie biliaire principale, par coelioscopie', 'hmfc001 cholecystectomie ablation transcystique calcul voie biliaire principale coelioscopie'),
  ('ccam-hmfa004', 'medical_act', 'CCAM', 'HMFA004', 'Cholecystectomie avec ablation transcystique de calcul de la voie biliaire principale, par laparotomie', 'hmfa004 cholecystectomie ablation transcystique calcul voie biliaire principale laparotomie'),
  ('ccam-jqgd001', 'medical_act', 'CCAM', 'JQGD001', 'Accouchement cephalique unique par voie naturelle', 'jqgd001 accouchement cephalique unique voie naturelle'),
  ('ccam-jqga002', 'medical_act', 'CCAM', 'JQGA002', 'Accouchement par cesarienne programmee, par laparotomie', 'jqga002 accouchement cesarienne programmee laparotomie'),
  ('ccam-jqga003', 'medical_act', 'CCAM', 'JQGA003', 'Accouchement par cesarienne au cours du travail, par laparotomie', 'jqga003 accouchement cesarienne cours travail laparotomie'),
  ('ccam-jqga004', 'medical_act', 'CCAM', 'JQGA004', 'Accouchement par cesarienne en urgence en dehors du travail, par laparotomie', 'jqga004 accouchement cesarienne urgence dehors travail laparotomie'),
  ('ccam-jqga005', 'medical_act', 'CCAM', 'JQGA005', 'Accouchement par cesarienne, par abord vaginal', 'jqga005 accouchement cesarienne abord vaginal'),
  ('ccam-zcqh001', 'medical_act', 'CCAM', 'ZCQH001', 'Scanographie de l''abdomen et du petit bassin avec injection intraveineuse de produit de contraste', 'zcqh001 scanographie abdomen petit bassin injection intraveineuse produit contraste scanner'),
  ('ccam-zcqh002', 'medical_act', 'CCAM', 'ZCQH002', 'Scanographie de l''abdomen ou du petit bassin avec injection intraveineuse de produit de contraste', 'zcqh002 scanographie abdomen petit bassin injection intraveineuse produit contraste scanner'),
  ('ccam-zcqk004', 'medical_act', 'CCAM', 'ZCQK004', 'Scanographie de l''abdomen et du petit bassin sans injection intraveineuse de produit de contraste', 'zcqk004 scanographie abdomen petit bassin sans injection intraveineuse produit contraste scanner'),
  ('ccam-zcqk005', 'medical_act', 'CCAM', 'ZCQK005', 'Scanographie de l''abdomen ou du petit bassin sans injection intraveineuse de produit de contraste', 'zcqk005 scanographie abdomen petit bassin sans injection intraveineuse produit contraste scanner'),
  ('ccam-elqh002', 'medical_act', 'CCAM', 'ELQH002', 'Scanographie des vaisseaux de l''abdomen et/ou du petit bassin', 'elqh002 scanographie vaisseaux abdomen petit bassin angioscanner abdominopelvien'),
  ('ccam-zcqm005', 'medical_act', 'CCAM', 'ZCQM005', 'Echographie transcutanee de l''abdomen avec echographie transcutanee du petit bassin', 'zcqm005 echographie transcutanee abdomen petit bassin pelvis'),
  ('ccam-eqqh001', 'medical_act', 'CCAM', 'EQQH001', 'Mesure et enregistrement des pressions du coeur droit et de l''artere pulmonaire avec injection de produit de contraste, par voie veineuse transcutanee', 'eqqh001 mesure enregistrement pressions coeur droit artere pulmonaire injection produit contraste voie veineuse transcutanee'),
  ('ccam-eqqh002', 'medical_act', 'CCAM', 'EQQH002', 'Mesure et enregistrement des pressions du coeur gauche et de l''aorte avec injection de produit de contraste, par voie arterielle transcutanee', 'eqqh002 mesure enregistrement pressions coeur gauche aorte injection produit contraste voie arterielle transcutanee'),
  ('ccam-hffc018', 'medical_act', 'CCAM', 'HFFC018', 'Gastrectomie longitudinale pour obesite morbide, par coelioscopie', 'hffc018 gastrectomie longitudinale sleeve obesite morbide coelioscopie');
