export const C = {
  gold: '#C5A059',
  goldSoft: '#D4B06A',
  goldBg: '#FBF7EE',
  goldLight: '#F5ECD7',
  goldDark: '#8B6B2F',
  red: '#BE123C',
  bg: '#FCFCFC',
  text: '#1c1917',
  textSecondary: '#78716c',
  textMuted: '#a8a29e',
  border: '#f2f1ec',
  surface: '#ffffff',
} as const;

// Re-export individual tokens used by components
export const { goldBg, goldLight, goldDark } = C;

export const F = {
  serif: 'EBGaramond_400Regular',
  serifItalic: 'EBGaramond_400Regular_Italic',
  serifMedium: 'EBGaramond_500Medium',
  serifMediumItalic: 'EBGaramond_500Medium_Italic',
  serifSemiBold: 'EBGaramond_600SemiBold',
  serifBold: 'EBGaramond_700Bold',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemiBold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
} as const;
