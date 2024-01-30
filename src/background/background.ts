import { runtime } from 'webextension-polyfill';
import { detachAll, setUpChrome } from './readResponse/chrome/catchResponse';
// import setUpFirefox from './readResponse/firefox/catchResponse';

runtime.onMessage.addListener(async (message, _sender) => {
  switch (message) {
    case 'awaitGameData':
      setUpChrome();
      // setUpFirefox();
      break;
    case 'completeRestore':
    case 'cancelRestore':
      await detachAll();
      break;
    default:
      break;
  }
  return Promise.resolve(true);
});
