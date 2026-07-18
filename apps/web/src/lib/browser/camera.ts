export type CameraDevice = { id: string; label: string };

export type CameraController = {
  activeDeviceId: () => string | null;
  devices: () => Promise<CameraDevice[]>;
  hasTorch: () => boolean;
  setTorch: (enabled: boolean) => Promise<void>;
  start: (deviceId?: string) => Promise<void>;
  stop: () => void;
};

type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };
type TorchConstraint = MediaTrackConstraintSet & { torch?: boolean };

export async function openCamera(
  video: HTMLVideoElement,
  facingMode: 'environment' | 'user' = 'environment',
): Promise<CameraController> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera API unavailable');

  let stream: MediaStream | null = null;
  let selectedDeviceId: string | undefined;

  const stop = (): void => {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    video.srcObject = null;
  };

  const start = async (deviceId = selectedDeviceId): Promise<void> => {
    stop();
    const constraints: MediaTrackConstraints = deviceId
      ? { deviceId: { exact: deviceId } }
      : { facingMode: { ideal: facingMode } };
    const nextStream = await navigator.mediaDevices.getUserMedia({ video: constraints });
    stream = nextStream;
    video.srcObject = nextStream;
    try {
      await video.play();
      selectedDeviceId = nextStream.getVideoTracks()[0]?.getSettings().deviceId ?? deviceId;
    } catch (error) {
      stop();
      throw error;
    }
  };

  await start();

  return {
    stop,
    start,
    activeDeviceId: () =>
      stream?.getVideoTracks()[0]?.getSettings().deviceId ?? selectedDeviceId ?? null,
    devices: async () => {
      if (!navigator.mediaDevices.enumerateDevices) return [];
      try {
        return (await navigator.mediaDevices.enumerateDevices())
          .filter((device) => device.kind === 'videoinput')
          .map((device) => ({ id: device.deviceId, label: device.label }));
      } catch {
        return [];
      }
    },
    hasTorch: () => {
      const track = stream?.getVideoTracks()[0];
      return Boolean((track?.getCapabilities() as TorchCapabilities | undefined)?.torch);
    },
    setTorch: async (enabled) => {
      const track = stream?.getVideoTracks()[0];
      if (!track) throw new Error('Camera is not active');
      await track.applyConstraints({ advanced: [{ torch: enabled } as TorchConstraint] });
    },
  };
}

export function drawVideoFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  maximumEdge = Number.POSITIVE_INFINITY,
): boolean {
  const dimensions = fittedDimensions(video.videoWidth, video.videoHeight, maximumEdge);
  if (!dimensions) return false;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return false;
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  context.drawImage(video, 0, 0, dimensions.width, dimensions.height);
  return true;
}

export function fittedDimensions(
  width: number,
  height: number,
  maximumEdge: number,
): { width: number; height: number } | null {
  if (width <= 0 || height <= 0) return null;
  const scale = Math.min(1, maximumEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
