use std::{
    collections::{BTreeSet, HashMap},
    sync::{Arc, Mutex},
};

use anyhow::{Context, Result, ensure};
use bytes::Bytes;
use iroh::{
    Endpoint, EndpointId, PublicKey, SecretKey, Signature,
    endpoint::Connection,
    protocol::{AcceptError, ProtocolHandler, Router},
};
use iroh_gossip::{
    api::{Event as GossipEvent, GossipSender},
    net::{GOSSIP_ALPN, Gossip},
    proto::TopicId,
};
use iroh_tickets::Ticket;
use js_sys::Uint8Array;
use n0_future::{
    Stream, StreamExt, stream,
    task::{self, AbortOnDropHandle},
    time::{Duration, SystemTime, timeout},
};
use serde::{Deserialize, Serialize};
use tokio::sync::{Mutex as AsyncMutex, Notify, broadcast, mpsc};
use tokio_stream::wrappers::BroadcastStream;
use wasm_bindgen::{JsCast, JsError, JsValue, prelude::wasm_bindgen};
use wasm_streams::{ReadableStream, readable::sys::ReadableStream as JsReadableStream};

const FILE_ALPN: &[u8] = b"e7g.eu/collaboration/file/1";
const FILE_CHUNK_BYTES: usize = 64 * 1024;
const MAX_FILE_REQUEST_BYTES: usize = 512;
const MAX_REJECTION_BYTES: usize = 512;
const RESPONSE_TIMEOUT: Duration = Duration::from_secs(30);
const WRITE_TIMEOUT: Duration = Duration::from_secs(90);
const PRESENCE_INTERVAL: Duration = Duration::from_secs(5);
const MAX_CHAT_BYTES: usize = 4_000;
const MAX_NAME_BYTES: usize = 80;
const MAX_FILE_ID_BYTES: usize = 80;
const MAX_FILE_NAME_BYTES: usize = 180;
const MAX_MEDIA_TYPE_BYTES: usize = 120;

#[derive(Clone, Debug, Serialize, Deserialize)]
struct RoomTicket {
    topic_id: TopicId,
    bootstrap: BTreeSet<EndpointId>,
}

impl RoomTicket {
    fn random() -> Self {
        Self {
            topic_id: TopicId::from_bytes(rand::random()),
            bootstrap: BTreeSet::new(),
        }
    }

    fn parse(value: &str) -> Result<Self> {
        Self::decode_string(value).map_err(Into::into)
    }

    fn display(&self) -> String {
        self.encode_string()
    }
}

impl Ticket for RoomTicket {
    const KIND: &'static str = "e7g-collab";

    fn encode_bytes(&self) -> Vec<u8> {
        postcard::to_stdvec(self).expect("room tickets are serializable")
    }

    fn decode_bytes(bytes: &[u8]) -> Result<Self, iroh_tickets::ParseError> {
        Ok(postcard::from_bytes(bytes)?)
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FileOffer {
    id: String,
    name: String,
    media_type: String,
    size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
enum Message {
    Presence { nickname: String },
    Chat { nickname: String, text: String },
    FileOffered { nickname: String, offer: FileOffer },
}

#[derive(Debug, Serialize, Deserialize)]
enum WireMessage {
    V1 { timestamp: u64, message: Message },
}

#[derive(Debug, Serialize, Deserialize)]
struct SignedMessage {
    from: PublicKey,
    data: Vec<u8>,
    signature: Signature,
}

impl SignedMessage {
    fn encode(secret_key: &SecretKey, message: Message) -> Result<Vec<u8>> {
        let timestamp = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_micros() as u64;
        let data = postcard::to_stdvec(&WireMessage::V1 { timestamp, message })?;
        let signed = Self {
            from: secret_key.public(),
            signature: secret_key.sign(&data),
            data,
        };
        Ok(postcard::to_stdvec(&signed)?)
    }

    fn decode(bytes: &[u8]) -> Result<(EndpointId, u64, Message)> {
        let signed: Self = postcard::from_bytes(bytes)?;
        signed.from.verify(&signed.data, &signed.signature)?;
        let WireMessage::V1 { timestamp, message } = postcard::from_bytes(&signed.data)?;
        Ok((signed.from, timestamp, message))
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum RoomEvent {
    #[serde(rename_all = "camelCase")]
    Chat {
        from: EndpointId,
        nickname: String,
        text: String,
        sent_timestamp: u64,
    },
    #[serde(rename_all = "camelCase")]
    Presence {
        from: EndpointId,
        nickname: String,
        sent_timestamp: u64,
    },
    #[serde(rename_all = "camelCase")]
    FileOffered {
        from: EndpointId,
        nickname: String,
        offer: FileOffer,
        sent_timestamp: u64,
    },
    #[serde(rename_all = "camelCase")]
    NeighborUp {
        endpoint_id: EndpointId,
    },
    #[serde(rename_all = "camelCase")]
    NeighborDown {
        endpoint_id: EndpointId,
    },
    Lagged,
}

impl TryFrom<GossipEvent> for RoomEvent {
    type Error = anyhow::Error;

    fn try_from(event: GossipEvent) -> Result<Self> {
        Ok(match event {
            GossipEvent::NeighborUp(endpoint_id) => Self::NeighborUp { endpoint_id },
            GossipEvent::NeighborDown(endpoint_id) => Self::NeighborDown { endpoint_id },
            GossipEvent::Lagged => Self::Lagged,
            GossipEvent::Received(received) => {
                let (from, sent_timestamp, message) = SignedMessage::decode(&received.content)
                    .context("invalid signed room message")?;
                match message {
                    Message::Presence { nickname } => Self::Presence {
                        from,
                        nickname: clean_nickname(nickname)?,
                        sent_timestamp,
                    },
                    Message::Chat { nickname, text } => {
                        let text = text.trim().to_owned();
                        ensure!(!text.is_empty(), "empty chat message");
                        ensure!(text.len() <= MAX_CHAT_BYTES, "chat message is too long");
                        Self::Chat {
                            from,
                            nickname: clean_nickname(nickname)?,
                            text,
                            sent_timestamp,
                        }
                    }
                    Message::FileOffered { nickname, offer } => Self::FileOffered {
                        from,
                        nickname: clean_nickname(nickname)?,
                        offer: validate_offer(offer)?,
                        sent_timestamp,
                    },
                }
            }
        })
    }
}

#[derive(Clone, Debug)]
struct RoomSender {
    secret_key: SecretKey,
    nickname: Arc<Mutex<String>>,
    sender: Arc<AsyncMutex<GossipSender>>,
    trigger_presence: Arc<Notify>,
    _presence_task: Arc<AbortOnDropHandle<()>>,
}

impl RoomSender {
    async fn broadcast(&self, message: Message) -> Result<()> {
        let bytes = SignedMessage::encode(&self.secret_key, message)?;
        self.sender.lock().await.broadcast(bytes.into()).await?;
        Ok(())
    }

    async fn send_chat(&self, text: String) -> Result<()> {
        let text = text.trim().to_owned();
        ensure!(!text.is_empty(), "Write a message first");
        ensure!(text.len() <= MAX_CHAT_BYTES, "Message is too long");
        let nickname = self.nickname.lock().expect("nickname poisoned").clone();
        self.broadcast(Message::Chat { nickname, text }).await
    }

    async fn offer_file(&self, offer: FileOffer) -> Result<()> {
        let nickname = self.nickname.lock().expect("nickname poisoned").clone();
        self.broadcast(Message::FileOffered { nickname, offer })
            .await
    }
}

#[derive(Debug, Deserialize, Serialize)]
struct TransferRequest {
    room_id: TopicId,
    file_id: String,
    expected_size: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct IncomingFileRequest {
    request_id: u64,
    room_id: String,
    file_id: String,
    requester: String,
}

#[derive(Debug)]
enum ResponsePart {
    Chunk(Bytes),
    End,
    Failed(String),
}

#[derive(Debug)]
struct PendingResponse {
    expected_size: u64,
    sender: mpsc::Sender<ResponsePart>,
}

#[derive(Clone, Debug)]
struct FileProtocol {
    events: broadcast::Sender<IncomingFileRequest>,
    pending: Arc<Mutex<HashMap<u64, PendingResponse>>>,
    next_id: Arc<Mutex<u64>>,
}

impl FileProtocol {
    fn new() -> Self {
        let (events, _) = broadcast::channel(32);
        Self {
            events,
            pending: Arc::new(Mutex::new(HashMap::new())),
            next_id: Arc::new(Mutex::new(0)),
        }
    }

    async fn handle(self, connection: Connection) -> Result<(), AcceptError> {
        let requester = connection.remote_id();
        let (mut send, mut recv) = connection.accept_bi().await?;
        let bytes = recv
            .read_to_end(MAX_FILE_REQUEST_BYTES)
            .await
            .map_err(accept_err)?;
        let request: TransferRequest = postcard::from_bytes(&bytes).map_err(accept_err)?;
        validate_file_id(&request.file_id).map_err(accept_err)?;
        if request.expected_size == 0 {
            return Err(accept_err("empty files are not transferable"));
        }

        let request_id = {
            let mut next = self.next_id.lock().expect("request counter poisoned");
            *next = next.wrapping_add(1);
            *next
        };
        let (response_tx, mut response_rx) = mpsc::channel(2);
        self.pending
            .lock()
            .expect("pending file responses poisoned")
            .insert(
                request_id,
                PendingResponse {
                    expected_size: request.expected_size,
                    sender: response_tx,
                },
            );
        self.events
            .send(IncomingFileRequest {
                request_id,
                room_id: request.room_id.to_string(),
                file_id: request.file_id,
                requester: requester.to_string(),
            })
            .ok();

        let first = timeout(RESPONSE_TIMEOUT, response_rx.recv()).await;
        self.pending
            .lock()
            .expect("pending file responses poisoned")
            .remove(&request_id);
        let first = first.map_err(accept_err)?;
        let result = match first {
            Some(ResponsePart::Chunk(bytes)) => {
                send.write_all(&[0]).await.map_err(accept_err)?;
                transfer_chunks(&mut send, &mut response_rx, bytes, request.expected_size).await
            }
            Some(ResponsePart::Failed(message)) => reject_transfer(&mut send, &message).await,
            Some(ResponsePart::End) | None => {
                reject_transfer(&mut send, "The file is no longer available").await
            }
        };
        result.map_err(accept_err)
    }

    fn take_pending(&self, request_id: u64) -> Result<PendingResponse> {
        self.pending
            .lock()
            .expect("pending file responses poisoned")
            .remove(&request_id)
            .context("file request is no longer waiting")
    }
}

impl ProtocolHandler for FileProtocol {
    async fn accept(&self, connection: Connection) -> Result<(), AcceptError> {
        self.clone().handle(connection).await
    }
}

async fn transfer_chunks(
    send: &mut iroh::endpoint::SendStream,
    response_rx: &mut mpsc::Receiver<ResponsePart>,
    first: Bytes,
    expected_size: u64,
) -> Result<()> {
    let mut transferred = 0u64;
    let mut next = Some(ResponsePart::Chunk(first));
    loop {
        let part = match next.take() {
            Some(part) => part,
            None => response_rx
                .recv()
                .await
                .context("sender stopped providing the file")?,
        };
        match part {
            ResponsePart::Chunk(bytes) => {
                transferred = transferred
                    .checked_add(bytes.len() as u64)
                    .context("file size overflow")?;
                ensure!(
                    transferred <= expected_size,
                    "sender exceeded the advertised size"
                );
                timeout(WRITE_TIMEOUT, send.write_all(&bytes)).await??;
            }
            ResponsePart::End => {
                ensure!(
                    transferred == expected_size,
                    "sender stopped before the advertised size"
                );
                send.finish()?;
                send.stopped().await?;
                return Ok(());
            }
            ResponsePart::Failed(message) => return Err(anyhow::anyhow!(message)),
        }
    }
}

async fn reject_transfer(send: &mut iroh::endpoint::SendStream, message: &str) -> Result<()> {
    let message = truncate_utf8(message, MAX_REJECTION_BYTES);
    send.write_all(&[1]).await?;
    send.write_all(message.as_bytes()).await?;
    send.finish()?;
    Ok(())
}

#[wasm_bindgen]
pub struct CollaborationNode {
    router: Router,
    gossip: Gossip,
    file_protocol: FileProtocol,
    secret_key: SecretKey,
}

#[wasm_bindgen]
impl CollaborationNode {
    pub async fn spawn() -> Result<Self, JsError> {
        console_error_panic_hook::set_once();
        let secret_key = SecretKey::generate();
        let endpoint = Endpoint::builder(iroh::endpoint::presets::N0)
            .secret_key(secret_key.clone())
            .alpns(vec![GOSSIP_ALPN.to_vec(), FILE_ALPN.to_vec()])
            .bind()
            .await
            .map_err(to_js_err)?;
        let gossip = Gossip::builder().spawn(endpoint.clone());
        let file_protocol = FileProtocol::new();
        let router = Router::builder(endpoint)
            .accept(GOSSIP_ALPN, gossip.clone())
            .accept(FILE_ALPN, file_protocol.clone())
            .spawn();
        Ok(Self {
            router,
            gossip,
            file_protocol,
            secret_key,
        })
    }

    pub fn endpoint_id(&self) -> String {
        self.router.endpoint().id().to_string()
    }

    pub async fn create(&self, nickname: String) -> Result<CollaborationRoom, JsError> {
        self.join_inner(RoomTicket::random(), nickname).await
    }

    pub async fn join(
        &self,
        ticket: String,
        nickname: String,
    ) -> Result<CollaborationRoom, JsError> {
        let ticket = RoomTicket::parse(&ticket).map_err(to_js_err)?;
        self.join_inner(ticket, nickname).await
    }

    pub async fn shutdown(&self) {
        self.router.shutdown().await.ok();
        self.router.endpoint().close().await;
    }
}

impl CollaborationNode {
    async fn join_inner(
        &self,
        mut ticket: RoomTicket,
        nickname: String,
    ) -> Result<CollaborationRoom, JsError> {
        let nickname = clean_nickname(nickname).map_err(to_js_err)?;
        self.router.endpoint().online().await;
        let topic = self
            .gossip
            .subscribe(ticket.topic_id, ticket.bootstrap.iter().copied().collect())
            .await
            .map_err(to_js_err)?;
        let (sender, receiver) = topic.split();
        let sender = Arc::new(AsyncMutex::new(sender));
        let nickname = Arc::new(Mutex::new(nickname));
        let trigger_presence = Arc::new(Notify::new());
        let presence_task = AbortOnDropHandle::new(task::spawn({
            let secret_key = self.secret_key.clone();
            let sender = sender.clone();
            let nickname = nickname.clone();
            let trigger_presence = trigger_presence.clone();
            async move {
                loop {
                    let nickname = nickname.lock().expect("nickname poisoned").clone();
                    let bytes =
                        match SignedMessage::encode(&secret_key, Message::Presence { nickname }) {
                            Ok(bytes) => bytes,
                            Err(_) => break,
                        };
                    if sender.lock().await.broadcast(bytes.into()).await.is_err() {
                        break;
                    }
                    n0_future::future::race(
                        n0_future::time::sleep(PRESENCE_INTERVAL),
                        trigger_presence.notified(),
                    )
                    .await;
                }
            }
        }));
        let room_sender = RoomSender {
            secret_key: self.secret_key.clone(),
            nickname,
            sender,
            trigger_presence,
            _presence_task: Arc::new(presence_task),
        };
        room_sender.trigger_presence.notify_waiters();

        let neighbors = Arc::new(Mutex::new(BTreeSet::new()));
        let tracked_neighbors = neighbors.clone();
        let stream = receiver.filter_map(move |event| {
            let event = match event {
                Ok(event) => RoomEvent::try_from(event).ok(),
                Err(_) => None,
            };
            if let Some(event) = &event {
                match event {
                    RoomEvent::NeighborUp { endpoint_id } => {
                        tracked_neighbors
                            .lock()
                            .expect("neighbors poisoned")
                            .insert(*endpoint_id);
                    }
                    RoomEvent::NeighborDown { endpoint_id } => {
                        tracked_neighbors
                            .lock()
                            .expect("neighbors poisoned")
                            .remove(endpoint_id);
                    }
                    _ => {}
                }
            }
            event
        });
        let receiver = into_js_stream(stream);

        let me = self.router.endpoint().id();
        ticket.bootstrap.insert(me);
        Ok(CollaborationRoom {
            topic_id: ticket.topic_id,
            bootstrap: ticket.bootstrap,
            me,
            neighbors,
            receiver,
            sender: room_sender,
            endpoint: self.router.endpoint().clone(),
            file_protocol: self.file_protocol.clone(),
        })
    }
}

#[wasm_bindgen]
pub struct CollaborationRoom {
    topic_id: TopicId,
    bootstrap: BTreeSet<EndpointId>,
    me: EndpointId,
    neighbors: Arc<Mutex<BTreeSet<EndpointId>>>,
    receiver: JsReadableStream,
    sender: RoomSender,
    endpoint: Endpoint,
    file_protocol: FileProtocol,
}

#[wasm_bindgen]
impl CollaborationRoom {
    pub fn id(&self) -> String {
        self.topic_id.to_string()
    }

    pub fn receiver(&self) -> JsReadableStream {
        self.receiver.clone()
    }

    pub fn file_requests(&self) -> JsReadableStream {
        let room_id = self.topic_id.to_string();
        let stream =
            BroadcastStream::new(self.file_protocol.events.subscribe()).filter_map(move |event| {
                match event {
                    Ok(event) if event.room_id == room_id => Some(event),
                    _ => None,
                }
            });
        into_js_stream(stream)
    }

    pub fn ticket(&self) -> String {
        let mut bootstrap = self.bootstrap.clone();
        bootstrap.insert(self.me);
        bootstrap.extend(
            self.neighbors
                .lock()
                .expect("neighbors poisoned")
                .iter()
                .copied(),
        );
        RoomTicket {
            topic_id: self.topic_id,
            bootstrap,
        }
        .display()
    }

    pub async fn send_chat(&self, text: String) -> Result<(), JsError> {
        self.sender.send_chat(text).await.map_err(to_js_err)
    }

    pub async fn offer_file(
        &self,
        id: String,
        name: String,
        media_type: String,
        size: u64,
    ) -> Result<JsValue, JsError> {
        let id = validate_file_id(&id).map_err(to_js_err)?.to_owned();
        let name = clean_field(name, MAX_FILE_NAME_BYTES, "File name").map_err(to_js_err)?;
        let media_type = clean_media_type(media_type).map_err(to_js_err)?;
        if size == 0 {
            return Err(JsError::new("The selected file is empty"));
        }
        let offer = FileOffer {
            id,
            name,
            media_type,
            size,
        };
        self.sender
            .offer_file(offer.clone())
            .await
            .map_err(to_js_err)?;
        serde_wasm_bindgen::to_value(&offer).map_err(to_js_err)
    }

    pub async fn request_file(
        &self,
        provider: String,
        file_id: String,
        expected_size: u64,
    ) -> Result<JsReadableStream, JsError> {
        let provider: EndpointId = provider
            .parse()
            .context("invalid file provider")
            .map_err(to_js_err)?;
        if provider == self.me {
            return Err(JsError::new("cannot request your own file"));
        }
        validate_file_id(&file_id).map_err(to_js_err)?;
        if expected_size == 0 {
            return Err(JsError::new("file is empty"));
        }
        let request = postcard::to_stdvec(&TransferRequest {
            room_id: self.topic_id,
            file_id,
            expected_size,
        })
        .map_err(to_js_err)?;
        let connection = self
            .endpoint
            .connect(provider, FILE_ALPN)
            .await
            .map_err(to_js_err)?;
        let (mut send, mut recv) = connection.open_bi().await.map_err(to_js_err)?;
        send.write_all(&request).await.map_err(to_js_err)?;
        send.finish().map_err(to_js_err)?;
        let mut status = [0u8; 1];
        timeout(RESPONSE_TIMEOUT, recv.read_exact(&mut status))
            .await
            .map_err(to_js_err)?
            .map_err(to_js_err)?;
        if status[0] != 0 {
            let message = recv
                .read_to_end(MAX_REJECTION_BYTES)
                .await
                .map_err(to_js_err)?;
            let message = String::from_utf8_lossy(&message);
            return Err(JsError::new(if message.is_empty() {
                "The file is no longer available"
            } else {
                &message
            }));
        }

        let stream = stream::unfold(Some((recv, 0u64)), move |state| async move {
            let Some((mut recv, received)) = state else {
                return None;
            };
            match recv.read_chunk(FILE_CHUNK_BYTES).await {
                Ok(Some(bytes)) => {
                    let next_received = match received.checked_add(bytes.len() as u64) {
                        Some(value) if value <= expected_size => value,
                        _ => {
                            return Some((
                                Err(JsValue::from_str("The sender exceeded the advertised size")),
                                None,
                            ));
                        }
                    };
                    let chunk = bytes_to_uint8array(&bytes);
                    Some((Ok(JsValue::from(chunk)), Some((recv, next_received))))
                }
                Ok(None) if received == expected_size => None,
                Ok(None) => Some((
                    Err(JsValue::from_str(
                        "The sender disconnected before the file was complete",
                    )),
                    None,
                )),
                Err(error) => Some((
                    Err(JsValue::from_str(&format!("File transfer failed: {error}"))),
                    None,
                )),
            }
        });
        Ok(ReadableStream::from_stream(stream).into_raw())
    }

    pub async fn respond_file(
        &self,
        request_id: u64,
        source: JsReadableStream,
        size: u64,
    ) -> Result<(), JsError> {
        let pending = self
            .file_protocol
            .take_pending(request_id)
            .map_err(to_js_err)?;
        if size != pending.expected_size {
            pending
                .sender
                .send(ResponsePart::Failed(
                    "The local file no longer matches the offer".to_owned(),
                ))
                .await
                .ok();
            return Err(JsError::new("The local file no longer matches the offer"));
        }
        let sender = pending.sender;
        let result = stream_browser_file(source, size, sender.clone()).await;
        if let Err(error) = &result {
            sender
                .send(ResponsePart::Failed(error.to_string()))
                .await
                .ok();
        }
        result.map_err(to_js_err)
    }

    pub async fn reject_file(&self, request_id: u64, message: String) -> Result<(), JsError> {
        let pending = self
            .file_protocol
            .take_pending(request_id)
            .map_err(to_js_err)?;
        pending
            .sender
            .send(ResponsePart::Failed(message))
            .await
            .map_err(|_| JsError::new("file requester disconnected"))
    }
}

async fn stream_browser_file(
    source: JsReadableStream,
    expected_size: u64,
    sender: mpsc::Sender<ResponsePart>,
) -> Result<()> {
    let mut source = ReadableStream::from_raw(source).into_stream();
    let mut transferred = 0u64;
    while let Some(chunk) = source.next().await {
        let value = chunk.map_err(js_value_error)?;
        let array = value
            .dyn_into::<Uint8Array>()
            .map_err(|_| anyhow::anyhow!("browser file stream returned a non-byte chunk"))?;
        if array.length() == 0 {
            continue;
        }
        let bytes = uint8array_to_bytes(&array);
        transferred = transferred
            .checked_add(bytes.len() as u64)
            .context("file size overflow")?;
        ensure!(
            transferred <= expected_size,
            "browser file exceeded the advertised size"
        );
        sender
            .send(ResponsePart::Chunk(bytes))
            .await
            .context("file requester disconnected")?;
    }
    ensure!(
        transferred == expected_size,
        "browser file ended before the advertised size"
    );
    sender
        .send(ResponsePart::End)
        .await
        .context("file requester disconnected")?;
    Ok(())
}

fn clean_nickname(value: String) -> Result<String> {
    clean_field(value, MAX_NAME_BYTES, "Name")
}

fn validate_offer(mut offer: FileOffer) -> Result<FileOffer> {
    offer.id = validate_file_id(&offer.id)?.to_owned();
    offer.name = clean_field(offer.name, MAX_FILE_NAME_BYTES, "File name")?;
    offer.media_type = clean_media_type(offer.media_type)?;
    ensure!(offer.size > 0, "file is empty");
    Ok(offer)
}

fn validate_file_id(value: &str) -> Result<&str> {
    let value = value.trim();
    ensure!(!value.is_empty(), "file ID is required");
    ensure!(value.len() <= MAX_FILE_ID_BYTES, "file ID is too long");
    Ok(value)
}

fn clean_media_type(value: String) -> Result<String> {
    let value = value.trim();
    if value.is_empty() {
        return Ok("application/octet-stream".to_owned());
    }
    clean_field(value.to_owned(), MAX_MEDIA_TYPE_BYTES, "Media type")
}

fn clean_field(value: String, max_bytes: usize, label: &str) -> Result<String> {
    let value = value.trim().to_owned();
    if value.is_empty() {
        return Err(anyhow::anyhow!("{label} is required"));
    }
    if value.len() > max_bytes {
        return Err(anyhow::anyhow!("{label} is too long"));
    }
    Ok(value)
}

fn uint8array_to_bytes(data: &Uint8Array) -> Bytes {
    let mut bytes = vec![0; data.length() as usize];
    data.copy_to(&mut bytes);
    Bytes::from(bytes)
}

fn bytes_to_uint8array(bytes: &[u8]) -> Uint8Array {
    let array = Uint8Array::new_with_length(bytes.len() as u32);
    array.copy_from(bytes);
    array
}

fn truncate_utf8(value: &str, max_bytes: usize) -> &str {
    if value.len() <= max_bytes {
        return value;
    }
    let mut end = max_bytes;
    while !value.is_char_boundary(end) {
        end -= 1;
    }
    &value[..end]
}

fn into_js_stream<T: Serialize>(stream: impl Stream<Item = T> + 'static) -> JsReadableStream {
    ReadableStream::from_stream(stream.map(|event| {
        Ok(serde_wasm_bindgen::to_value(&event).expect("stream event is serializable"))
    }))
    .into_raw()
}

fn js_value_error(value: JsValue) -> anyhow::Error {
    anyhow::anyhow!(
        value
            .as_string()
            .unwrap_or_else(|| "browser stream failed".to_owned())
    )
}

fn to_js_err(error: impl Into<anyhow::Error>) -> JsError {
    JsError::new(&error.into().to_string())
}

fn accept_err(error: impl std::fmt::Display) -> AcceptError {
    n0_error::AnyError::from_display(error).into()
}
