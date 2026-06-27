import { defineConfig } from 'wxt';
import vuetify from 'vite-plugin-vuetify';

const version = process.env.npm_package_version;

// https://wxt.dev/api/config
export default defineConfig({
  srcDir: 'src',
  // 自動インポートは無効化（本プロジェクトは明示 import 方針）。WXT の API は '#imports' から import する。
  imports: false,
  webExt: { disabled: true },
  modules: ['@wxt-dev/module-vue', '@wxt-dev/auto-icons'],
  manifest: {
    name: `エンクリローダー ${version ?? ''}`.trim(),
    description: 'エンジェリックリンクの非公式リソースローダー',
    version_name: version,
    permissions: [
      'nativeMessaging',
      'debugger',
      'declarativeNetRequest',
      'webNavigation',
      'storage',
      'unlimitedStorage',
      'downloads',
      'alarms',
      'notifications',
    ],
    host_permissions: [
      '*://play.games.dmm.co.jp/game/angelicr/*',
      '*://play.games.dmm.com/game/angelic/*',
      '*://raw.githubusercontent.com/Connect-a/ancl-loader/*',
      '*://ancl-receiver.azurewebsites.net/*',
      'http://localhost:50021/*',
    ],
    declarative_net_request: {
      rule_resources: [{ id: 'ruleset', enabled: true, path: 'ruleset.json' }],
    },
  },
  hooks: {
    // auto-icons は manifest.icons のみ設定するため、ツールバー(action)アイコンにも同じ生成アイコンを反映する。
    'build:manifestGenerated': (_wxt, manifest) => {
      const icons = manifest.icons ?? { 16: 'icons/16.png', 32: 'icons/32.png', 48: 'icons/48.png', 128: 'icons/128.png' };
      manifest.action = { ...manifest.action, default_icon: icons };
    },
  },
  vite: () => ({
    build: { target: 'esnext' },
    plugins: [vuetify({ autoImport: true })],
    define: { __APP_VERSION__: JSON.stringify(version) },
  }),
});
