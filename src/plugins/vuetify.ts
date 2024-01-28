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
          primary: colors.deepPurple.accent4,
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
