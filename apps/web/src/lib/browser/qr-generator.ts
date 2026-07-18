import QRCode from 'qrcode';

export async function renderQrCode(canvas: HTMLCanvasElement, value: string): Promise<void> {
  await QRCode.toCanvas(canvas, value, {
    width: 320,
    margin: 2,
    color: { dark: '#0f172a', light: '#ffffff' },
    errorCorrectionLevel: 'H',
  });
}

export function downloadQrCode(canvas: HTMLCanvasElement): void {
  const link = document.createElement('a');
  link.download = `qr-code-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
