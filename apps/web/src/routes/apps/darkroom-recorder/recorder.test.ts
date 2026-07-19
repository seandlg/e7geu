import { describe, expect, it, vi } from 'vite-plus/test';
import {
  isRecordingControlKey,
  modeAfterBlackoutExit,
  recordingExtension,
  recordingFilename,
  startVideoRecording,
  supportedRecordingType,
} from './recorder';

describe('recording format helpers', () => {
  it('selects the first format supported by the browser', () => {
    expect(supportedRecordingType((type) => type === 'video/webm;codecs=vp8,opus')).toBe(
      'video/webm;codecs=vp8,opus',
    );
    expect(supportedRecordingType(() => false)).toBeUndefined();
  });

  it('derives stable extensions and local filenames', () => {
    expect(recordingExtension('video/mp4;codecs=avc1')).toBe('mp4');
    expect(recordingExtension('video/webm;codecs=vp9')).toBe('webm');
    expect(recordingFilename(new Date(2026, 6, 19, 22, 15, 30), 'video/mp4')).toBe(
      'darkroom-recording-20260719-221530.mp4',
    );
  });

  it('recognizes progressive hardware and keyboard controls', () => {
    expect(isRecordingControlKey('AudioVolumeUp')).toBe(true);
    expect(isRecordingControlKey('MediaRecord')).toBe(true);
    expect(isRecordingControlKey('Enter')).toBe(true);
    expect(isRecordingControlKey('Escape')).toBe(false);
    expect(isRecordingControlKey('a')).toBe(false);
  });
});

describe('blackout interaction', () => {
  it('returns an armed recorder to its usable setup state', () => {
    expect(modeAfterBlackoutExit('armed')).toBe('ready');
  });

  it('does not interrupt recording or finished-clip states', () => {
    expect(modeAfterBlackoutExit('recording')).toBe('recording');
    expect(modeAfterBlackoutExit('finished')).toBe('finished');
  });
});

describe('startVideoRecording', () => {
  it('collects non-empty chunks and makes repeated stops safe', async () => {
    const now = vi.fn().mockReturnValueOnce(1_000).mockReturnValueOnce(4_250);
    const recording = startVideoRecording({} as MediaStream, {
      createRecorder: SuccessfulRecorder,
      isTypeSupported: (type) => type === 'video/mp4',
      now,
    });

    recording.stop();
    recording.stop();
    const clip = await recording.finished;

    expect(clip.blob.size).toBe(5);
    expect(clip.blob.type).toBe('video/mp4');
    expect(clip.durationMs).toBe(3_250);
    expect(clip.warning).toBeNull();
  });

  it('preserves partial data after an encoder error', async () => {
    const recording = startVideoRecording({} as MediaStream, {
      createRecorder: ErrorRecorder,
      isTypeSupported: () => false,
      now: () => 1_000,
    });

    recording.stop();
    await expect(recording.finished).resolves.toMatchObject({
      warning: 'Encoder became unavailable.',
    });
  });

  it('rejects an empty recording', async () => {
    const recording = startVideoRecording({} as MediaStream, {
      createRecorder: EmptyRecorder,
      isTypeSupported: () => false,
    });

    recording.stop();
    await expect(recording.finished).rejects.toThrow('did not contain any video');
  });
});

class FakeRecorder extends EventTarget {
  mimeType = 'video/mp4';
  state: RecordingState = 'inactive';

  constructor(_stream: MediaStream, _options?: MediaRecorderOptions) {
    super();
  }

  start(): void {
    this.state = 'recording';
  }

  stop(): void {
    if (this.state === 'inactive') return;
    this.state = 'inactive';
    this.beforeStop();
    this.dispatchEvent(new Event('stop'));
  }

  protected beforeStop(): void {}
}

class SuccessfulRecorder extends FakeRecorder {
  protected override beforeStop(): void {
    this.dispatchEvent(dataEvent(new Blob(['hello'])));
  }
}

class ErrorRecorder extends FakeRecorder {
  protected override beforeStop(): void {
    const error = new Event('error') as Event & { message: string };
    error.message = 'Encoder became unavailable.';
    this.dispatchEvent(error);
    this.dispatchEvent(dataEvent(new Blob(['partial'])));
  }
}

class EmptyRecorder extends FakeRecorder {}

function dataEvent(data: Blob): Event {
  const event = new Event('dataavailable') as Event & { data: Blob };
  event.data = data;
  return event;
}
