import { heroui } from '@heroui/react';
export default heroui({
  themes: {
    light: {
      colors: {
        primary: {
          '50': '#dfdfdf',
          '100': '#b3b3b3',
          '200': '#868686',
          '300': '#595959',
          '400': '#2d2d2d',
          '500': '#000000',
          '600': '#000000',
          '700': '#000000',
          '800': '#000000',
          '900': '#000000',
          foreground: '#fff',
          DEFAULT: '#000000',
        },
      },
    },
    dark: {
      colors: {
        primary: {
          '50': '#00211c',
          '100': '#00342d',
          '200': '#00473d',
          '300': '#005a4e',
          '400': '#006d5e',
          '500': '#2d877a',
          '600': '#59a096',
          '700': '#86bab3',
          '800': '#b3d3cf',
          '900': '#dfedeb',
          foreground: '#fff',
          DEFAULT: '#006d5e',
        },
      },
    },
  },
});
