import { existsSync } from "node:fs"
import { Database } from "bun:sqlite"

const SPECIALTIES_URL =
  "https://base-donnees-publique.medicaments.gouv.fr/download/file/CIS_bdpm.txt"
const COMPOSITIONS_URL =
  "https://base-donnees-publique.medicaments.gouv.fr/download/file/CIS_COMPO_bdpm.txt"
const DEFAULT_DATABASE_URL = "sqlite://api/data/hospitalinator.sqlite"
const BDPM_SOURCE = "BDPM"
const STALE_MARKETING_STATUS = "Absent de la dernière importation BDPM"

type CompositionSummary = {
  substances: string[]
  dosages: string[]
}

type SpecialtyRow = {
  id: string
  name: string
  form: string
  administrationRoutes: string
  authorizationStatus: string
  authorizationProcedure: string
  marketingStatus: string
  marketingAuthorizationDate: string | null
  holder: string
  enhancedSurveillance: string
}

const databasePath = sqlitePathFromDatabaseUrl(
  process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL
)

if (!existsSync(databasePath)) {
  throw new Error(
    `Base SQLite introuvable: ${databasePath}. Lance l'API une fois pour appliquer les migrations.`
  )
}

const sourceUpdatedAt = new Date().toISOString().slice(0, 10)
const [specialties, compositions] = await Promise.all([
  fetchTsv(SPECIALTIES_URL),
  fetchTsv(COMPOSITIONS_URL),
])
const compositionSummaries = summarizeCompositions(compositions)
const rows = specialties.map(toSpecialtyRow).filter((row) => row.id && row.name)
const db = new Database(databasePath)

db.exec("PRAGMA foreign_keys = ON")
ensureMedicinesSchema(db)

const markStale = db.prepare(
  `
  UPDATE medicines
  SET marketing_status = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE source = ?
  `
)
const upsertMedicine = db.prepare(
  `
  INSERT INTO medicines (
    id,
    name,
    form,
    administration_routes,
    authorization_status,
    authorization_procedure,
    marketing_status,
    marketing_authorization_date,
    holder,
    enhanced_surveillance,
    active_substances,
    dosage_summary,
    search_text,
    source,
    source_updated_at
  ) VALUES (
    $id,
    $name,
    $form,
    $administrationRoutes,
    $authorizationStatus,
    $authorizationProcedure,
    $marketingStatus,
    $marketingAuthorizationDate,
    $holder,
    $enhancedSurveillance,
    $activeSubstances,
    $dosageSummary,
    $searchText,
    $source,
    $sourceUpdatedAt
  )
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    form = excluded.form,
    administration_routes = excluded.administration_routes,
    authorization_status = excluded.authorization_status,
    authorization_procedure = excluded.authorization_procedure,
    marketing_status = excluded.marketing_status,
    marketing_authorization_date = excluded.marketing_authorization_date,
    holder = excluded.holder,
    enhanced_surveillance = excluded.enhanced_surveillance,
    active_substances = excluded.active_substances,
    dosage_summary = excluded.dosage_summary,
    search_text = excluded.search_text,
    source = excluded.source,
    source_updated_at = excluded.source_updated_at,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  `
)

const importMedicines = db.transaction(() => {
  markStale.run(STALE_MARKETING_STATUS, BDPM_SOURCE)

  for (const row of rows) {
    const composition = compositionSummaries.get(row.id)
    const activeSubstances = compactValues(composition?.substances ?? [])
    const dosageSummary = compactValues(composition?.dosages ?? [])
    const searchText = normalizeSearch(
      [
        row.name,
        row.form,
        row.administrationRoutes,
        row.authorizationStatus,
        row.marketingStatus,
        activeSubstances,
        dosageSummary,
      ].join(" ")
    )

    upsertMedicine.run({
      $id: row.id,
      $name: row.name,
      $form: row.form,
      $administrationRoutes: row.administrationRoutes,
      $authorizationStatus: row.authorizationStatus,
      $authorizationProcedure: row.authorizationProcedure,
      $marketingStatus: row.marketingStatus,
      $marketingAuthorizationDate: row.marketingAuthorizationDate,
      $holder: row.holder,
      $enhancedSurveillance: row.enhancedSurveillance,
      $activeSubstances: activeSubstances,
      $dosageSummary: dosageSummary,
      $searchText: searchText,
      $source: BDPM_SOURCE,
      $sourceUpdatedAt: sourceUpdatedAt,
    })
  }
})

importMedicines()
db.close()

const commercializedCount = rows.filter(
  (row) => row.marketingStatus === "Commercialisée"
).length
console.log(
  `Import BDPM terminé: ${rows.length} spécialités, ${commercializedCount} commercialisées.`
)

async function fetchTsv(url: string) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Téléchargement impossible (${response.status}) pour ${url}`)
  }

  const bytes = await response.arrayBuffer()
  const text = new TextDecoder("iso-8859-1").decode(bytes)

  return text
    .replaceAll("\r", "")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => line.split("\t"))
}

function toSpecialtyRow(fields: string[]): SpecialtyRow {
  return {
    id: clean(fields[0]),
    name: clean(fields[1]),
    form: clean(fields[2]),
    administrationRoutes: clean(fields[3]),
    authorizationStatus: clean(fields[4]),
    authorizationProcedure: clean(fields[5]),
    marketingStatus: clean(fields[6]),
    marketingAuthorizationDate: clean(fields[7]) || null,
    holder: clean(fields[10]),
    enhancedSurveillance: clean(fields[11]),
  }
}

function summarizeCompositions(rows: string[][]) {
  const summaries = new Map<string, CompositionSummary>()

  for (const fields of rows) {
    const id = clean(fields[0])
    const substance = clean(fields[3])
    const dosage = clean(fields[4])
    const nature = clean(fields[6])

    if (!id || nature !== "SA") {
      continue
    }

    const summary = summaries.get(id) ?? { substances: [], dosages: [] }

    if (substance) {
      summary.substances.push(substance)
    }

    if (dosage) {
      summary.dosages.push(substance ? `${substance} ${dosage}` : dosage)
    }

    summaries.set(id, summary)
  }

  return summaries
}

function compactValues(values: string[], limit = 4) {
  const unique = Array.from(new Set(values.map(clean).filter(Boolean)))
  const visibleValues = unique.slice(0, limit)
  const suffix = unique.length > limit ? `; +${unique.length - limit}` : ""

  return `${visibleValues.join("; ")}${suffix}`
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

function ensureMedicinesSchema(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS medicines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      form TEXT NOT NULL DEFAULT '',
      administration_routes TEXT NOT NULL DEFAULT '',
      authorization_status TEXT NOT NULL DEFAULT '',
      authorization_procedure TEXT NOT NULL DEFAULT '',
      marketing_status TEXT NOT NULL DEFAULT '',
      marketing_authorization_date TEXT,
      holder TEXT NOT NULL DEFAULT '',
      enhanced_surveillance TEXT NOT NULL DEFAULT '',
      active_substances TEXT NOT NULL DEFAULT '',
      dosage_summary TEXT NOT NULL DEFAULT '',
      search_text TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'BDPM',
      source_updated_at TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_medicines_search_text ON medicines(search_text);
    CREATE INDEX IF NOT EXISTS idx_medicines_marketing_status ON medicines(marketing_status);
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
