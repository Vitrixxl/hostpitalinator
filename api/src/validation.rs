use crate::error::{ApiError, ApiResult};

pub fn require_non_empty(value: &str, field: &str) -> ApiResult<()> {
    if value.trim().is_empty() {
        return Err(ApiError::bad_request(format!(
            "{} est obligatoire",
            field_label(field)
        )));
    }

    Ok(())
}

pub fn require_one_of(value: &str, field: &str, allowed: &[&str]) -> ApiResult<()> {
    require_non_empty(value, field)?;

    if allowed.contains(&value) {
        return Ok(());
    }

    Err(ApiError::bad_request(format!(
        "{} contient une valeur non prise en charge",
        field_label(field)
    )))
}

pub fn require_positive_f64(value: f64, field: &str) -> ApiResult<()> {
    if value.is_finite() && value > 0.0 {
        return Ok(());
    }

    Err(ApiError::bad_request(format!(
        "{} doit etre positif",
        field_label(field)
    )))
}

pub fn require_positive_i64(value: i64, field: &str) -> ApiResult<()> {
    if value > 0 {
        return Ok(());
    }

    Err(ApiError::bad_request(format!(
        "{} doit etre positif",
        field_label(field)
    )))
}

fn field_label(field: &str) -> &'static str {
    match field {
        "author" => "L'auteur",
        "birthDate" => "La date de naissance",
        "category" => "La categorie",
        "content" => "Le contenu",
        "contentBase64" => "Le contenu du fichier",
        "currentService" => "Le service actuel",
        "diastolicBloodPressure" => "La pression arterielle diastolique",
        "diuresis" => "La diurese",
        "dosage" => "La posologie",
        "email" => "Le courriel",
        "endDate" => "La date de fin",
        "firstName" => "Le prenom",
        "frequency" => "La frequence",
        "heartRate" => "La frequence cardiaque",
        "height" => "La taille",
        "kind" => "Le type",
        "label" => "Le libelle",
        "lastName" => "Le nom",
        "lastStoolDate" => "La date des dernieres selles",
        "markerKey" => "Le marqueur",
        "markerLabel" => "Le libelle du marqueur",
        "medicineId" => "Le medicament",
        "name" => "Le nom",
        "oxygenSaturation" => "La saturation en oxygene",
        "panelType" => "Le type de bilan",
        "password" => "Le mot de passe",
        "prescriber" => "Le prescripteur",
        "recordedAt" => "La date de mesure",
        "referenceInterval" => "L'intervalle de reference",
        "resultStatus" => "Le statut du resultat",
        "role" => "Le role",
        "room" => "La chambre",
        "roomId" => "La chambre",
        "route" => "La voie d'administration",
        "sampledAt" => "La date de prelevement",
        "service" => "Le service",
        "sex" => "Le sexe",
        "sortOrder" => "L'ordre d'affichage",
        "startDate" => "La date de debut",
        "status" => "Le statut",
        "systolicBloodPressure" => "La pression arterielle systolique",
        "temperature" => "La temperature",
        "title" => "Le titre",
        "value" => "La valeur",
        "weight" => "Le poids",
        _ => "Ce champ",
    }
}
