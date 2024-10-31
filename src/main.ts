import { createApp } from 'vue';
import App from '@/App.vue';
import { createPinia } from 'pinia';
import router from '@/router';
import vuetify from '@/plugins/vuetify';
import { runtime, storage } from 'webextension-polyfill';
import { anclDataFieldNames } from '@/scripts/anclDataFieldNames';
import { detachAll } from '@/scripts/readResponse/chrome/catchResponse';
import { useMainStore } from './store';

const pinia = createPinia();
createApp(App).use(pinia).use(router).use(vuetify).mount('#app');

storage.local.onChanged.addListener(async (changes) => {
  if (Object.keys(changes).some((x) => anclDataFieldNames.includes(x)) === false) return;

  // データが全て揃ったら待機を解除する
  const storageData = await storage.local.get(anclDataFieldNames);
  if (anclDataFieldNames.every((x) => storageData[x])) {
    const mainStore = useMainStore();
    await mainStore.cancelRestore();
  }
});

// 待機を解除する。
window.addEventListener('load', detachAll);
window.addEventListener('beforeunload', async () => {
  await runtime.sendMessage('detachAll');
});
