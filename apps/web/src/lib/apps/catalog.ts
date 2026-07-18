export type AppIcon = 'qr' | 'speed' | 'sound' | 'color';

export type ToolboxApp = {
  name: string;
  description: string;
  href: `/apps/${string}`;
  icon: AppIcon;
  accent: string;
  capability: string;
};

export const toolboxApps: readonly ToolboxApp[] = [
  {
    name: 'QR scanner',
    description: 'Scan QR codes with your camera or choose an image.',
    href: '/apps/qr-scanner',
    icon: 'qr',
    accent: '#38bdf8',
    capability: 'Camera',
  },
  {
    name: 'Speedometer',
    description: 'See your live GPS speed, heading, and accuracy.',
    href: '/apps/speedometer',
    icon: 'speed',
    accent: '#a78bfa',
    capability: 'Location',
  },
  {
    name: 'Sound meter',
    description: 'Estimate noise level and see its frequency spectrum.',
    href: '/apps/sound-meter',
    icon: 'sound',
    accent: '#34d399',
    capability: 'Microphone',
  },
  {
    name: 'Color inspector',
    description: 'Pick exact colors from your camera or a photo.',
    href: '/apps/color-inspector',
    icon: 'color',
    accent: '#fb7185',
    capability: 'Camera',
  },
] as const;
