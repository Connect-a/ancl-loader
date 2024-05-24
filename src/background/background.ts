import { runtime, storage } from 'webextension-polyfill';
import { detachAll, setUpChrome } from './readResponse/chrome/catchResponse';
import { anclDataFieldNames } from '@/scripts/anclDataFieldNames';
// import setUpFirefox from './readResponse/firefox/catchResponse';

runtime.onMessage.addListener(async (message, _sender) => {
  switch (message) {
    case 'awaitGameData':
      await storage.local.set({ isAwaitGameData: true });
      setUpChrome();
      // setUpFirefox();
      break;
    case 'cancelRestore':
      await storage.local.set({ isAwaitGameData: false });
      await detachAll();
      break;
    case 'getIsAwaitGameData':
      return (await storage.local.get('isAwaitGameData')).isAwaitGameData;
    default:
      break;
  }
  return Promise.resolve(true);
});

storage.local.onChanged.addListener(async (changes) => {
  if (Object.keys(changes).some((x) => anclDataFieldNames.includes(x)) === false) return;

  // データが全て揃ったら待機を解除する
  const storageData = await storage.local.get(anclDataFieldNames);
  if (anclDataFieldNames.every((x) => storageData[x])) {
    await storage.local.set({ isAwaitGameData: false });
    await detachAll();
  }
});
