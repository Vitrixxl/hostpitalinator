use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::sync::broadcast;
use uuid::Uuid;

use crate::{
    error::{ApiError, ApiResult},
    modules::auth,
    state::AppState,
};

const REALTIME_CHANNEL_CAPACITY: usize = 512;

#[derive(Clone)]
pub struct RealtimeHub {
    sender: broadcast::Sender<RealtimeEvent>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RealtimeEvent {
    pub id: String,
    pub entity: String,
    pub action: String,
    pub resource_id: String,
    pub patient_id: Option<String>,
    pub pages: Vec<String>,
    pub payload: Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RealtimeConnectQuery {
    token: String,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RealtimeClientContext {
    pub patient_id: Option<String>,
    pub page: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum RealtimeClientMessage {
    SetContext {
        patient_id: Option<String>,
        page: Option<String>,
    },
    Ping,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum RealtimeServerMessage {
    Connected { account_id: i64 },
    ContextUpdated { context: RealtimeClientContext },
    Event { event: RealtimeEvent },
    Pong,
}

impl RealtimeHub {
    pub fn new() -> Self {
        let (sender, _) = broadcast::channel(REALTIME_CHANNEL_CAPACITY);
        Self { sender }
    }

    pub fn publish(&self, event: RealtimeEvent) {
        let _ = self.sender.send(event);
    }

    pub fn subscribe(&self) -> broadcast::Receiver<RealtimeEvent> {
        self.sender.subscribe()
    }
}

impl RealtimeEvent {
    pub fn new(
        entity: impl Into<String>,
        action: impl Into<String>,
        resource_id: impl Into<String>,
        patient_id: Option<String>,
        pages: impl IntoIterator<Item = impl Into<String>>,
        payload: impl Serialize,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            entity: entity.into(),
            action: action.into(),
            resource_id: resource_id.into(),
            patient_id,
            pages: pages.into_iter().map(Into::into).collect(),
            payload: serde_json::to_value(payload).unwrap_or(Value::Null),
        }
    }
}

pub fn routes() -> Router<AppState> {
    Router::new().route("/realtime/ws", get(connect_realtime))
}

async fn connect_realtime(
    State(state): State<AppState>,
    Query(query): Query<RealtimeConnectQuery>,
    websocket: WebSocketUpgrade,
) -> ApiResult<Response> {
    let (account, _) = auth::authenticate_token(&state, &query.token).await?;

    Ok(websocket
        .on_upgrade(move |socket| handle_socket(state, account.id, socket))
        .into_response())
}

async fn handle_socket(state: AppState, account_id: i64, mut socket: WebSocket) {
    let mut receiver = state.realtime.subscribe();
    let mut context = RealtimeClientContext::default();

    if send_message(&mut socket, RealtimeServerMessage::Connected { account_id })
        .await
        .is_err()
    {
        return;
    }

    loop {
        tokio::select! {
            message = socket.recv() => {
                match message {
                    Some(Ok(Message::Text(text))) => {
                        match serde_json::from_str::<RealtimeClientMessage>(&text) {
                            Ok(RealtimeClientMessage::SetContext { patient_id, page }) => {
                                context = RealtimeClientContext { patient_id, page };
                                if send_message(&mut socket, RealtimeServerMessage::ContextUpdated { context: context.clone() }).await.is_err() {
                                    break;
                                }
                            }
                            Ok(RealtimeClientMessage::Ping) => {
                                if send_message(&mut socket, RealtimeServerMessage::Pong).await.is_err() {
                                    break;
                                }
                            }
                            Err(error) => {
                                tracing::warn!(%error, "invalid realtime client message");
                            }
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(_)) => {}
                    Some(Err(error)) => {
                        tracing::warn!(%error, "realtime websocket error");
                        break;
                    }
                }
            }
            event = receiver.recv() => {
                match event {
                    Ok(event) => {
                        if should_notify(&context, &event)
                            && send_message(&mut socket, RealtimeServerMessage::Event { event }).await.is_err()
                        {
                            break;
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(skipped)) => {
                        tracing::warn!(skipped, "realtime websocket receiver lagged");
                    }
                    Err(broadcast::error::RecvError::Closed) => break,
                }
            }
        }
    }
}

fn should_notify(context: &RealtimeClientContext, event: &RealtimeEvent) -> bool {
    let page_matches = context
        .page
        .as_ref()
        .is_some_and(|page| event.pages.iter().any(|event_page| event_page == page));
    let patient_matches = match (&context.patient_id, &event.patient_id) {
        (Some(current_patient), Some(event_patient)) => current_patient == event_patient,
        (Some(_), None) => false,
        (None, Some(_)) => false,
        (None, None) => true,
    };

    if context.patient_id.is_some() {
        return patient_matches
            && (event.pages.is_empty()
                || context.page.is_none()
                || page_matches
                || context.page.as_deref() == Some("patient"));
    }

    page_matches || patient_matches
}

async fn send_message(socket: &mut WebSocket, message: RealtimeServerMessage) -> ApiResult<()> {
    let json =
        serde_json::to_string(&message).map_err(|error| ApiError::internal(error.to_string()))?;
    socket
        .send(Message::Text(json.into()))
        .await
        .map_err(|error| ApiError::internal(error.to_string()))
}

pub fn publish_change(
    state: &AppState,
    entity: impl Into<String>,
    action: impl Into<String>,
    resource_id: impl Into<String>,
    patient_id: Option<String>,
    pages: impl IntoIterator<Item = impl Into<String>>,
    payload: impl Serialize,
) {
    state.realtime.publish(RealtimeEvent::new(
        entity,
        action,
        resource_id,
        patient_id,
        pages,
        payload,
    ));
}

#[cfg(test)]
mod tests {
    use super::{should_notify, RealtimeClientContext, RealtimeEvent};

    #[test]
    fn patient_page_receives_patient_scoped_events() {
        let context = RealtimeClientContext {
            patient_id: Some("patient-1".to_string()),
            page: Some("patient".to_string()),
        };
        let event = RealtimeEvent::new(
            "vitalRecord",
            "created",
            "vital-1",
            Some("patient-1".to_string()),
            ["patient", "vitals"],
            serde_json::json!({ "id": "vital-1" }),
        );

        assert!(should_notify(&context, &event));
    }

    #[test]
    fn unrelated_patient_context_does_not_receive_events() {
        let context = RealtimeClientContext {
            patient_id: Some("patient-2".to_string()),
            page: Some("vitals".to_string()),
        };
        let event = RealtimeEvent::new(
            "vitalRecord",
            "created",
            "vital-1",
            Some("patient-1".to_string()),
            ["patient", "vitals"],
            serde_json::json!({ "id": "vital-1" }),
        );

        assert!(!should_notify(&context, &event));
    }

    #[test]
    fn list_page_receives_page_scoped_events_without_patient_context() {
        let context = RealtimeClientContext {
            patient_id: None,
            page: Some("patients".to_string()),
        };
        let event = RealtimeEvent::new(
            "patient",
            "created",
            "patient-1",
            Some("patient-1".to_string()),
            ["patients", "patient"],
            serde_json::json!({ "id": "patient-1" }),
        );

        assert!(should_notify(&context, &event));
    }

    #[test]
    fn page_specific_patient_context_ignores_other_patient_pages() {
        let context = RealtimeClientContext {
            patient_id: Some("patient-1".to_string()),
            page: Some("labs".to_string()),
        };
        let event = RealtimeEvent::new(
            "vitalRecord",
            "created",
            "vital-1",
            Some("patient-1".to_string()),
            ["patient", "vitals"],
            serde_json::json!({ "id": "vital-1" }),
        );

        assert!(!should_notify(&context, &event));
    }
}
