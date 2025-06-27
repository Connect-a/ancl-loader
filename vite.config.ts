import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';
import { crx, defineManifest } from '@crxjs/vite-plugin';

const version = process.env.npm_package_version;
// HACK : 「as never」はcrx/jsの型定義回避のための一時的修正になるかと思われる。
const manifest = defineManifest({
  name: `エンクリローダー ${version}`,
  description: 'エンジェリックリンクの非公式リソースローダー',
  version: version ?? '0.0.0',
  version_name: version,
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
    '*://play.games.dmm.co.jp/game/angelicr/*',
    '*://play.games.dmm.com/game/angelic/*',
    '*://raw.githubusercontent.com/Connect-a/ancl-loader/*',
    '*://ancl-receiver.azurewebsites.net/*',
  ],
  icons: {
    16: 'icon.png' as never,
    48: 'icon.png' as never,
    128: 'icon.png' as never
  },
  content_scripts: [
    {
      matches: ['*://ancl.jp/game/pc/start/*'],
      js: ['src/scripts/contentScripts.ts' as never],
      all_frames: true,
    },
  ],
  action: {
    default_icon: 'icon.png' as never,
    default_popup: 'index.html' as never
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
    target: 'esnext',
  },
  plugins: [vue(), vuetify({ autoImport: true }), crx({ manifest })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
  server: {
    port: 5174,
    strictPort: true,
    hmr: {
      port: 5174,
      clientPort: 5174,
    },
    cors: true,
  },
});
