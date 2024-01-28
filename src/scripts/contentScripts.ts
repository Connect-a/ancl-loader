import { storage } from 'webextension-polyfill';
const e = new XMLSerializer().serializeToString(document.head);
const token = (e.match(/"token":"(.+?)",/) ?? [])[1] ?? '';
if (token) storage.local.set({ token });
export {};
