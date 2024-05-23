import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';
import { crx, defineManifest } from '@crxjs/vite-plugin';

const manifest = defineManifest({
  name: 'エンクリローダー',
  description: 'エンジェリックリンクの非公式リソースローダー',
  version: '2.1.0',
  version_name: '2.1.0',
  manifest_version: 3,
  permissions: [
    'nativeMessaging',
    'debugger',
    'declarativeNetRequest',
    'webNavigation',
    'storage',
    'unlimitedStorage',
  ],
  host_permissions: [
    '*://pc-play.games.dmm.co.jp/play/angelicr/*',
    '*://pc-play.games.dmm.com/play/angelic/*',
    '*://raw.githubusercontent.com/Connect-a/ancl-loader/*',
    '*://ancl-receiver.azurewebsites.net/*',
  ],
  icons: {
    '16': 'icon.png',
    '48': 'icon.png',
  },
  content_scripts: [
    {
      matches: ['*://ancl.jp/game/pc/start/*'],
      js: ['src/scripts/contentScripts.ts'],
      all_frames: true,
    },
  ],
  background: {
    service_worker: 'src/background/background.ts',
    type: 'module',
  },
  action: {
    default_icon: 'icon.png',
    default_popup: 'index.html',
  },
  declarative_net_request: {
    rule_resources: [
      {
        id: 'ruleset',
        enabled: true,
        path: 'ruleset.json',
      },
    ],
  },
});

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    target: 'esnext'
  },
  plugins: [vue(), vuetify({ autoImport: true }), crx({ manifest })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  define: {
    '__APP_VERSION__': JSON.stringify(process.env.npm_package_version),
  },
  server: {
    port: 5174,
    strictPort: true,
    hmr: {
      port: 5174,
      clientPort: 5174,
    },
  },
})
