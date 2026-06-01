use axum::{
    extract::{Query, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, QueryBuilder, Sqlite};

use crate::{error::ApiResult, state::AppState};

const DEFAULT_SEARCH_LIMIT: i64 = 20;
const MAX_SEARCH_LIMIT: i64 = 50;
const MIN_SEARCH_LENGTH: usize = 2;
const COMMERCIALIZED_STATUS: &str = "Commercialisée";

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Medicine {
    id: String,
    name: String,
    form: String,
    administration_routes: String,
    authorization_status: String,
    authorization_procedure: String,
    marketing_status: String,
    marketing_authorization_date: Option<String>,
    holder: String,
    enhanced_surveillance: String,
    active_substances: String,
    dosage_summary: String,
    source: String,
    source_updated_at: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SearchMedicinesQuery {
    search: Option<String>,
    limit: Option<i64>,
}

pub fn routes() -> Router<AppState> {
    Router::new().route("/medicines", get(search_medicines))
}

async fn search_medicines(
    State(state): State<AppState>,
    Query(params): Query<SearchMedicinesQuery>,
) -> ApiResult<Json<Vec<Medicine>>> {
    let search = normalize_search(params.search.unwrap_or_default());

    if search.len() < MIN_SEARCH_LENGTH {
        return Ok(Json(Vec::new()));
    }

    let limit = params
        .limit
        .unwrap_or(DEFAULT_SEARCH_LIMIT)
        .clamp(1, MAX_SEARCH_LIMIT);
    let search_terms = search.split_whitespace().collect::<Vec<_>>();
    let phrase_prefix_pattern = format!("{search}%");
    let first_term_prefix_pattern = format!("{}%", search_terms[0]);

    let mut query_builder = QueryBuilder::<Sqlite>::new(
        r#"
        SELECT
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
          source,
          source_updated_at,
          created_at,
          updated_at
        FROM medicines
        WHERE marketing_status =
        "#,
    );

    query_builder.push_bind(COMMERCIALIZED_STATUS);

    for term in search_terms {
        query_builder.push(" AND (search_text LIKE ");
        query_builder.push_bind(format!("{term}%"));
        query_builder.push(" OR search_text LIKE ");
        query_builder.push_bind(format!("% {term}%"));
        query_builder.push(")");
    }

    query_builder.push(
        r#"
        ORDER BY
          CASE
            WHEN search_text LIKE "#,
    );
    query_builder.push_bind(phrase_prefix_pattern);
    query_builder.push(" THEN 0 WHEN search_text LIKE ");
    query_builder.push_bind(first_term_prefix_pattern);
    query_builder.push(
        r#" THEN 1 ELSE 2 END,
          name COLLATE NOCASE
        LIMIT "#,
    );
    query_builder.push_bind(limit);

    let medicines = query_builder
        .build_query_as::<Medicine>()
        .fetch_all(&state.pool)
        .await?;

    Ok(Json(medicines))
}

pub fn normalize_search(value: impl AsRef<str>) -> String {
    let mut normalized = String::new();
    let mut previous_was_space = true;

    for character in value.as_ref().chars().flat_map(char::to_lowercase) {
        let mapped = match character {
            'à' | 'á' | 'â' | 'ã' | 'ä' | 'å' => Some('a'),
            'æ' => {
                push_search_char(&mut normalized, 'a', &mut previous_was_space);
                Some('e')
            }
            'ç' => Some('c'),
            'è' | 'é' | 'ê' | 'ë' => Some('e'),
            'ì' | 'í' | 'î' | 'ï' => Some('i'),
            'ñ' => Some('n'),
            'ò' | 'ó' | 'ô' | 'õ' | 'ö' => Some('o'),
            'œ' => {
                push_search_char(&mut normalized, 'o', &mut previous_was_space);
                Some('e')
            }
            'ù' | 'ú' | 'û' | 'ü' => Some('u'),
            'ý' | 'ÿ' => Some('y'),
            character if character.is_ascii_alphanumeric() => Some(character),
            character if character.is_whitespace() || is_search_separator(character) => Some(' '),
            _ => None,
        };

        if let Some(mapped) = mapped {
            push_search_char(&mut normalized, mapped, &mut previous_was_space);
        }
    }

    normalized.trim().to_string()
}

fn is_search_separator(character: char) -> bool {
    matches!(
        character,
        '-' | '_'
            | ','
            | ';'
            | ':'
            | '.'
            | '/'
            | '\\'
            | '('
            | ')'
            | '['
            | ']'
            | '{'
            | '}'
            | '\''
            | '"'
    )
}

fn push_search_char(output: &mut String, character: char, previous_was_space: &mut bool) {
    if character == ' ' {
        if !*previous_was_space {
            output.push(' ');
            *previous_was_space = true;
        }
        return;
    }

    output.push(character);
    *previous_was_space = false;
}

pub async fn find_commercialized_medicine_name(
    state: &AppState,
    medicine_id: &str,
) -> ApiResult<Option<String>> {
    let name = sqlx::query_scalar::<_, String>(
        r#"
        SELECT name
        FROM medicines
        WHERE id = ?
          AND marketing_status = ?
        "#,
    )
    .bind(medicine_id)
    .bind(COMMERCIALIZED_STATUS)
    .fetch_optional(&state.pool)
    .await?;

    Ok(name)
}
