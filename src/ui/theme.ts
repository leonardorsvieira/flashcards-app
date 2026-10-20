import { useColorScheme } from 'react-native';

const light = {
  bg: '#F6F4EF', surface: '#FFFFFF', surfaceAlt: '#EDEAE2', text: '#1F2328', muted: '#6B7078',
  border: '#E1DDD2', primary: '#2F6F5E', onPrimary: '#FFFFFF', danger: '#B3372F',
  again: '#C8473D', hard: '#C98A2B', good: '#2F6F5E', easy: '#3B6FB5',
};
export type Palette = typeof light;
const dark: Palette = {
  bg: '#14171A', surface: '#1E2327', surfaceAlt: '#262C31', text: '#ECEEF0', muted: '#9AA1A9',
  border: '#2E353B', primary: '#5FB89F', onPrimary: '#0E1F1A', danger: '#E5736B',
  again: '#E5736B', hard: '#E3A94F', good: '#5FB89F', easy: '#6FA0E0',
};

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { sm: 8, md: 14, lg: 22 };
export const deckColors = ['#2F6F5E', '#3B6FB5', '#8A5CB8', '#C98A2B', '#C8473D', '#4F7F9A'];

export function useTheme(): Palette & { dark: boolean } {
  const dk = useColorScheme() === 'dark';
  return { ...(dk ? dark : light), dark: dk };
}
