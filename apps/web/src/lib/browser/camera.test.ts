import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { drawVideoFrame, fittedDimensions, openCamera } from './camera';

afterEach(() => vi.unstubAllGlobals());

describe('openCamera', () => {
  it('owns stream replacement and selects an exact camera', async () => {
    const firstTrack = cameraTrack('rear');
    const secondTrack = cameraTrack('macro');
    const firstStream = cameraStream(firstTrack);
    const secondStream = cameraStream(secondTrack);
    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(firstStream)
      .mockResolvedValueOnce(secondStream);
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia,
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
    });
    const video = { srcObject: null, play: vi.fn() } as unknown as HTMLVideoElement;

    const camera = await openCamera(video);
    expect(camera.activeDeviceId()).toBe('rear');
    await camera.start('macro');

    expect(firstTrack.stop).toHaveBeenCalledOnce();
    expect(getUserMedia).toHaveBeenLastCalledWith({
      video: { deviceId: { exact: 'macro' } },
    });
    expect(camera.activeDeviceId()).toBe('macro');
    camera.stop();
    expect(secondTrack.stop).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
  });
});

describe('camera frame helpers', () => {
  it('fits a frame within a maximum edge', () => {
    expect(fittedDimensions(3840, 2160, 1920)).toEqual({ width: 1920, height: 1080 });
    expect(fittedDimensions(640, 480, 1920)).toEqual({ width: 640, height: 480 });
    expect(fittedDimensions(0, 480, 1920)).toBeNull();
  });

  it('draws the video frame at the fitted size', () => {
    const drawImage = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
    } as unknown as HTMLCanvasElement;
    const video = { videoWidth: 3840, videoHeight: 2160 } as HTMLVideoElement;

    expect(drawVideoFrame(video, canvas, 1920)).toBe(true);
    expect(canvas.width).toBe(1920);
    expect(canvas.height).toBe(1080);
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 1920, 1080);
  });
});

function cameraTrack(deviceId: string) {
  return {
    stop: vi.fn(),
    getSettings: () => ({ deviceId }),
    getCapabilities: () => ({}),
    applyConstraints: vi.fn(),
  };
}

function cameraStream(track: ReturnType<typeof cameraTrack>) {
  return {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  } as unknown as MediaStream;
}
