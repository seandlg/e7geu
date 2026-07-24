use std::{
    collections::BTreeSet,
    sync::{Arc, Mutex},
};

use anyhow::{Context, Result, ensure};
use bytes::Bytes;
use iroh::{
    Endpoint, EndpointId, PublicKey, SecretKey, Signature, address_lookup::MemoryLookup,
    protocol::Router,
};
use iroh_blobs::{
    BlobsProtocol,
    api::{Store, downloader::Downloader},
    ticket::BlobTicket,
};
use iroh_gossip::{
    api::{Event as GossipEvent, GossipSender},
    net::{GOSSIP_ALPN, Gossip},
    proto::TopicId,
};
use iroh_tickets::Ticket;
use js_sys::Uint8Array;
use n0_future::{
    StreamExt,
    task::{self, AbortOnDropHandle},
    time::{Duration, SystemTime},
};
use serde::{Deserialize, Serialize};
use tokio::sync::{Mutex as AsyncMutex, Notify};
use wasm_bindgen::{JsError, JsValue, prelude::wasm_bindgen};
use wasm_streams::{ReadableStream, readable::sys::ReadableStream as JsReadableStream};

const PRESENCE_INTERVAL: Duration = Duration::from_secs(5);
const MAX_CHAT_BYTES: usize = 4_000;
const MAX_FILE_BYTES: usize = 25 * 1024 * 1024;
const MAX_NAME_BYTES: usize = 80;
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
    ticket: String,
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

#[derive(Clone, Debug)]
struct RoomFiles {
    address_lookup: MemoryLookup,
    endpoint: Endpoint,
    blobs: Store,
    downloader: Downloader,
}

impl RoomFiles {
    async fn import(&self, data: Bytes) -> Result<BlobTicket> {
        let tag = self.blobs.add_bytes(data).await?;
        self.endpoint.online().await;
        Ok(BlobTicket::new(self.endpoint.addr(), tag.hash, tag.format))
    }

    async fn download(&self, ticket: BlobTicket) -> Result<Bytes> {
        self.address_lookup.add_endpoint_info(ticket.addr().clone());
        self.downloader
            .download(ticket.hash_and_format(), [ticket.addr().id])
            .await?;
        let bytes = self.blobs.get_bytes(ticket.hash()).await?;
        ensure!(
            bytes.len() <= MAX_FILE_BYTES,
            "Downloaded file exceeds the 25 MiB limit"
        );
        Ok(bytes)
    }
}

#[wasm_bindgen]
pub struct CollaborationNode {
    router: Router,
    gossip: Gossip,
    secret_key: SecretKey,
    files: RoomFiles,
}

#[wasm_bindgen]
impl CollaborationNode {
    pub async fn spawn() -> Result<Self, JsError> {
        console_error_panic_hook::set_once();
        let secret_key = SecretKey::generate();
        let address_lookup = MemoryLookup::default();
        let endpoint = Endpoint::builder(iroh::endpoint::presets::N0)
            .secret_key(secret_key.clone())
            .address_lookup(address_lookup.clone())
            .alpns(vec![GOSSIP_ALPN.to_vec(), iroh_blobs::ALPN.to_vec()])
            .bind()
            .await
            .map_err(to_js_err)?;
        let memory_store = iroh_blobs::store::mem::MemStore::default();
        let blobs = memory_store.as_ref().clone();
        let downloader = Downloader::new(&memory_store, &endpoint);
        let gossip = Gossip::builder().spawn(endpoint.clone());
        let files = RoomFiles {
            address_lookup,
            endpoint: endpoint.clone(),
            blobs,
            downloader,
        };
        let router = Router::builder(endpoint)
            .accept(GOSSIP_ALPN, gossip.clone())
            .accept(iroh_blobs::ALPN, BlobsProtocol::new(&memory_store, None))
            .spawn();
        Ok(Self {
            router,
            gossip,
            secret_key,
            files,
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
        let receiver = ReadableStream::from_stream(stream.map(|event| {
            Ok(serde_wasm_bindgen::to_value(&event).expect("room event is serializable"))
        }))
        .into_raw();

        let me = self.router.endpoint().id();
        ticket.bootstrap.insert(me);
        Ok(CollaborationRoom {
            topic_id: ticket.topic_id,
            bootstrap: ticket.bootstrap,
            me,
            neighbors,
            receiver,
            sender: room_sender,
            files: self.files.clone(),
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
    files: RoomFiles,
}

#[wasm_bindgen]
impl CollaborationRoom {
    pub fn id(&self) -> String {
        self.topic_id.to_string()
    }

    pub fn receiver(&self) -> JsReadableStream {
        self.receiver.clone()
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
        data: Uint8Array,
        name: String,
        media_type: String,
    ) -> Result<JsValue, JsError> {
        let name = clean_field(name, MAX_FILE_NAME_BYTES, "File name").map_err(to_js_err)?;
        let media_type = clean_media_type(media_type).map_err(to_js_err)?;
        let data = uint8array_to_bytes(&data);
        if data.is_empty() {
            return Err(JsError::new("The selected file is empty"));
        }
        if data.len() > MAX_FILE_BYTES {
            return Err(JsError::new("Files are limited to 25 MiB"));
        }
        let size = data.len() as u64;
        let ticket = self.files.import(data).await.map_err(to_js_err)?;
        let offer = FileOffer {
            id: ticket.hash().to_string(),
            name,
            media_type,
            size,
            ticket: ticket.to_string(),
        };
        self.sender
            .offer_file(offer.clone())
            .await
            .map_err(to_js_err)?;
        serde_wasm_bindgen::to_value(&offer).map_err(to_js_err)
    }

    pub async fn download_file(&self, ticket: String) -> Result<Uint8Array, JsError> {
        let ticket: BlobTicket = ticket.parse().map_err(to_js_err)?;
        let bytes = self.files.download(ticket).await.map_err(to_js_err)?;
        Ok(bytes_to_uint8array(&bytes))
    }
}

fn clean_nickname(value: String) -> Result<String> {
    clean_field(value, MAX_NAME_BYTES, "Name")
}

fn validate_offer(mut offer: FileOffer) -> Result<FileOffer> {
    offer.name = clean_field(offer.name, MAX_FILE_NAME_BYTES, "File name")?;
    offer.media_type = clean_media_type(offer.media_type)?;
    ensure!(offer.size > 0, "file is empty");
    ensure!(offer.size <= MAX_FILE_BYTES as u64, "file is too large");
    let ticket: BlobTicket = offer.ticket.parse()?;
    ensure!(
        offer.id == ticket.hash().to_string(),
        "file ID does not match its ticket"
    );
    Ok(offer)
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

fn to_js_err(error: impl Into<anyhow::Error>) -> JsError {
    JsError::new(&error.into().to_string())
}
