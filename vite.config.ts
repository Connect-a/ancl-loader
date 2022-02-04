import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from '@vuetify/vite-plugin';
import path from 'path';
import copy from 'rollup-plugin-copy';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true, }),
    copy({ targets: [{ src: 'README.md', dest: 'public' }] })
  ],
  define: { 'process.env': {} },
  resolve: {
    alias: [{
      find: '@',
      replacement: path.resolve(__dirname, './src')
    }]
  },
  build: {
    target: "esnext",
    rollupOptions: {
      input: {
        main: './popup.html',
        background: './background.html',
        contentScript: './src/contentScript/contentScript.ts',
      },
      output: {
        entryFileNames: '[name].js'
      }
    },
  },
});
