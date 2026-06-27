import 'vuetify/styles';
import { createVuetify } from 'vuetify';
import colors from 'vuetify/util/colors';
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg';

export default createVuetify({
  theme: {
    defaultTheme: 'dark',
    themes: {
      dark: {
        colors: {
          primary: colors.deepPurple.lighten1,
          background: colors.grey.darken4,
          surface: colors.grey.darken3,
          'surface-light': colors.grey.darken2,
          incomplete: colors.lightBlue.lighten3,
        },
      },
    },
  },
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: {
      mdi,
    },
  },
});
