/* tslint:disable */
/* eslint-disable */
/**
 * The `ReadableStreamType` enum.
 *
 * *This API requires the following crate features to be activated: `ReadableStreamType`*
 */

export type ReadableStreamType = "bytes";

export class CollaborationNode {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    create(nickname: string): Promise<CollaborationRoom>;
    endpoint_id(): string;
    join(ticket: string, nickname: string): Promise<CollaborationRoom>;
    shutdown(): Promise<void>;
    static spawn(): Promise<CollaborationNode>;
}

export class CollaborationRoom {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    download_file(ticket: string): Promise<Uint8Array>;
    id(): string;
    offer_file(data: Uint8Array, name: string, media_type: string): Promise<any>;
    receiver(): ReadableStream;
    send_chat(text: string): Promise<void>;
    ticket(): string;
}

export class IntoUnderlyingByteSource {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    cancel(): void;
    pull(controller: ReadableByteStreamController): Promise<any>;
    start(controller: ReadableByteStreamController): void;
    readonly autoAllocateChunkSize: number;
    readonly type: ReadableStreamType;
}

export class IntoUnderlyingSink {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    abort(reason: any): Promise<any>;
    close(): Promise<any>;
    write(chunk: any): Promise<any>;
}

export class IntoUnderlyingSource {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    cancel(): void;
    pull(controller: ReadableStreamDefaultController): Promise<any>;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_collaborationnode_free: (a: number, b: number) => void;
    readonly __wbg_collaborationroom_free: (a: number, b: number) => void;
    readonly collaborationnode_create: (a: number, b: number, c: number) => number;
    readonly collaborationnode_endpoint_id: (a: number, b: number) => void;
    readonly collaborationnode_join: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly collaborationnode_shutdown: (a: number) => number;
    readonly collaborationnode_spawn: () => number;
    readonly collaborationroom_download_file: (a: number, b: number, c: number) => number;
    readonly collaborationroom_id: (a: number, b: number) => void;
    readonly collaborationroom_offer_file: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly collaborationroom_receiver: (a: number) => number;
    readonly collaborationroom_send_chat: (a: number, b: number, c: number) => number;
    readonly collaborationroom_ticket: (a: number, b: number) => void;
    readonly __wbg_intounderlyingbytesource_free: (a: number, b: number) => void;
    readonly __wbg_intounderlyingsink_free: (a: number, b: number) => void;
    readonly __wbg_intounderlyingsource_free: (a: number, b: number) => void;
    readonly intounderlyingbytesource_autoAllocateChunkSize: (a: number) => number;
    readonly intounderlyingbytesource_cancel: (a: number) => void;
    readonly intounderlyingbytesource_pull: (a: number, b: number) => number;
    readonly intounderlyingbytesource_start: (a: number, b: number) => void;
    readonly intounderlyingbytesource_type: (a: number) => number;
    readonly intounderlyingsink_abort: (a: number, b: number) => number;
    readonly intounderlyingsink_close: (a: number) => number;
    readonly intounderlyingsink_write: (a: number, b: number) => number;
    readonly intounderlyingsource_cancel: (a: number) => void;
    readonly intounderlyingsource_pull: (a: number, b: number) => number;
    readonly ring_core_0_17_14__bn_mul_mont: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly __wasm_bindgen_func_elem_19306: (a: number, b: number, c: number, d: number) => void;
    readonly __wasm_bindgen_func_elem_19311: (a: number, b: number, c: number, d: number) => void;
    readonly __wasm_bindgen_func_elem_10671: (a: number, b: number, c: number) => void;
    readonly __wasm_bindgen_func_elem_7182: (a: number, b: number, c: number) => void;
    readonly __wasm_bindgen_func_elem_12369: (a: number, b: number, c: number) => void;
    readonly __wasm_bindgen_func_elem_10451: (a: number, b: number) => void;
    readonly __wasm_bindgen_func_elem_11595: (a: number, b: number) => void;
    readonly __wasm_bindgen_func_elem_11646: (a: number, b: number) => void;
    readonly __wasm_bindgen_func_elem_19178: (a: number, b: number) => void;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export3: (a: number) => void;
    readonly __wbindgen_export4: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export5: (a: number, b: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
