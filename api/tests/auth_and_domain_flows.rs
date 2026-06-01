use std::fs;

use axum::{
    body::Body,
    http::{header, Method, Request, StatusCode},
    Router,
};
use hospitalinator_api::{build_app, build_app_with_frontend, db, state::AppState};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use tempfile::TempDir;
use tower::ServiceExt;

struct TestContext {
    app: Router,
    admin_token: String,
    _temp_dir: TempDir,
}

fn test_web_origins() -> Vec<String> {
    vec![
        "http://127.0.0.1:5173".to_string(),
        "http://localhost:5173".to_string(),
    ]
}

async fn test_context() -> TestContext {
    let temp_dir = tempfile::tempdir().expect("create temporary api data directory");
    let database_url = format!(
        "sqlite://{}",
        temp_dir.path().join("hospitalinator-test.sqlite").display()
    );
    let pool = db::connect(&database_url)
        .await
        .expect("connect test database");
    let web_origins = test_web_origins();
    let app = build_app(
        AppState::new(pool, temp_dir.path().join("documents")),
        &web_origins,
    );

    let (bootstrap_status, bootstrap) = request_json(
        &app,
        Method::POST,
        "/auth/bootstrap-admin",
        None,
        Some(json!({
            "name": "Admin",
            "email": "admin@example.test",
            "service": "Administration"
        })),
    )
    .await;
    assert_eq!(bootstrap_status, StatusCode::OK, "{bootstrap}");

    let generated_password = bootstrap["generatedPassword"]
        .as_str()
        .expect("generated admin password");
    assert_eq!(generated_password.split('-').count(), 5);

    let (login_status, login) = request_json(
        &app,
        Method::POST,
        "/auth/login",
        None,
        Some(json!({
            "email": "admin@example.test",
            "password": generated_password
        })),
    )
    .await;
    assert_eq!(login_status, StatusCode::OK, "{login}");

    TestContext {
        admin_token: login["token"].as_str().expect("admin token").to_string(),
        app,
        _temp_dir: temp_dir,
    }
}

async fn request_json(
    app: &Router,
    method: Method,
    uri: impl AsRef<str>,
    token: Option<&str>,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let (status, bytes) = request_raw(app, method, uri, token, body).await;
    let value = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&bytes).expect("parse response json")
    };

    (status, value)
}

async fn request_raw(
    app: &Router,
    method: Method,
    uri: impl AsRef<str>,
    token: Option<&str>,
    body: Option<Value>,
) -> (StatusCode, Vec<u8>) {
    let request_body = body.map_or_else(String::new, |value| value.to_string());
    let mut request = Request::builder()
        .method(method)
        .uri(uri.as_ref())
        .header("content-type", "application/json");

    if let Some(token) = token {
        request = request.header("authorization", format!("Bearer {token}"));
    }

    let request = request
        .body(Body::from(request_body))
        .expect("build request");
    let response = app.clone().oneshot(request).await.expect("send request");
    let status = response.status();
    let bytes = response
        .into_body()
        .collect()
        .await
        .expect("read response body")
        .to_bytes()
        .to_vec();

    (status, bytes)
}

async fn create_patient(app: &Router, token: &str) -> Value {
    let (status, patient) = request_json(
        app,
        Method::POST,
        "/patients",
        Some(token),
        Some(json!({
            "firstName": "Ada",
            "lastName": "Lovelace",
            "birthDate": "1815-12-10",
            "sex": "female",
            "address": "12 rue des Algorithmes, Paris",
            "apartmentNumber": "B12",
            "phoneNumber": "01 23 45 67 89",
            "email": "ada.lovelace@example.test",
            "administrativeInfo": "Dossier initial",
            "currentService": "Cardiologie"
        })),
    )
    .await;

    assert_eq!(status, StatusCode::OK, "{patient}");
    patient
}

async fn create_service(app: &Router, token: &str, name: &str) -> Value {
    let (status, service) = request_json(
        app,
        Method::POST,
        "/services",
        Some(token),
        Some(json!({ "name": name })),
    )
    .await;

    assert_eq!(status, StatusCode::OK, "{service}");
    service
}

#[tokio::test]
async fn health_check_returns_ok() {
    let context = test_context().await;

    let (status, body) = request_json(
        &context.app,
        Method::GET,
        "/health",
        Some(&context.admin_token),
        None,
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["status"], "ok");
}

#[tokio::test]
async fn login_preflight_allows_localhost_origin() {
    let context = test_context().await;
    let request = Request::builder()
        .method(Method::OPTIONS)
        .uri("/auth/login")
        .header(header::ORIGIN, "http://localhost:5173")
        .header(header::ACCESS_CONTROL_REQUEST_METHOD, "POST")
        .header(header::ACCESS_CONTROL_REQUEST_HEADERS, "content-type")
        .body(Body::empty())
        .expect("build preflight request");

    let response = context
        .app
        .clone()
        .oneshot(request)
        .await
        .expect("send preflight request");

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response.headers().get(header::ACCESS_CONTROL_ALLOW_ORIGIN),
        Some(&"http://localhost:5173".parse().unwrap())
    );
}

#[tokio::test]
async fn protected_endpoints_require_login() {
    let context = test_context().await;

    let (status, body) = request_json(&context.app, Method::GET, "/patients", None, None).await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["error"]["code"], "unauthorized");

    let (health_status, health_body) =
        request_json(&context.app, Method::GET, "/health", None, None).await;

    assert_eq!(health_status, StatusCode::UNAUTHORIZED);
    assert_eq!(health_body["error"]["code"], "unauthorized");
}

#[tokio::test]
async fn frontend_build_is_served_without_auth() {
    let temp_dir = tempfile::tempdir().expect("create temporary api data directory");
    let web_dist_dir = temp_dir.path().join("dist");
    let assets_dir = web_dist_dir.join("assets");
    fs::create_dir_all(&assets_dir).expect("create frontend assets directory");
    fs::write(
        web_dist_dir.join("index.html"),
        "<main>Hospitalinator</main>",
    )
    .expect("write frontend index");
    fs::write(assets_dir.join("app.js"), "console.log('hospitalinator')")
        .expect("write frontend asset");

    let database_url = format!(
        "sqlite://{}",
        temp_dir.path().join("hospitalinator-test.sqlite").display()
    );
    let pool = db::connect(&database_url)
        .await
        .expect("connect test database");
    let web_origins = test_web_origins();
    let app = build_app_with_frontend(
        AppState::new(pool, temp_dir.path().join("documents")),
        &web_origins,
        &web_dist_dir,
    );

    let (root_status, root_body) = request_raw(&app, Method::GET, "/", None, None).await;
    assert_eq!(root_status, StatusCode::OK);
    assert_eq!(root_body, b"<main>Hospitalinator</main>");

    let (deep_link_status, deep_link_body) =
        request_raw(&app, Method::GET, "/client/deep/link", None, None).await;
    assert_eq!(deep_link_status, StatusCode::OK);
    assert_eq!(deep_link_body, b"<main>Hospitalinator</main>");

    let (asset_status, asset_body) =
        request_raw(&app, Method::GET, "/assets/app.js", None, None).await;
    assert_eq!(asset_status, StatusCode::OK);
    assert_eq!(asset_body, b"console.log('hospitalinator')");
}

#[tokio::test]
async fn services_are_admin_managed_and_required_for_assignments() {
    let context = test_context().await;

    let service = create_service(&context.app, &context.admin_token, "Oncologie").await;
    assert_eq!(service["name"], "Oncologie");

    let (services_status, services) = request_json(
        &context.app,
        Method::GET,
        "/services",
        Some(&context.admin_token),
        None,
    )
    .await;
    assert_eq!(services_status, StatusCode::OK, "{services}");
    assert!(services
        .as_array()
        .expect("services list")
        .iter()
        .any(|service| service["name"] == "Oncologie"));

    let (account_status, account_body) = request_json(
        &context.app,
        Method::POST,
        "/accounts",
        Some(&context.admin_token),
        Some(json!({
            "name": "Libre",
            "email": "libre@example.test",
            "role": "doctor",
            "service": "Service libre"
        })),
    )
    .await;
    assert_eq!(account_status, StatusCode::NOT_FOUND, "{account_body}");

    let (patient_status, patient_body) = request_json(
        &context.app,
        Method::POST,
        "/patients",
        Some(&context.admin_token),
        Some(json!({
            "firstName": "Jean",
            "lastName": "Dupont",
            "birthDate": "1970-01-01",
            "currentService": "Service libre"
        })),
    )
    .await;
    assert_eq!(patient_status, StatusCode::NOT_FOUND, "{patient_body}");

    let (bed_status, bed_body) = request_json(
        &context.app,
        Method::POST,
        "/beds",
        Some(&context.admin_token),
        Some(json!({
            "label": "ONC-Z01",
            "service": "Service libre",
            "sortOrder": 900
        })),
    )
    .await;
    assert_eq!(bed_status, StatusCode::NOT_FOUND, "{bed_body}");
}

#[tokio::test]
async fn non_admin_accounts_are_scoped_to_their_service() {
    let context = test_context().await;

    let (account_status, account) = request_json(
        &context.app,
        Method::POST,
        "/accounts",
        Some(&context.admin_token),
        Some(json!({
            "name": "Cardio Doctor",
            "email": "cardio@example.test",
            "role": "doctor",
            "service": "Cardiologie"
        })),
    )
    .await;
    assert_eq!(account_status, StatusCode::OK, "{account}");

    let password = account["generatedPassword"]
        .as_str()
        .expect("doctor password");
    let (login_status, login) = request_json(
        &context.app,
        Method::POST,
        "/auth/login",
        None,
        Some(json!({
            "email": "cardio@example.test",
            "password": password
        })),
    )
    .await;
    assert_eq!(login_status, StatusCode::OK, "{login}");
    let doctor_token = login["token"].as_str().expect("doctor token");

    let cardio_patient = create_patient(&context.app, &context.admin_token).await;
    let cardio_patient_id = cardio_patient["id"].as_str().expect("patient id");

    let (med_status, med_patient) = request_json(
        &context.app,
        Method::POST,
        "/patients",
        Some(&context.admin_token),
        Some(json!({
            "firstName": "Alan",
            "lastName": "Turing",
            "birthDate": "1912-06-23",
            "currentService": "Medecine"
        })),
    )
    .await;
    assert_eq!(med_status, StatusCode::OK, "{med_patient}");
    let med_patient_id = med_patient["id"].as_str().expect("patient id");

    let (list_status, list) = request_json(
        &context.app,
        Method::GET,
        "/patients",
        Some(doctor_token),
        None,
    )
    .await;
    assert_eq!(list_status, StatusCode::OK, "{list}");
    let list = list.as_array().expect("doctor patient list");
    assert_eq!(list.len(), 1);
    assert_eq!(list[0]["id"], cardio_patient_id);

    let (own_update_status, own_update) = request_json(
        &context.app,
        Method::PUT,
        format!("/patients/{cardio_patient_id}"),
        Some(doctor_token),
        Some(json!({ "administrativeInfo": "Vu par cardio" })),
    )
    .await;
    assert_eq!(own_update_status, StatusCode::OK, "{own_update}");

    let (other_update_status, other_update) = request_json(
        &context.app,
        Method::PUT,
        format!("/patients/{med_patient_id}"),
        Some(doctor_token),
        Some(json!({ "administrativeInfo": "Hors service" })),
    )
    .await;
    assert_eq!(other_update_status, StatusCode::FORBIDDEN, "{other_update}");

    let (wrong_create_status, wrong_create) = request_json(
        &context.app,
        Method::POST,
        "/patients",
        Some(doctor_token),
        Some(json!({
            "firstName": "Grace",
            "lastName": "Hopper",
            "birthDate": "1906-12-09",
            "currentService": "Medecine"
        })),
    )
    .await;
    assert_eq!(wrong_create_status, StatusCode::FORBIDDEN, "{wrong_create}");

    let (default_create_status, default_create) = request_json(
        &context.app,
        Method::POST,
        "/patients",
        Some(doctor_token),
        Some(json!({
            "firstName": "Katherine",
            "lastName": "Johnson",
            "birthDate": "1918-08-26"
        })),
    )
    .await;
    assert_eq!(default_create_status, StatusCode::OK, "{default_create}");
    assert_eq!(default_create["currentService"], "Cardiologie");
}

#[tokio::test]
async fn patients_can_be_created_and_listed() {
    let context = test_context().await;

    let patient = create_patient(&context.app, &context.admin_token).await;
    assert_eq!(patient["firstName"], "Ada");
    assert_eq!(patient["sex"], "female");
    assert_eq!(patient["address"], "12 rue des Algorithmes, Paris");
    assert_eq!(patient["apartmentNumber"], "B12");
    assert_eq!(patient["phoneNumber"], "01 23 45 67 89");
    assert_eq!(patient["email"], "ada.lovelace@example.test");

    let (list_status, list) = request_json(
        &context.app,
        Method::GET,
        "/patients",
        Some(&context.admin_token),
        None,
    )
    .await;
    assert_eq!(list_status, StatusCode::OK);
    assert_eq!(list.as_array().expect("patient list").len(), 1);
}

#[tokio::test]
async fn beds_can_be_listed_assigned_and_released() {
    let context = test_context().await;

    let (beds_status, beds) = request_json(
        &context.app,
        Method::GET,
        "/beds",
        Some(&context.admin_token),
        None,
    )
    .await;
    assert_eq!(beds_status, StatusCode::OK, "{beds}");

    let first_bed = beds[0]["id"].as_str().expect("first bed id");
    let second_bed = beds[1]["id"].as_str().expect("second bed id");

    let (create_status, patient) = request_json(
        &context.app,
        Method::POST,
        "/patients",
        Some(&context.admin_token),
        Some(json!({
            "firstName": "Grace",
            "lastName": "Hopper",
            "birthDate": "1906-12-09",
            "bedId": first_bed
        })),
    )
    .await;
    assert_eq!(create_status, StatusCode::OK, "{patient}");
    assert_eq!(patient["bedId"], first_bed);

    let patient_id = patient["id"].as_str().expect("patient id");

    let (occupied_status, occupied_beds) = request_json(
        &context.app,
        Method::GET,
        "/beds",
        Some(&context.admin_token),
        None,
    )
    .await;
    assert_eq!(occupied_status, StatusCode::OK, "{occupied_beds}");
    assert_eq!(occupied_beds[0]["occupiedPatientId"], patient_id);

    let (conflict_status, conflict_body) = request_json(
        &context.app,
        Method::POST,
        "/patients",
        Some(&context.admin_token),
        Some(json!({
            "firstName": "Alan",
            "lastName": "Turing",
            "birthDate": "1912-06-23",
            "bedId": first_bed
        })),
    )
    .await;
    assert_eq!(conflict_status, StatusCode::CONFLICT);
    assert_eq!(conflict_body["error"]["code"], "conflict");

    let (update_status, updated_patient) = request_json(
        &context.app,
        Method::PUT,
        format!("/patients/{patient_id}"),
        Some(&context.admin_token),
        Some(json!({ "bedId": second_bed })),
    )
    .await;
    assert_eq!(update_status, StatusCode::OK, "{updated_patient}");
    assert_eq!(updated_patient["bedId"], second_bed);

    let (release_status, released_patient) = request_json(
        &context.app,
        Method::PUT,
        format!("/patients/{patient_id}"),
        Some(&context.admin_token),
        Some(json!({ "bedId": null })),
    )
    .await;
    assert_eq!(release_status, StatusCode::OK, "{released_patient}");
    assert!(released_patient["bedId"].is_null());
}

#[tokio::test]
async fn vital_records_can_be_added_listed_and_return_latest() {
    let context = test_context().await;
    let patient = create_patient(&context.app, &context.admin_token).await;
    let patient_id = patient["id"].as_str().expect("patient id");
    let vitals_uri = format!("/patients/{patient_id}/vitals");

    let (create_status, vital) = request_json(
        &context.app,
        Method::POST,
        &vitals_uri,
        Some(&context.admin_token),
        Some(json!({
            "recordedAt": "2026-06-01T08:00:00Z",
            "temperature": 37.2,
            "heartRate": 72,
            "systolicBloodPressure": 122,
            "diastolicBloodPressure": 78,
            "oxygenSaturation": 98.0,
            "weight": 72.4,
            "diuresis": 900.0,
            "lastStoolDate": "2026-05-31"
        })),
    )
    .await;

    assert_eq!(create_status, StatusCode::OK, "{vital}");
    assert_eq!(vital["patientId"], patient_id);

    let vital_id = vital["id"].as_str().expect("vital id");
    let update_uri = format!("/patients/{patient_id}/vitals/{vital_id}");
    let (update_status, updated) = request_json(
        &context.app,
        Method::PUT,
        &update_uri,
        Some(&context.admin_token),
        Some(json!({
            "recordedAt": "2026-06-01T09:00:00Z",
            "temperature": 37.8,
            "heartRate": 80,
            "systolicBloodPressure": 126,
            "diastolicBloodPressure": 81,
            "oxygenSaturation": 97.0,
            "weight": 72.2,
            "diuresis": 850.0,
            "lastStoolDate": "2026-06-01"
        })),
    )
    .await;
    assert_eq!(update_status, StatusCode::OK, "{updated}");
    assert_eq!(updated["id"], vital["id"]);
    assert_eq!(updated["temperature"], json!(37.8));
    assert_eq!(updated["heartRate"], json!(80));

    let (list_status, list) = request_json(
        &context.app,
        Method::GET,
        &vitals_uri,
        Some(&context.admin_token),
        None,
    )
    .await;
    assert_eq!(list_status, StatusCode::OK);
    assert_eq!(list.as_array().expect("vitals list").len(), 1);

    let latest_uri = format!("/patients/{patient_id}/vitals/latest");
    let (latest_status, latest) = request_json(
        &context.app,
        Method::GET,
        &latest_uri,
        Some(&context.admin_token),
        None,
    )
    .await;
    assert_eq!(latest_status, StatusCode::OK);
    assert_eq!(latest["id"], vital["id"]);
    assert_eq!(latest["temperature"], json!(37.8));

    let (delete_status, deleted) = request_json(
        &context.app,
        Method::DELETE,
        &update_uri,
        Some(&context.admin_token),
        None,
    )
    .await;
    assert_eq!(delete_status, StatusCode::OK, "{deleted}");
    assert_eq!(deleted["id"], vital["id"]);

    let (list_after_delete_status, list_after_delete) = request_json(
        &context.app,
        Method::GET,
        &vitals_uri,
        Some(&context.admin_token),
        None,
    )
    .await;
    assert_eq!(list_after_delete_status, StatusCode::OK);
    assert_eq!(
        list_after_delete
            .as_array()
            .expect("vitals after delete")
            .len(),
        0
    );

    let (latest_after_delete_status, latest_after_delete) = request_json(
        &context.app,
        Method::GET,
        &latest_uri,
        Some(&context.admin_token),
        None,
    )
    .await;
    assert_eq!(latest_after_delete_status, StatusCode::OK);
    assert!(latest_after_delete.is_null());
}

#[tokio::test]
async fn all_domain_endpoints_have_working_create_and_list_paths() {
    let context = test_context().await;
    let patient = create_patient(&context.app, &context.admin_token).await;
    let patient_id = patient["id"].as_str().expect("patient id");

    create_service(&context.app, &context.admin_token, "Oncologie").await;

    let (account_status, account) = request_json(
        &context.app,
        Method::POST,
        "/accounts",
        Some(&context.admin_token),
        Some(json!({
            "name": "Marie Curie",
            "email": "marie.curie@example.test",
            "role": "doctor",
            "service": "Oncologie"
        })),
    )
    .await;
    assert_eq!(account_status, StatusCode::OK, "{account}");
    assert_eq!(
        account["generatedPassword"]
            .as_str()
            .expect("generated password")
            .split('-')
            .count(),
        5
    );

    let (accounts_status, accounts) = request_json(
        &context.app,
        Method::GET,
        "/accounts",
        Some(&context.admin_token),
        None,
    )
    .await;
    assert_eq!(accounts_status, StatusCode::OK);
    assert_eq!(accounts.as_array().expect("accounts list").len(), 2);

    let (medicines_status, medicines) = request_json(
        &context.app,
        Method::GET,
        "/medicines?search=doliprane",
        Some(&context.admin_token),
        None,
    )
    .await;
    assert_eq!(medicines_status, StatusCode::OK, "{medicines}");
    assert!(medicines
        .as_array()
        .expect("medicines list")
        .iter()
        .any(|medicine| medicine["id"] == "60234100"));

    let prescriptions_uri = format!("/patients/{patient_id}/prescriptions");
    let (prescription_status, prescription) = request_json(
        &context.app,
        Method::POST,
        &prescriptions_uri,
        Some(&context.admin_token),
        Some(json!({
            "medicineId": "60234100",
            "dosage": "1 g",
            "frequency": "3 fois par jour",
            "route": "PO",
            "startDate": "2026-06-01",
            "endDate": "2026-06-08",
            "prescriber": "Marie Curie",
            "status": "active"
        })),
    )
    .await;
    assert_eq!(prescription_status, StatusCode::OK, "{prescription}");
    assert_eq!(prescription["prescriber"], "Admin");
    assert_eq!(prescription["medicineId"], "60234100");
    assert_eq!(prescription["medication"], "DOLIPRANE 1000 mg, comprimé");

    let prescription_id = prescription["id"].as_str().expect("prescription id");
    let (status_update_status, updated_prescription) = request_json(
        &context.app,
        Method::PATCH,
        format!("/prescriptions/{prescription_id}/status"),
        Some(&context.admin_token),
        Some(json!({ "status": "stopped" })),
    )
    .await;
    assert_eq!(status_update_status, StatusCode::OK);
    assert_eq!(updated_prescription["status"], "stopped");

    let lab_uri = format!("/patients/{patient_id}/lab-results");
    let (lab_status, lab) = request_json(
        &context.app,
        Method::POST,
        &lab_uri,
        Some(&context.admin_token),
        Some(json!({
            "sampledAt": "2026-06-01T07:30:00Z",
            "panelType": "Hematologie",
            "results": [
                {
                    "markerKey": "hemoglobine",
                    "markerLabel": "Hemoglobine",
                    "value": "13.2",
                    "unit": "g/dL",
                    "referenceInterval": "12-16",
                    "status": "normal"
                },
                {
                    "markerKey": "plaquettes",
                    "markerLabel": "Plaquettes",
                    "value": "220",
                    "unit": "G/L",
                    "referenceInterval": "150-400",
                    "status": "normal"
                }
            ]
        })),
    )
    .await;
    assert_eq!(lab_status, StatusCode::OK, "{lab}");
    assert_eq!(lab["results"].as_array().expect("lab results").len(), 2);

    let documents_uri = format!("/patients/{patient_id}/documents");
    let (document_status, document) = request_json(
        &context.app,
        Method::POST,
        &documents_uri,
        Some(&context.admin_token),
        Some(json!({
            "title": "Compte rendu initial",
            "category": "report",
            "originalFileName": "report.txt",
            "contentBase64": "UmFwcG9ydCBjbGluaXF1ZQ==",
            "mimeType": "text/plain"
        })),
    )
    .await;
    assert_eq!(document_status, StatusCode::OK, "{document}");

    let document_id = document["id"].as_str().expect("document id");
    let (open_status, opened_document) = request_json(
        &context.app,
        Method::GET,
        format!("/documents/{document_id}/open"),
        Some(&context.admin_token),
        None,
    )
    .await;
    assert_eq!(open_status, StatusCode::OK);
    assert!(opened_document["storagePath"]
        .as_str()
        .expect("storage path")
        .contains("report.txt"));

    let (download_status, downloaded) = request_raw(
        &context.app,
        Method::GET,
        format!("/documents/{document_id}/download"),
        Some(&context.admin_token),
        None,
    )
    .await;
    assert_eq!(download_status, StatusCode::OK);
    assert_eq!(downloaded, b"Rapport clinique");

    let notes_uri = format!("/patients/{patient_id}/evolution-notes");
    let (note_status, note) = request_json(
        &context.app,
        Method::POST,
        &notes_uri,
        Some(&context.admin_token),
        Some(json!({
            "service": "Cardiologie",
            "visitId": "VIS-001",
            "author": "Marie Curie",
            "recordedAt": "2026-06-01T09:00:00Z",
            "content": "Patient stable."
        })),
    )
    .await;
    assert_eq!(note_status, StatusCode::OK, "{note}");

    for uri in [prescriptions_uri, lab_uri, documents_uri, notes_uri] {
        let (status, list) = request_json(
            &context.app,
            Method::GET,
            uri,
            Some(&context.admin_token),
            None,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(list.as_array().expect("domain list").len(), 1);
    }
}
