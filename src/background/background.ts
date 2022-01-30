import * as browser from 'webextension-polyfill';
import setUpChrome from './readResponse/chrome/catchResponse';
import setUpFirefox from './readResponse/firefox/catchResponse';
import { initStore } from "./store";

initStore();
setUpChrome();
setUpFirefox();

export const handleMessage = (message: any) => {
  switch (message.type) {
    case "switchEnable":
      localStorage.setItem("enable", message.data);
      if (message.data) setUpChrome();
      if (!message.data) {
        chrome.webNavigation.onCommitted.removeListener(x => x);
        chrome.debugger.getTargets((t) => t
          .filter(x => x.attached)
          .forEach(d => chrome.debugger.detach({ tabId: d.tabId, targetId: d.id })));
      }
      return true;
    default: return true;
  }
}

browser.runtime.onMessage.addListener(async (message, sender) => handleMessage(message));

