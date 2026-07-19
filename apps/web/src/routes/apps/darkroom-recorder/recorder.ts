export const RECORDING_LIMIT_MS = 10 * 60 * 1000;
export const RECORDING_WARNING_MS = 8 * 60 * 1000;

export type DarkroomMode =
  | 'idle'
  | 'starting'
  | 'ready'
  | 'armed'
  | 'recording'
  | 'finalizing'
  | 'finished'
  | 'error'
  | 'unsupported';

export const preferredRecordingTypes = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
] as const;

export type RecordedClip = {
  blob: Blob;
  durationMs: number;
  filename: string;
  warning: string | null;
};

export type ActiveRecording = {
  finished: Promise<RecordedClip>;
  stop: () => void;
};

type RecorderLike = EventTarget & {
  mimeType: string;
  state: RecordingState;
  start: (timeslice?: number) => void;
  stop: () => void;
};

type RecorderConstructor = new (
  stream: MediaStream,
  options?: MediaRecorderOptions,
) => RecorderLike;

type RecordingDependencies = {
  createRecorder?: RecorderConstructor;
  isTypeSupported?: (mimeType: string) => boolean;
  now?: () => number;
};

export function supportedRecordingType(
  isTypeSupported: (mimeType: string) => boolean = MediaRecorder.isTypeSupported.bind(
    MediaRecorder,
  ),
): string | undefined {
  return preferredRecordingTypes.find((mimeType) => isTypeSupported(mimeType));
}

export function recordingExtension(mimeType: string): 'mp4' | 'webm' {
  return mimeType.toLowerCase().includes('mp4') ? 'mp4' : 'webm';
}

export function recordingFilename(startedAt: Date, mimeType: string): string {
  const parts = [
    startedAt.getFullYear(),
    pad(startedAt.getMonth() + 1),
    pad(startedAt.getDate()),
    '-',
    pad(startedAt.getHours()),
    pad(startedAt.getMinutes()),
    pad(startedAt.getSeconds()),
  ].join('');
  return `darkroom-recording-${parts}.${recordingExtension(mimeType)}`;
}

export function isRecordingControlKey(key: string): boolean {
  return [
    'AudioVolumeUp',
    'AudioVolumeDown',
    'MediaRecord',
    'MediaPlayPause',
    ' ',
    'Enter',
  ].includes(key);
}

export function modeAfterBlackoutExit(mode: DarkroomMode): DarkroomMode {
  return mode === 'armed' ? 'ready' : mode;
}

export function startVideoRecording(
  stream: MediaStream,
  dependencies: RecordingDependencies = {},
): ActiveRecording {
  const Recorder = dependencies.createRecorder ?? MediaRecorder;
  const now = dependencies.now ?? Date.now;
  const mimeType = supportedRecordingType(
    dependencies.isTypeSupported ?? MediaRecorder.isTypeSupported.bind(MediaRecorder),
  );
  const recorder = new Recorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  const startedAt = new Date(now());
  const startedAtMs = startedAt.getTime();
  let recorderError: string | null = null;
  let settled = false;

  const finished = new Promise<RecordedClip>((resolve, reject) => {
    recorder.addEventListener('dataavailable', (event) => {
      const blob = (event as BlobEvent).data;
      if (blob.size > 0) chunks.push(blob);
    });
    recorder.addEventListener('error', (event) => {
      recorderError = (event as ErrorEvent).message || 'Recording ended unexpectedly.';
    });
    recorder.addEventListener('stop', () => {
      if (settled) return;
      settled = true;
      if (chunks.length === 0) {
        reject(new Error(recorderError ?? 'The recording did not contain any video.'));
        return;
      }
      const actualType = recorder.mimeType || chunks[0]?.type || mimeType || 'video/webm';
      resolve({
        blob: new Blob(chunks, { type: actualType }),
        durationMs: Math.max(0, now() - startedAtMs),
        filename: recordingFilename(startedAt, actualType),
        warning: recorderError,
      });
    });
  });

  recorder.start(1000);

  return {
    finished,
    stop: () => {
      if (recorder.state !== 'inactive') recorder.stop();
    },
  };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
