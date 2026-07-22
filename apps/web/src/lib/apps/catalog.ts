export type AppIcon =
  | 'qr'
  | 'record'
  | 'speed'
  | 'sound'
  | 'color'
  | 'word'
  | 'break'
  | 'cv'
  | 'image'
  | 'cutout'
  | 'cafe'
  | 'calendar'
  | 'cards';

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
    name: 'Arcana',
    description: 'Bid, bluff, and take tricks with friends over an encrypted private table.',
    href: '/apps/arcana',
    icon: 'cards',
    accent: '#fbbf24',
    capability: 'Online party game',
  },
  {
    name: 'Holiday Calendar',
    description: 'Compare school breaks and public holidays across countries and regions.',
    href: '/apps/holiday-calendar',
    icon: 'calendar',
    accent: '#2dd4bf',
    capability: 'Calendar',
  },
  {
    name: 'Berlin Work Cafés',
    description: 'Find candidly reviewed Berlin cafés that are actually practical for work.',
    href: '/apps/berlin-work-cafes',
    icon: 'cafe',
    accent: '#fb923c',
    capability: 'Local guide',
  },
  {
    name: 'Darkroom Recorder',
    description: 'Record private video with a distraction-free black screen.',
    href: '/apps/darkroom-recorder',
    icon: 'record',
    accent: '#ef4444',
    capability: 'Camera + microphone',
  },
  {
    name: 'Image Compressor',
    description: 'Resize, compress, and convert images without uploading them.',
    href: '/apps/image-compressor',
    icon: 'image',
    accent: '#c084fc',
    capability: 'Images',
  },
  {
    name: 'Background Remover',
    description: 'Remove an image background privately with optional on-device AI.',
    href: '/apps/background-remover',
    icon: 'cutout',
    accent: '#4ade80',
    capability: 'Optional AI download',
  },
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
  {
    name: 'CV Generator',
    description: 'Create, save, and print a polished CV on your device.',
    href: '/apps/cv-generator',
    icon: 'cv',
    accent: '#60a5fa',
    capability: 'Documents',
  },
] as const;
