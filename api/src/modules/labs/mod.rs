use std::collections::HashSet;

use axum::{
    extract::{Path, State},
    routing::get,
    Extension, Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    error::{ApiError, ApiJson, ApiResult},
    modules::{
        auth::CurrentAccount,
        patients::{require_patient_read_scope, require_patient_scope},
    },
    realtime::publish_change,
    state::AppState,
    validation::{require_non_empty, require_one_of},
};

const LAB_PANEL_TYPES: &[&str] = &[
    "Hematologie",
    "Ionogramme sanguin",
    "Fonction renale",
    "Bilan hepatique",
    "Bilan inflammatoire",
    "Hemostase",
    "Glycemie",
    "Bilan lipidique",
    "Gaz du sang",
    "Enzymes cardiaques",
    "Endocrinologie",
    "Microbiologie",
    "Serologie",
    "Toxicologie",
    "Urines",
    "Immunologie",
];

const LAB_STATUSES: &[&str] = &["normal", "alerte", "critique", "a verifier"];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LabPanel {
    id: String,
    patient_id: String,
    sampled_at: String,
    panel_type: String,
    status: String,
    created_at: String,
    results: Vec<LabPanelResult>,
}

#[derive(Debug, FromRow)]
struct LabPanelRow {
    id: String,
    patient_id: String,
    sampled_at: String,
    panel_type: String,
    status: String,
    created_at: String,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct LabPanelResult {
    id: String,
    lab_panel_id: String,
    marker_key: String,
    marker_label: String,
    value: String,
    unit: String,
    reference_interval: String,
    status: String,
    sort_order: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddLabPanelRequest {
    sampled_at: String,
    panel_type: String,
    status: Option<String>,
    results: Vec<AddLabPanelResultRequest>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddLabPanelResultRequest {
    marker_key: String,
    marker_label: String,
    value: String,
    unit: String,
    reference_interval: String,
    status: String,
}

pub fn routes() -> Router<AppState> {
    Router::new().route(
        "/patients/{patient_id}/lab-results",
        get(list_lab_results).post(add_lab_result),
    )
}

async fn list_lab_results(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(patient_id): Path<String>,
) -> ApiResult<Json<Vec<LabPanel>>> {
    require_patient_read_scope(&state, &patient_id, &current_account).await?;

    let rows = sqlx::query_as::<_, LabPanelRow>(
        r#"
        SELECT *
        FROM lab_panels
        WHERE patient_id = ?
        ORDER BY sampled_at DESC, created_at DESC
        "#,
    )
    .bind(patient_id)
    .fetch_all(&state.pool)
    .await?;

    let mut panels = Vec::with_capacity(rows.len());

    for row in rows {
        let results = fetch_panel_results(&state, &row.id).await?;
        panels.push(row.into_panel(results));
    }

    Ok(Json(panels))
}

async fn add_lab_result(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(patient_id): Path<String>,
    ApiJson(payload): ApiJson<AddLabPanelRequest>,
) -> ApiResult<Json<LabPanel>> {
    require_patient_scope(&state, &patient_id, &current_account).await?;
    payload.validate()?;

    let panel_id = Uuid::new_v4().to_string();
    let panel_status = payload.panel_status();
    let marker_keys = lab_marker_keys(payload.panel_type.trim());
    let mut transaction = state.pool.begin().await?;

    sqlx::query(
        r#"
        INSERT INTO lab_panels (id, patient_id, sampled_at, panel_type, status)
        VALUES (?, ?, ?, ?, ?)
        "#,
    )
    .bind(&panel_id)
    .bind(&patient_id)
    .bind(payload.sampled_at.trim())
    .bind(payload.panel_type.trim())
    .bind(panel_status)
    .execute(&mut *transaction)
    .await?;

    for (index, result) in payload.results.iter().enumerate() {
        let marker_key = result.marker_key.trim();
        let sort_order = marker_keys
            .iter()
            .position(|candidate| *candidate == marker_key)
            .unwrap_or(index) as i64;

        sqlx::query(
            r#"
            INSERT INTO lab_panel_results (
              id,
              lab_panel_id,
              marker_key,
              marker_label,
              value,
              unit,
              reference_interval,
              status,
              sort_order
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(Uuid::new_v4().to_string())
        .bind(&panel_id)
        .bind(marker_key)
        .bind(result.marker_label.trim())
        .bind(result.value.trim())
        .bind(result.unit.trim())
        .bind(result.reference_interval.trim())
        .bind(result.status.trim())
        .bind(sort_order)
        .execute(&mut *transaction)
        .await?;
    }

    transaction.commit().await?;

    let lab_panel = fetch_lab_panel(&state, &panel_id).await?;

    publish_change(
        &state,
        "labPanel",
        "created",
        lab_panel.id.clone(),
        Some(patient_id),
        ["patient", "labs"],
        &lab_panel,
    );

    Ok(Json(lab_panel))
}

async fn fetch_lab_panel(state: &AppState, panel_id: &str) -> ApiResult<LabPanel> {
    let row = sqlx::query_as::<_, LabPanelRow>(
        r#"
        SELECT *
        FROM lab_panels
        WHERE id = ?
        "#,
    )
    .bind(panel_id)
    .fetch_one(&state.pool)
    .await?;

    let results = fetch_panel_results(state, panel_id).await?;
    Ok(row.into_panel(results))
}

async fn fetch_panel_results(state: &AppState, panel_id: &str) -> ApiResult<Vec<LabPanelResult>> {
    let results = sqlx::query_as::<_, LabPanelResult>(
        r#"
        SELECT *
        FROM lab_panel_results
        WHERE lab_panel_id = ?
        ORDER BY sort_order ASC, marker_label ASC
        "#,
    )
    .bind(panel_id)
    .fetch_all(&state.pool)
    .await?;

    Ok(results)
}

impl LabPanelRow {
    fn into_panel(self, results: Vec<LabPanelResult>) -> LabPanel {
        LabPanel {
            id: self.id,
            patient_id: self.patient_id,
            sampled_at: self.sampled_at,
            panel_type: self.panel_type,
            status: self.status,
            created_at: self.created_at,
            results,
        }
    }
}

impl AddLabPanelRequest {
    fn validate(&self) -> ApiResult<()> {
        require_non_empty(&self.sampled_at, "sampledAt")?;
        require_one_of(self.panel_type.trim(), "panelType", LAB_PANEL_TYPES)?;

        if let Some(status) = &self.status {
            if !status.trim().is_empty() {
                require_one_of(status.trim(), "status", LAB_STATUSES)?;
            }
        }

        if self.results.is_empty() {
            return Err(ApiError::bad_request(
                "Au moins un resultat est obligatoire",
            ));
        }

        let marker_keys = lab_marker_keys(self.panel_type.trim());
        let mut seen_marker_keys = HashSet::new();

        for result in &self.results {
            let marker_key = result.marker_key.trim();

            require_one_of(marker_key, "markerKey", marker_keys)?;

            if !seen_marker_keys.insert(marker_key) {
                return Err(ApiError::bad_request("Le marqueur doit etre unique"));
            }

            require_non_empty(&result.marker_label, "markerLabel")?;
            require_non_empty(&result.value, "value")?;
            require_non_empty(&result.reference_interval, "referenceInterval")?;
            require_one_of(result.status.trim(), "resultStatus", LAB_STATUSES)?;
        }

        Ok(())
    }

    fn panel_status(&self) -> String {
        let explicit_status = self.status.as_deref().map(str::trim).unwrap_or_default();

        if !explicit_status.is_empty() {
            return explicit_status.to_string();
        }

        if self
            .results
            .iter()
            .any(|result| result.status.trim() == "critique")
        {
            return "critique".to_string();
        }

        if self
            .results
            .iter()
            .any(|result| result.status.trim() == "alerte")
        {
            return "alerte".to_string();
        }

        if self
            .results
            .iter()
            .any(|result| result.status.trim() == "a verifier")
        {
            return "a verifier".to_string();
        }

        "normal".to_string()
    }
}

fn lab_marker_keys(panel_type: &str) -> &'static [&'static str] {
    match panel_type {
        "Hematologie" => &[
            "hemoglobine",
            "hematocrite",
            "erythrocytes",
            "vgm",
            "tcmh",
            "ccmh",
            "leucocytes",
            "neutrophiles",
            "lymphocytes",
            "monocytes",
            "eosinophiles",
            "basophiles",
            "plaquettes",
            "reticulocytes",
        ],
        "Ionogramme sanguin" => &[
            "sodium",
            "potassium",
            "chlore",
            "bicarbonates",
            "calcium",
            "calcium_corrige",
            "phosphore",
            "magnesium",
            "protides",
        ],
        "Fonction renale" => &[
            "creatinine",
            "uree",
            "dfg_estime",
            "clairance_creatinine",
            "cystatine_c",
        ],
        "Bilan hepatique" => &[
            "asat",
            "alat",
            "ggt",
            "pal",
            "bilirubine_totale",
            "bilirubine_conjuguee",
            "albumine",
            "proteines_totales",
            "ldh",
        ],
        "Bilan inflammatoire" => &["crp", "pct", "vs_1h", "fibrinogene", "ferritine"],
        "Hemostase" => &["tp", "inr", "tca", "fibrinogene", "d_dimeres", "anti_xa"],
        "Glycemie" => &["glucose", "hba1c", "cetones", "insuline", "peptide_c"],
        "Bilan lipidique" => &[
            "cholesterol_total",
            "hdl",
            "ldl",
            "triglycerides",
            "non_hdl",
        ],
        "Gaz du sang" => &[
            "ph",
            "pao2",
            "paco2",
            "hco3",
            "sao2",
            "lactates",
            "base_excess",
            "fio2",
        ],
        "Enzymes cardiaques" => &[
            "troponine",
            "ck",
            "ck_mb",
            "myoglobine",
            "bnp",
            "nt_pro_bnp",
        ],
        "Endocrinologie" => &[
            "tsh",
            "t4_libre",
            "t3_libre",
            "cortisol",
            "pth",
            "vitamine_d",
            "prolactine",
        ],
        "Microbiologie" => &[
            "prelevement",
            "examen_direct",
            "culture",
            "germe",
            "antibiogramme",
            "hemocultures",
            "pcr",
        ],
        "Serologie" => &[
            "vih",
            "ag_hbs",
            "anti_hbs",
            "anti_hbc",
            "vhc",
            "syphilis",
            "ebv",
            "cmv",
            "toxoplasmose",
        ],
        "Toxicologie" => &[
            "ethanol",
            "paracetamol",
            "salicylates",
            "benzodiazepines",
            "opiaces",
            "cannabis",
            "cocaine",
        ],
        "Urines" => &[
            "ph",
            "densite",
            "proteines",
            "glucose",
            "cetones",
            "nitrites",
            "leucocytes",
            "hematies",
            "albuminurie",
            "creatininurie",
        ],
        "Immunologie" => &[
            "ana",
            "anca",
            "facteur_rhumatoide",
            "anti_ccp",
            "c3",
            "c4",
            "igg",
            "iga",
            "igm",
        ],
        _ => &[],
    }
}
