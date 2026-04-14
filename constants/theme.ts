import { Platform } from 'react-native';

export const Colors = {
  primary: '#5C7A63',
  primaryDark: '#3E5C44',
  primaryLight: '#EDF3EE',
  primaryBorder: '#C2D9C8',

  background: '#F4F7F5',
  card: '#FFFFFF',

  text: '#2C3A2E',
  textSecondary: '#6B7C6D',
  textMuted: '#9EAD9F',
  placeholder: '#A8BEA9',

  border: '#D4E2D7',
  divider: '#E8F0EA',

  success: '#4A9B6F',
  error: '#D9534F',

  light: {
    text: '#2C3A2E',
    background: '#F4F7F5',
    tint: '#5C7A63',
    icon: '#6B7C6D',
    tabIconDefault: '#9EAD9F',
    tabIconSelected: '#5C7A63',
  },
  dark: {
    text: '#E8F0EA',
    background: '#1A2B1E',
    tint: '#8FBF97',
    icon: '#9EAD9F',
    tabIconDefault: '#6B7C6D',
    tabIconSelected: '#8FBF97',
  },
};

export const Radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const Shadows = {
  sm: {
    shadowColor: '#2C3A2E',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: '#2C3A2E',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
});
