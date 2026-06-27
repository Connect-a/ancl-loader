import { browser, type Browser } from 'wxt/browser';
import { encodeBase64Msgpack } from '@/utils/msgpack';
import { storage } from '@wxt-dev/storage';
import type { AnclDataField } from '@/scripts/anclData';
const MSGPACK_TYPE = 'application/x-msgpack';
const HEADER_CONTENT_TYPE = 'Content-Type';

type ReqRespData = {
  url: string;
  headers: {
    [index: string]: string;
  };
  postData: string;
};

const _requests = new Map<string, ReqRespData>();
const _responses = new Map<string, ReqRespData>();
// responseReceived〜loadingFinished/Failedの間のrequestId→フィールド。UIの「読み込み中」表示用。
const _capturingByRequest = new Map<string, AnclDataField>();

const URL_V1 = '/game/api/v1';
const URL_INDEX_JS = '/main/index';
const URL_CHARACTER = '/game/res/chara';
const URL_STORY = '/game/res/story';
const URL_ENEMY = '/game/res/enemy_section';
const URL_EVENT = '/game/res/event';
const URL_BATTLE_EVENT = '/game/res/battle_event';
const URL_BATTLE_MAIN = '/game/res/battle_main';
const URL_BATTLE_LIMITED = '/game/res/battle_limited';
const URL_RADIO = '/game/res/radio';
const URL_VOICE = '/game/res/voice';
const URL_BREED_SEASON = '/game/res/breed_season';

const TARGET_URLS = [
  URL_V1,
  URL_INDEX_JS,
  URL_CHARACTER,
  URL_STORY,
  URL_ENEMY,
  URL_EVENT,
  URL_BATTLE_EVENT,
  URL_BATTLE_MAIN,
  URL_BATTLE_LIMITED,
  URL_RADIO,
  URL_VOICE,
  URL_BREED_SEASON,
];

// tokenはcontent script由来、specificVoiceはindex JS由来のため対象外。
const urlToField = (url: string, reqHeaders: Record<string, string>): AnclDataField | null => {
  if (url.includes(URL_CHARACTER)) return 'characters';
  if (url.includes(URL_STORY)) return 'stories';
  if (url.includes(URL_ENEMY)) return 'enemy';
  if (url.includes(URL_BATTLE_EVENT)) return 'battleEvent';
  if (url.includes(URL_BATTLE_MAIN)) return 'battleMain';
  if (url.includes(URL_BATTLE_LIMITED)) return 'battleLimited';
  if (url.includes(URL_EVENT)) return 'event';
  if (url.includes(URL_RADIO)) return 'radio';
  if (url.includes(URL_VOICE)) return 'voice';
  const xClass = reqHeaders['x-class'] ?? reqHeaders['X-Class'];
  const xFunc = reqHeaders['x-func'] ?? reqHeaders['X-Func'];
  if (url.includes(URL_V1) && xClass === 'Player' && xFunc === 'getInitData') return 'initData';
  return null;
};

const publishCapturing = () => storage.setItem('session:capturing', [...new Set(_capturingByRequest.values())]);

const handleNetworkLoadingFinished = async (source: chrome.debugger.Debuggee, requestId: string) => {
  const req = _requests.get(requestId);
  if (!req) return;
  const resp = _responses.get(requestId);
  if (!resp) return;
  const url = resp.url;

  const contentType = resp.headers[HEADER_CONTENT_TYPE] || resp.headers[HEADER_CONTENT_TYPE.toLowerCase()] || '';
  const isMsgpack = contentType?.toLowerCase().startsWith(MSGPACK_TYPE);

  if (!TARGET_URLS.some((x) => url.includes(x))) return;

  const response = await chrome.debugger.sendCommand(source, 'Network.getResponseBody', {
    requestId,
  });

  if (!response) return;
  if (!('body' in response)) return;
  const base64Encoded = 'base64Encoded' in response && response.base64Encoded;

  if (isMsgpack) {
    if (base64Encoded) {
      throw new Error(`ancl: [CDP] base64Encoded=trueは未対応（サーバーのcharset変更？）URL: ${url}`);
    }

    // オブジェクトで保存するとシリアライズ・コピーが複数回発生するため文字列で扱う。
    // 読み込みの高速化を優先し、x-user-definedからネイティブ実装の可能性が高いBase64でエンコードして保存する。
    const body = response.body as string;
    const bytes = Uint8Array.from(body, (c) => c.charCodeAt(0) & 0xff);
    const base64 = bytes.toBase64();

    const field = urlToField(url, req.headers);
    if (field) await storage.setItem(`local:${field}`, base64);

    return;
  }

  if (url.includes(URL_INDEX_JS)) {
    const match = (response.body as string).matchAll(
      /chara_id:"(?<chara_id>[^"]*)",chara_name:"[^"]*",voice_id:"(?<voice_id>[^"]*)",text:"(?<text>[^"]*)"/gm,
    );
    const voiceSet = match
      .map((m) => ({
        chara_id: m.groups?.chara_id ?? '',
        voice_id: m.groups?.voice_id ?? '',
        text: JSON.parse(`"${m.groups?.text ?? ''}"`),
      }))
      .toArray();

    // キャッシュや形式変化で0件のとき既存のspecificVoiceを壊さないよう、非空時だけ更新する。
    if (voiceSet.length > 0) {
      await storage.setItem('local:specificVoice', encodeBase64Msgpack(voiceSet));
    }
  }
};

const handleDebuggerEvent = async (source: chrome.debugger.Debuggee, method: string, params?: object) => {
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
      {
        const field = urlToField(param.response.url, _requests.get(param.requestId)?.headers ?? {});
        if (field) {
          _capturingByRequest.set(param.requestId, field);
          await publishCapturing();
        }
      }
      break;

    case 'Network.loadingFinished':
      await handleNetworkLoadingFinished(source, param.requestId);
      _requests.delete(param.requestId);
      _responses.delete(param.requestId);
      if (_capturingByRequest.delete(param.requestId)) await publishCapturing();
      break;

    case 'Network.loadingFailed':
      _requests.delete(param.requestId);
      _responses.delete(param.requestId);
      if (_capturingByRequest.delete(param.requestId)) await publishCapturing();
      break;

    default:
      break;
  }
};

const handleWebNavigationOnCommitted = async (d: Browser.webNavigation.WebNavigationTransitionCallbackDetails) => {
  const deb: chrome.debugger.Debuggee = { tabId: d.tabId };
  const targets = await chrome.debugger.getTargets();
  if (targets.some((x) => x.tabId === d.tabId && x.attached)) {
    chrome.debugger.detach(deb);
  }

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

  browser.webNavigation.onCommitted.removeListener(handleWebNavigationOnCommitted);
  browser.webNavigation.onCommitted.addListener(handleWebNavigationOnCommitted, {
    url: [{ urlContains: 'play.games.dmm.co.jp/game/angelicr' }, { urlContains: 'play.games.dmm.com/game/angelic' }],
  });
  chrome.debugger.onEvent.removeListener(handleDebuggerEvent);
  chrome.debugger.onEvent.addListener(handleDebuggerEvent);
};

export const detachAll = async () => {
  console.log('ancl: detachAll');
  const targets = await chrome.debugger.getTargets();
  for (const t of targets.filter((x) => x.attached)) {
    try {
      await chrome.debugger.detach({ targetId: t.id });
    } catch {
      /* already detached */
    }
  }

  chrome.debugger.onEvent.removeListener(handleDebuggerEvent);
  browser.webNavigation.onCommitted.removeListener(handleWebNavigationOnCommitted);
  _requests.clear();
  _responses.clear();
  _capturingByRequest.clear();
  await storage.setItem('session:capturing', []);
  await storage.setItem('local:isAwaitGameData', false);
};
