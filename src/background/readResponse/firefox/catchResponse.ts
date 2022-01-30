import { decode } from '@msgpack/msgpack';
import * as browser from 'webextension-polyfill';

const MSGPACK_TYPE = `application/x-msgpack`;
const JSON_TYPE = `application/json`;
const HTML_TYPE = `text/html`;
const HEADER_CONTENT_TYPE = `Content-Type`;

const requestHeaders = new Map<string, browser.WebRequest.HttpHeaders | undefined>();
const requestBodies = new Map<string, browser.WebRequest.OnBeforeRequestDetailsTypeRequestBodyType | undefined>();
const responseHeaders = new Map<string, browser.WebRequest.HttpHeaders | undefined>();
const responseBodies = new Map<string, ArrayBuffer | undefined>();

export default (() => {
  if (chrome?.debugger) return;
  console.log("★not chrome");

  browser.webRequest.onBeforeRequest.addListener(
    (req) => {
      requestBodies.set(req.requestId, req.requestBody);
      const filter = browser.webRequest.filterResponseData(req.requestId);
      console.log(filter);

      filter.ondata = (event) => {
        console.log(`--- えべんと`);
        console.log(event);
        responseBodies.set(req.requestId, event.data);
      };
      return Promise.resolve({});
    }
    , { urls: ["<all_urls>"] }
    , ['requestBody','blocking']);

  browser.webRequest.onBeforeSendHeaders.addListener(
    (res) => { requestHeaders.set(res.requestId, res.requestHeaders); }
    , { urls: ["<all_urls>"] }
    , ['requestHeaders']);

  browser.webRequest.onHeadersReceived.addListener(
    (res) => { responseHeaders.set(res.requestId, res.responseHeaders); }
    , { urls: ["<all_urls>"] }
    , ['responseHeaders']);

  browser.webRequest.onCompleted.addListener((res) => {

    const header = responseHeaders.get(res.requestId);

    // NOTE: MessagePack or JSON or HTMLの通信について監視
    const contentType =
      header?.find(x => x.name === HEADER_CONTENT_TYPE)
      || header?.find(x => x.name === HEADER_CONTENT_TYPE.toLowerCase());

    if (!contentType) return;
    const isMsgpack = contentType.value?.toLowerCase().startsWith(MSGPACK_TYPE);
    const isJson = contentType.value?.toLowerCase().startsWith(JSON_TYPE);
    const isHtml = contentType.value?.toLowerCase().startsWith(HTML_TYPE);
    if (!isMsgpack && !isJson && !isHtml) return;

    // if (!res.url.includes('start')) return;
    // console.log(`---startきたよ\n${contentType.value}\n${!isMsgpack && !isJson && !isHtml}\n${res.url}`);

    const res2 = responseBodies.get(res.requestId);
    console.log(responseBodies);
    const body = requestBodies.get(res.requestId);
    if (body?.raw?.length) {
      const obj = decode(body.raw[0].bytes);
      console.log(obj);
    }
  }
    , { urls: ["<all_urls>"] });

});
