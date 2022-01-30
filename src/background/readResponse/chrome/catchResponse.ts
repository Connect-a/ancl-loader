import * as browser from "webextension-polyfill";
import { decode } from '@msgpack/msgpack';
import { handleMessage } from "../../store";
import { InitData } from "@/@types";
const MSGPACK_TYPE = `application/x-msgpack`;
const JSON_TYPE = `application/json`;
const HTML_TYPE = `text/html`;
const HEADER_CONTENT_TYPE = `Content-Type`;

const _requests = new Map<string, { url: string, headers: { [index: string]: string; }, postData: string; }>();
const _responses = new Map<string, { url: string, headers: { [index: string]: string; }, postData: string; }>();

chrome.debugger.onEvent.addListener((source, method, params: any) => {
  switch (method) {
    case "Target.attachedToTarget":
      const deb = { targetId: params.targetInfo.targetId };
      chrome.debugger.attach(deb, '1.3', () => {
        chrome.debugger.sendCommand(deb, "Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false });
        chrome.debugger.sendCommand(deb, "Network.enable", { maxPostDataSize: 2147483647, maxResourceBufferSize: 2147483647, maxTotalBufferSize: 2147483647 });
      });
      break;

    case "Network.requestWillBeSent":
      if (!params?.request) return;
      _requests.set(params.requestId, params.request);
      break;

    case "Network.responseReceived":
      if (!params?.response) return;
      _responses.set(params?.requestId, params.response);
      break;

    case "Network.loadingFinished":
      const req = _requests.get(params?.requestId);
      if (!req) return;
      const resp = _responses.get(params?.requestId);
      if (!resp) return;
      const url = resp.url;

      // NOTE: MessagePack or JSON or HTMLの通信について監視
      const contentType: string = resp.headers[HEADER_CONTENT_TYPE] || resp.headers[HEADER_CONTENT_TYPE.toLowerCase()];
      const isMsgpack = contentType?.toLowerCase().startsWith(MSGPACK_TYPE);
      // const isJson = contentType?.toLowerCase().startsWith(JSON_TYPE);
      // const isHtml = contentType?.toLowerCase().startsWith(HTML_TYPE);

      const url_v1 = "/game/api/v1";
      const url_projectJs = "/game/client/pc/src/project";
      const url_character = "/game/res/chara";
      const url_story = "/game/res/story";
      const url_enemy = "/game/res/enemy_section";
      const url_event = "/game/res/event";
      const url_battleEvent = "/game/res/battle_event";
      const url_radio = "/game/res/radio";
      const targetUrl = [
        url_v1,
        url_projectJs,
        url_character,
        url_story,
        url_enemy,
        url_event,
        url_battleEvent,
        url_radio];

      if (!targetUrl.find(x => url.includes(x))) return;

      chrome.debugger.sendCommand(
        source
        , "Network.getResponseBody"
        , { "requestId": params?.requestId }
        , async (response: any) => {
          if (!response) return;

          if (isMsgpack) {
            const decodedResponse: any = decode(Uint8Array.from(Array.from(response.body as string).map(c => c.charCodeAt(0))));
            console.log(`♪decodedResponse`, url, decodedResponse)
            if (url.includes(url_character)) {
              if (handleMessage({ type: "getCharacters" })) return;
              handleMessage({ type: "setCharacters", data: decodedResponse });
            }
            if (url.includes(url_story)) {
              if (handleMessage({ type: "getCharacters" })) return;
              handleMessage({ type: "setStories", data: decodedResponse });
            }
            //
            const xClass = req.headers["x-class"] ?? req.headers["X-Class"];
            const xFlass = req.headers["x-func"] || req.headers["X-Func"];
            if (xClass === "Player" && xFlass === "getInitData") {
              const initData = decodedResponse as InitData
              handleMessage({ type: "setInitData", data: decodedResponse });
              const resC = await fetch(`https://ancl.jp/game/res/chara/${initData.result.resources.chara}`);
              handleMessage({ type: "setCharacters", data: decode(await resC.arrayBuffer()) });
              const resS = await fetch(`https://ancl.jp/game/res/story/${initData.result.resources.story}`);
              handleMessage({ type: "setStories", data: decode(await resS.arrayBuffer()) });
              const resE = await fetch(`https://ancl.jp/game/res/enemy_section/${initData.result.resources.enemy_section}`);
              handleMessage({ type: "setEnemy", data: decode(await resE.arrayBuffer()) });
              const resB = await fetch(`https://ancl.jp/game/res/battle_event/${initData.result.resources.battle_event}`);
              handleMessage({ type: "setBattleEvent", data: decode(await resB.arrayBuffer()) });
              const resR = await fetch(`https://ancl.jp/game/res/radio/${initData.result.resources.radio}`);
              handleMessage({ type: "setRadio", data: decode(await resR.arrayBuffer()) });
            }
            return;
          }

          if (url.includes(url_projectJs)) {
            // ボイスの抜き出し
            const match = (response.body as string).matchAll(/chara_id:"([^\+]*?)",(chara_name:"([^\+]*?)",)?voice_id:"([^\+]*?)"/g);
            const voiceSet = new Set(Array.from(match).map(m => ({ chara_id: m[1], voice_id: m[4] })));
            handleMessage({ type: "setVoice", data: Array.from(voiceSet) });
          }

        });
      break;

    default:
      break;
  }
});

export default () => {
  if (!chrome?.debugger) return;

  chrome.webNavigation.onCommitted.addListener(
    (d) => {
      if (localStorage.getItem("enable") === "false") return;
      if (!d.tabId || d.frameId !== 0 || !d.url.includes('pc-play.games.dmm.co.jp/play/angelicr')) return;

      const deb = { tabId: d.tabId };
      chrome.debugger.attach(deb, '1.3', () => {
        chrome.debugger.sendCommand(deb, "Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false });
        chrome.debugger.sendCommand(deb, "Network.enable", { maxPostDataSize: 2147483647, maxResourceBufferSize: 2147483647, maxTotalBufferSize: 2147483647 });
      });
    }
    , { url: [{ urlContains: 'pc-play.games.dmm.co.jp/play/angelicr' }] });
};