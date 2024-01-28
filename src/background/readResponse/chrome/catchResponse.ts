import { storage, webNavigation, type WebNavigation } from 'webextension-polyfill';
import { decode } from '@msgpack/msgpack';
const MSGPACK_TYPE = 'application/x-msgpack';
const HEADER_CONTENT_TYPE = 'Content-Type';

type ReqRespData = {
  url: string;
  headers: {
    [index: string]: string;
  };
  postData: string;
};

let _tabIds = new Array<number>();
const _requests = new Map<string, ReqRespData>();
const _responses = new Map<string, ReqRespData>();

const handleNetworkLoadingFinished = async (
  source: chrome.debugger.Debuggee,
  requestId: string,
) => {
  const req = _requests.get(requestId);
  if (!req) return;
  const resp = _responses.get(requestId);
  if (!resp) return;
  const url = resp.url;

  // NOTE: MessagePack or JSON or HTMLの通信について監視
  const contentType: string =
    resp.headers[HEADER_CONTENT_TYPE] || resp.headers[HEADER_CONTENT_TYPE.toLowerCase()];
  const isMsgpack = contentType?.toLowerCase().startsWith(MSGPACK_TYPE);
  // const isJson = contentType?.toLowerCase().startsWith(JSON_TYPE);
  // const isHtml = contentType?.toLowerCase().startsWith(HTML_TYPE);

  const url_v1 = '/game/api/v1';
  const url_indexJs = '/main/index';
  const url_character = '/game/res/chara';
  const url_story = '/game/res/story';
  const url_enemy = '/game/res/enemy_section';
  const url_event = '/game/res/event';
  const url_battleEvent = '/game/res/battle_event';
  const url_radio = '/game/res/radio';
  const url_voice = '/game/res/voice';
  const url_breed_season = '/game/res/breed_season';
  // const url_breed_monster = '/game/res/breed_monster';
  const targetUrl = [
    url_v1,
    url_indexJs,
    url_character,
    url_story,
    url_enemy,
    url_event,
    url_battleEvent,
    url_radio,
    url_voice,
    url_breed_season,
  ];

  if (!targetUrl.find((x) => url.includes(x))) return;

  const response = await chrome.debugger.sendCommand(source, 'Network.getResponseBody', {
    requestId,
  });

  if (!response) return;
  if (!('body' in response)) return;

  if (isMsgpack) {
    const decodedResponse = decode(
      Uint8Array.from((response.body as string).split('').map((c) => c.charCodeAt(0))),
    );
    // console.log(url, decodedResponse);

    if (url.includes(url_character)) await storage.local.set({ characters: decodedResponse });

    if (url.includes(url_story)) await storage.local.set({ stories: decodedResponse });

    if (url.includes(url_enemy)) await storage.local.set({ enemy: decodedResponse });

    if (url.includes(url_battleEvent)) await storage.local.set({ battleEvent: decodedResponse });

    if (url.includes(url_radio)) await storage.local.set({ radio: decodedResponse });

    if (url.includes(url_voice)) await storage.local.set({ voice: decodedResponse });

    //
    const xClass = req.headers['x-class'] ?? req.headers['X-Class'];
    const xFlass = req.headers['x-func'] || req.headers['X-Func'];
    if (xClass === 'Player' && xFlass === 'getInitData') {
      await storage.local.set({ initData: decodedResponse });
    }

    return;
  }

  if (url.includes(url_indexJs)) {
    // ボイスの抜き出し
    const match = (response.body as string).matchAll(
      /chara_id:"(?<chara_id>[^"]*)",chara_name:"[^"]*",voice_id:"(?<voice_id>[^"]*)",text:"(?<text>[^"]*)"/gm,
    );
    const voiceSet = Array.from(match).map((m) => ({
      chara_id: m.groups?.chara_id ?? '',
      voice_id: m.groups?.voice_id ?? '',
      text: JSON.parse(`"${m.groups?.text ?? ''}"`),
    }));

    await storage.local.set({ specificVoice: voiceSet });
  }
};

const handleDebuggerEvent = async (
  source: chrome.debugger.Debuggee,
  method: string,
  params?: object,
) => {
  const param = params as {
    targetInfo: { targetId: string };
    request: ReqRespData;
    requestId: string;
    response: ReqRespData;
  };
  switch (method) {
    case 'Target.attachedToTarget':
      {
        const deb = { targetId: param?.targetInfo.targetId };
        await chrome.debugger.attach(deb, '1.3', () => {
          chrome.debugger.sendCommand(deb, 'Target.setAutoAttach', {
            autoAttach: true,
            waitForDebuggerOnStart: false,
          });
          chrome.debugger.sendCommand(deb, 'Network.enable', {
            maxPostDataSize: 2147483647,
            maxResourceBufferSize: 2147483647,
            maxTotalBufferSize: 2147483647,
          });
        });
      }
      break;

    case 'Network.requestWillBeSent':
      if (!param?.request) return;
      _requests.set(param.requestId, param.request);
      break;

    case 'Network.responseReceived':
      if (!param?.response) return;
      _responses.set(param?.requestId, param.response);
      break;

    case 'Network.loadingFinished':
      await handleNetworkLoadingFinished(source, param.requestId);
      break;

    default:
      break;
  }
};

const detachDebugger = async (debuggee: chrome.debugger.Debuggee) => {
  const targets = await chrome.debugger.getTargets();
  const target = targets.find((x) => x.tabId === debuggee.tabId);
  if (target?.attached) {
    chrome.debugger.detach(debuggee);
    _tabIds = _tabIds.filter((x) => x !== debuggee.tabId);
  }
};

const handleWebNavigationOnCommitted = async (d: WebNavigation.OnCommittedDetailsType) => {
  const deb: chrome.debugger.Debuggee = { tabId: d.tabId };
  await detachDebugger(deb);

  if (deb.tabId) _tabIds.push(deb.tabId);
  await chrome.debugger.attach(deb, '1.3', () => {
    chrome.debugger.sendCommand(deb, 'Target.setAutoAttach', {
      autoAttach: true,
      waitForDebuggerOnStart: false,
    });
    chrome.debugger.sendCommand(deb, 'Network.enable', {
      maxPostDataSize: 2147483647,
      maxResourceBufferSize: 2147483647,
      maxTotalBufferSize: 2147483647,
    });
  });
};

export const setUpChrome = async () => {
  if (!chrome?.debugger) return;

  webNavigation.onCommitted.removeListener(handleWebNavigationOnCommitted);
  webNavigation.onCommitted.addListener(handleWebNavigationOnCommitted, {
    url: [
      { urlContains: 'pc-play.games.dmm.co.jp/play/angelicr' },
      { urlContains: 'pc-play.games.dmm.com/play/angelic' },
    ],
  });
  chrome.debugger.onEvent.removeListener(handleDebuggerEvent);
  chrome.debugger.onEvent.addListener(handleDebuggerEvent);
};

export const detachAll = async () => {
  console.log('detachAll');

  for (const d of _tabIds) await detachDebugger({ tabId: d });

  chrome.debugger.onEvent.removeListener(handleDebuggerEvent);
  webNavigation.onCommitted.removeListener(handleWebNavigationOnCommitted);
};
