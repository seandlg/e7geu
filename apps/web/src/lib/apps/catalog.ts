export type AppIcon = 'qr' | 'speed';

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
] as const;
