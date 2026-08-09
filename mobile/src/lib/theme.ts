/**
 * Editorial theme — mirrors the web design system (warm ink + paper + gold).
 * No purple/blue. Use these tokens across all screens.
 */
export const theme = {
  bg: '#16130f', // warm ink ground
  surface: '#211e1a',
  surfaceHover: '#2a2723',
  hairline: 'rgba(244, 241, 234, 0.12)',
  hairlineStrong: 'rgba(244, 241, 234, 0.20)',

  paper: '#f4f1ea',
  paper60: 'rgba(244, 241, 234, 0.62)',
  paper40: 'rgba(244, 241, 234, 0.42)',

  gold: '#B45309',
  goldSoft: '#D08A3E',
  goldTint: 'rgba(180, 83, 9, 0.14)',

  burgundy: '#9B4552',
  ink: '#1a1815',

  radius: 6,
} as const;

export type Theme = typeof theme;
