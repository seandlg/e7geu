export type AppIcon = 'qr' | 'speed' | 'sound' | 'color' | 'word' | 'break';

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
  {
    name: 'Wordguessr',
    description: 'Race your friends through fast word challenges.',
    href: '/apps/wordguessr',
    icon: 'word',
    accent: '#fbbf24',
    capability: 'Party game',
  },
  {
    name: 'Break Timer',
    description: 'Repeat gentle reminders to look away, stretch, or reset.',
    href: '/apps/break-timer',
    icon: 'break',
    accent: '#22d3ee',
    capability: 'Timer',
  },
] as const;
