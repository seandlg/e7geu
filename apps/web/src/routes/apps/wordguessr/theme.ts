export const teamThemes = [
  { accent: '#38bdf8', deep: '#075985', glow: 'rgb(56 189 248 / 0.35)' },
  { accent: '#fb7185', deep: '#9f1239', glow: 'rgb(251 113 133 / 0.35)' },
  { accent: '#fbbf24', deep: '#92400e', glow: 'rgb(251 191 36 / 0.35)' },
  { accent: '#34d399', deep: '#065f46', glow: 'rgb(52 211 153 / 0.35)' },
] as const;

export function teamTheme(index: number): (typeof teamThemes)[number] {
  return teamThemes[index % teamThemes.length]!;
}
