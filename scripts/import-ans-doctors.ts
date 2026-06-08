import { existsSync } from "node:fs"
import { Database } from "bun:sqlite"

const DATASET_API_URL =
  "https://www.data.gouv.fr/api/1/datasets/annuaire-sante-extractions-des-donnees-en-libre-acces-des-professionnels-intervenant-dans-le-systeme-de-sante-rpps/"
const DEFAULT_DATABASE_URL = "sqlite://api/data/hospitalinator.sqlite"
const DOCTOR_PROFESSION_CODE = "10"
const DOCTOR_PROFESSION_LABEL = "Médecin"
const ANS_RPPS_SOURCE = "ANS_RPPS"
const STALE_SOURCE_LABEL = "Absent de la dernière importation ANS RPPS"
const MAX_AGGREGATED_VALUES = 8

type DatasetResource = {
  title?: string
  latest?: string
  url?: string
}

type DatasetResponse = {
  resources?: DatasetResource[]
}

type DoctorImportRow = {
  id: string
  nationalId: string
  civility: string
  firstName: string
  lastName: string
  professionCode: string
  professionLabel: string
  categoryCode: string
  categoryLabel: string
  specialties: Set<string>
  specialtyCodes: Set<string>
  practiceModes: Set<string>
  practiceLocations: Set<string>
  phoneNumbers: Set<string>
  emails: Set<string>
}

const databasePath = sqlitePathFromDatabaseUrl(
  process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
)

if (!existsSync(databasePath)) {
  throw new Error(
    `Base SQLite introuvable: ${databasePath}. Lance l'API une fois pour appliquer les migrations.`,
  )
}

const resources = await resolveAnnuaireSanteResources()
const sourceUpdatedAt = new Date().toISOString().slice(0, 10)
const doctors = new Map<string, DoctorImportRow>()

console.log("Téléchargement ANS RPPS: professionnels et activités...")
await streamPipeSeparatedRows(resources.personActivityUrl, (row) => {
  if (clean(row["Code profession"]) !== DOCTOR_PROFESSION_CODE) {
    return
  }

  const doctor = ensureDoctor(doctors, row)
  addValue(doctor.specialties, row["Libellé savoir-faire"])
  addValue(doctor.specialtyCodes, row["Code savoir-faire"])
  addValue(doctor.practiceModes, row["Libellé mode exercice"])
  addValue(doctor.practiceLocations, formatPracticeLocation(row))
  addValue(doctor.phoneNumbers, row["Téléphone (coord. structure)"])
  addValue(doctor.phoneNumbers, row["Téléphone 2 (coord. structure)"])
  addValue(doctor.emails, row["Adresse e-mail (coord. structure)"])
})

console.log("Téléchargement ANS RPPS: savoir-faire...")
await streamPipeSeparatedRows(resources.savoirFaireUrl, (row) => {
  if (clean(row["Code profession"]) !== DOCTOR_PROFESSION_CODE) {
    return
  }

  const doctor = doctors.get(clean(row["Identifiant PP"]))

  if (!doctor) {
    return
  }

  addValue(doctor.specialties, row["Libellé savoir-faire"])
  addValue(doctor.specialtyCodes, row["Code savoir-faire"])
})

const db = new Database(databasePath)

db.exec("PRAGMA foreign_keys = ON")
ensureDoctorsSchema(db)

const markStale = db.prepare(
  `
  UPDATE doctors
  SET source = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE source = ?
  `,
)
const upsertDoctor = db.prepare(
  `
  INSERT INTO doctors (
    id,
    national_id,
    civility,
    first_name,
    last_name,
    profession_code,
    profession_label,
    category_code,
    category_label,
    specialties,
    specialty_codes,
    specialty_search_text,
    practice_modes,
    practice_locations,
    phone_numbers,
    emails,
    search_text,
    source,
    source_updated_at
  ) VALUES (
    $id,
    $nationalId,
    $civility,
    $firstName,
    $lastName,
    $professionCode,
    $professionLabel,
    $categoryCode,
    $categoryLabel,
    $specialties,
    $specialtyCodes,
    $specialtySearchText,
    $practiceModes,
    $practiceLocations,
    $phoneNumbers,
    $emails,
    $searchText,
    $source,
    $sourceUpdatedAt
  )
  ON CONFLICT(id) DO UPDATE SET
    national_id = excluded.national_id,
    civility = excluded.civility,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    profession_code = excluded.profession_code,
    profession_label = excluded.profession_label,
    category_code = excluded.category_code,
    category_label = excluded.category_label,
    specialties = excluded.specialties,
    specialty_codes = excluded.specialty_codes,
    specialty_search_text = excluded.specialty_search_text,
    practice_modes = excluded.practice_modes,
    practice_locations = excluded.practice_locations,
    phone_numbers = excluded.phone_numbers,
    emails = excluded.emails,
    search_text = excluded.search_text,
    source = excluded.source,
    source_updated_at = excluded.source_updated_at,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  `,
)

const importDoctors = db.transaction(() => {
  markStale.run(STALE_SOURCE_LABEL, ANS_RPPS_SOURCE)

  for (const doctor of doctors.values()) {
    const specialties = compactValues(doctor.specialties, 32)
    const specialtyCodes = compactValues(doctor.specialtyCodes, 32)
    const practiceModes = compactValues(doctor.practiceModes)
    const practiceLocations = compactValues(doctor.practiceLocations)
    const phoneNumbers = compactValues(doctor.phoneNumbers)
    const emails = compactValues(doctor.emails)
    const specialtySearchText = normalizeSearch(specialties)
    const searchText = normalizeSearch(
      [doctor.firstName, doctor.lastName, specialties].join(" "),
    )

    upsertDoctor.run({
      $id: doctor.id,
      $nationalId: doctor.nationalId,
      $civility: doctor.civility,
      $firstName: doctor.firstName,
      $lastName: doctor.lastName,
      $professionCode: doctor.professionCode,
      $professionLabel: doctor.professionLabel,
      $categoryCode: doctor.categoryCode,
      $categoryLabel: doctor.categoryLabel,
      $specialties: specialties,
      $specialtyCodes: specialtyCodes,
      $specialtySearchText: specialtySearchText,
      $practiceModes: practiceModes,
      $practiceLocations: practiceLocations,
      $phoneNumbers: phoneNumbers,
      $emails: emails,
      $searchText: searchText,
      $source: ANS_RPPS_SOURCE,
      $sourceUpdatedAt: sourceUpdatedAt,
    })
  }
})

importDoctors()
db.close()

console.log(`Import ANS RPPS terminé: ${doctors.size} médecins.`)

async function resolveAnnuaireSanteResources() {
  const response = await fetch(DATASET_API_URL)

  if (!response.ok) {
    throw new Error(
      `Metadata data.gouv.fr indisponibles (${response.status}) pour ${DATASET_API_URL}`,
    )
  }

  const dataset = (await response.json()) as DatasetResponse
  const resources = dataset.resources ?? []
  const personActivity = resources.find((resource) =>
    resource.title?.toLowerCase().includes("personne-activite"),
  )
  const savoirFaire = resources.find((resource) =>
    resource.title?.toLowerCase().includes("savoirfaire"),
  )

  if (!personActivity?.latest && !personActivity?.url) {
    throw new Error("Fichier PS_LibreAcces_Personne_activite introuvable")
  }

  if (!savoirFaire?.latest && !savoirFaire?.url) {
    throw new Error("Fichier PS_LibreAcces_SavoirFaire introuvable")
  }

  return {
    personActivityUrl: personActivity.latest ?? personActivity.url ?? "",
    savoirFaireUrl: savoirFaire.latest ?? savoirFaire.url ?? "",
  }
}

async function streamPipeSeparatedRows(
  url: string,
  onRow: (row: Record<string, string>) => void,
) {
  const response = await fetch(url)

  if (!response.ok || !response.body) {
    throw new Error(`Téléchargement impossible (${response.status}) pour ${url}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder("utf-8")
  let buffer = ""
  let headers: string[] | null = null
  let rowCount = 0

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const rawLine of lines) {
      const line = rawLine.replace(/\r$/, "")

      if (!line) {
        continue
      }

      if (!headers) {
        headers = line.split("|").map(clean)
        continue
      }

      onRow(rowFromLine(headers, line))
      rowCount += 1

      if (rowCount % 250_000 === 0) {
        console.log(`${rowCount.toLocaleString("fr-FR")} lignes traitées...`)
      }
    }

    if (done) {
      break
    }
  }

  const tail = buffer.replace(/\r$/, "")

  if (tail && headers) {
    onRow(rowFromLine(headers, tail))
  }
}

function rowFromLine(headers: string[], line: string) {
  const fields = line.split("|")
  const row: Record<string, string> = {}

  for (let index = 0; index < headers.length; index += 1) {
    row[headers[index]] = clean(fields[index])
  }

  return row
}

function ensureDoctor(
  doctors: Map<string, DoctorImportRow>,
  row: Record<string, string>,
) {
  const id = clean(row["Identifiant PP"])
  const existing = doctors.get(id)

  if (existing) {
    return existing
  }

  const doctor: DoctorImportRow = {
    id,
    nationalId: clean(row["Identification nationale PP"]),
    civility: clean(row["Libellé civilité d'exercice"] || row["Libellé civilité"]),
    firstName: clean(row["Prénom d'exercice"]),
    lastName: clean(row["Nom d'exercice"]),
    professionCode: clean(row["Code profession"]) || DOCTOR_PROFESSION_CODE,
    professionLabel: clean(row["Libellé profession"]) || DOCTOR_PROFESSION_LABEL,
    categoryCode: clean(row["Code catégorie professionnelle"]),
    categoryLabel: clean(row["Libellé catégorie professionnelle"]),
    specialties: new Set<string>(),
    specialtyCodes: new Set<string>(),
    practiceModes: new Set<string>(),
    practiceLocations: new Set<string>(),
    phoneNumbers: new Set<string>(),
    emails: new Set<string>(),
  }

  if (doctor.id) {
    doctors.set(doctor.id, doctor)
  }

  return doctor
}

function formatPracticeLocation(row: Record<string, string>) {
  const site = clean(
    row["Raison sociale site"] || row["Enseigne commerciale site"],
  )
  const address = compactLine([
    row["Numéro Voie (coord. structure)"],
    row["Libellé type de voie (coord. structure)"],
    row["Libellé Voie (coord. structure)"],
  ])
  const city = compactLine([
    row["Code postal (coord. structure)"],
    row["Libellé commune (coord. structure)"],
  ])

  return compactLine([site, address, city], " - ")
}

function addValue(values: Set<string>, value: string | undefined) {
  const cleaned = clean(value)

  if (cleaned) {
    values.add(cleaned)
  }
}

function compactValues(values: Set<string>, limit = MAX_AGGREGATED_VALUES) {
  const allValues = Array.from(values).map(clean).filter(Boolean)
  const visibleValues = allValues.slice(0, limit)
  const suffix = allValues.length > limit ? `; +${allValues.length - limit}` : ""

  return `${visibleValues.join("; ")}${suffix}`
}

function compactLine(
  values: Array<string | undefined>,
  separator = " ",
) {
  return values.map(clean).filter(Boolean).join(separator)
}

function clean(value: string | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ")
}

function sqlitePathFromDatabaseUrl(databaseUrl: string) {
  if (databaseUrl.startsWith("sqlite://")) {
    return databaseUrl.slice("sqlite://".length)
  }

  throw new Error(`DATABASE_URL SQLite non supportée: ${databaseUrl}`)
}

function ensureDoctorsSchema(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS doctors (
      id TEXT PRIMARY KEY,
      national_id TEXT NOT NULL DEFAULT '',
      civility TEXT NOT NULL DEFAULT '',
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      profession_code TEXT NOT NULL DEFAULT '10',
      profession_label TEXT NOT NULL DEFAULT 'Médecin',
      category_code TEXT NOT NULL DEFAULT '',
      category_label TEXT NOT NULL DEFAULT '',
      specialties TEXT NOT NULL DEFAULT '',
      specialty_codes TEXT NOT NULL DEFAULT '',
      specialty_search_text TEXT NOT NULL DEFAULT '',
      practice_modes TEXT NOT NULL DEFAULT '',
      practice_locations TEXT NOT NULL DEFAULT '',
      phone_numbers TEXT NOT NULL DEFAULT '',
      emails TEXT NOT NULL DEFAULT '',
      search_text TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'ANS_RPPS',
      source_updated_at TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_doctors_search_text ON doctors(search_text);
    CREATE INDEX IF NOT EXISTS idx_doctors_specialty_search_text ON doctors(specialty_search_text);
    CREATE INDEX IF NOT EXISTS idx_doctors_last_first_name ON doctors(last_name, first_name);
  `)
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}
