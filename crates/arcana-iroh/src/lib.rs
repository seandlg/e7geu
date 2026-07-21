use std::{collections::HashMap, sync::{Arc, Mutex}, time::Duration};

use anyhow::{Context, Result};
use iroh::{
    Endpoint, EndpointId,
    endpoint::Connection,
    protocol::{AcceptError, ProtocolHandler, Router},
};
use n0_future::{Stream, StreamExt, boxed::BoxStream, task};
use serde::Serialize;
use tokio::sync::{broadcast, oneshot};
use tokio_stream::wrappers::BroadcastStream;
use wasm_bindgen::{JsError, prelude::wasm_bindgen};
use wasm_streams::{ReadableStream, readable::sys::ReadableStream as JsReadableStream};

const ALPN: &[u8] = b"e7g.eu/arcana/1";
const MAX_MESSAGE_BYTES: usize = 1_048_576;

#[derive(Clone, Debug)]
struct ArcanaProtocol {
    events: broadcast::Sender<IncomingRequest>,
    pending: Arc<Mutex<HashMap<u64, oneshot::Sender<String>>>>,
    next_id: Arc<Mutex<u64>>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct IncomingRequest {
    request_id: u64,
    endpoint_id: String,
    payload: String,
}

impl ArcanaProtocol {
    async fn handle(self, connection: Connection) -> Result<(), AcceptError> {
        let remote = connection.remote_id();
        let (mut send, mut recv) = connection.accept_bi().await?;
        let bytes = recv.read_to_end(MAX_MESSAGE_BYTES).await.map_err(accept_err)?;
        let payload = String::from_utf8(bytes).map_err(accept_err)?;
        let request_id = {
            let mut next = self.next_id.lock().expect("request counter poisoned");
            *next += 1;
            *next
        };
        let (response_tx, response_rx) = oneshot::channel();
        self.pending.lock().expect("pending requests poisoned").insert(request_id, response_tx);
        self.events.send(IncomingRequest {
            request_id,
            endpoint_id: remote.to_string(),
            payload,
        }).ok();
        let response = tokio::time::timeout(Duration::from_secs(30), response_rx)
            .await
            .map_err(accept_err)?
            .map_err(accept_err)?;
        send.write_all(response.as_bytes()).await.map_err(accept_err)?;
        send.finish()?;
        Ok(())
    }
}

impl ProtocolHandler for ArcanaProtocol {
    async fn accept(&self, connection: Connection) -> Result<(), AcceptError> {
        self.clone().handle(connection).await
    }
}

#[wasm_bindgen]
pub struct ArcanaNode {
    router: Router,
    protocol: ArcanaProtocol,
}

#[wasm_bindgen]
impl ArcanaNode {
    pub async fn spawn() -> Result<Self, JsError> {
        console_error_panic_hook::set_once();
        let endpoint = Endpoint::builder(iroh::endpoint::presets::N0)
            .alpns(vec![ALPN.to_vec()])
            .bind()
            .await
            .map_err(to_js_err)?;
        let (events, _) = broadcast::channel(64);
        let protocol = ArcanaProtocol {
            events,
            pending: Arc::new(Mutex::new(HashMap::new())),
            next_id: Arc::new(Mutex::new(0)),
        };
        let router = Router::builder(endpoint).accept(ALPN, protocol.clone()).spawn();
        Ok(Self { router, protocol })
    }

    pub fn endpoint_id(&self) -> String {
        self.router.endpoint().id().to_string()
    }

    pub fn events(&self) -> JsReadableStream {
        let stream: BoxStream<IncomingRequest> = Box::pin(
            BroadcastStream::new(self.protocol.events.subscribe()).filter_map(|event| event.ok()),
        );
        into_js_stream(stream)
    }

    pub fn respond(&self, request_id: u64, response: String) -> Result<(), JsError> {
        let sender = self.protocol.pending.lock().expect("pending requests poisoned")
            .remove(&request_id)
            .context("request is no longer waiting")
            .map_err(to_js_err)?;
        sender.send(response).map_err(|_| JsError::new("request disconnected"))
    }

    pub async fn request(&self, endpoint_id: String, payload: String) -> Result<String, JsError> {
        let endpoint_id: EndpointId = endpoint_id.parse()
            .context("invalid host endpoint ID")
            .map_err(to_js_err)?;
        let endpoint = self.router.endpoint().clone();
        task::spawn(async move {
            let connection = endpoint.connect(endpoint_id, ALPN).await?;
            let (mut send, mut recv) = connection.open_bi().await?;
            send.write_all(payload.as_bytes()).await?;
            send.finish()?;
            let response = recv.read_to_end(MAX_MESSAGE_BYTES).await?;
            Result::<String>::Ok(String::from_utf8(response)?)
        }).await.map_err(to_js_err)?.map_err(to_js_err)
    }
}

fn into_js_stream<T: Serialize>(stream: impl Stream<Item = T> + 'static) -> JsReadableStream {
    ReadableStream::from_stream(
        stream.map(|event| Ok(serde_wasm_bindgen::to_value(&event).expect("serializable event"))),
    ).into_raw()
}

fn to_js_err(error: impl Into<anyhow::Error>) -> JsError {
    JsError::new(&error.into().to_string())
}

fn accept_err(error: impl std::fmt::Display) -> AcceptError {
    n0_error::AnyError::from_display(error).into()
}
